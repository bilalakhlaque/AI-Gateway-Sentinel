import React, { useState, useRef, useEffect } from "react";
import { 
  useChat,
  useCompare,
  useGetStats, 
  useGetLogs,
  useGetTenants,
  useGetModelHealth,
  getGetModelHealthQueryKey,
  getGetStatsQueryKey, 
  getGetLogsQueryKey,
  getGetTenantsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Loader2, Shield, Activity, AlertCircle, Zap, Clock, Coins, Database, ArrowRight, X, ChevronDown, ChevronUp, Maximize2, Minimize2, Settings, ShieldAlert, Layers, SplitSquareHorizontal, Download, TrendingUp, Users, ChevronRight, AlertTriangle, Sun, Moon, Wifi, WifiOff, LogOut, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import SettingsModal from "@/components/SettingsModal";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useBudgets, type ModelKey as BudgetModelKey } from "@/hooks/useBudgets";
import { useTheme } from "@/hooks/useTheme";
import type { AuthUser } from "@/hooks/useAuth";

const PII_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  { type: "email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: "phone", regex: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
];

const INJECTION_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  { type: "instruction_override", regex: /ignore\s+(all\s+)?(previous|prior|your|the|above|initial)\s+(instructions?|prompt|rules?|guidelines?|directives?|context)/i },
  { type: "instruction_override", regex: /disregard\s+(all\s+)?(previous|prior|your|the|above|initial)\s+(instructions?|prompt|rules?|guidelines?|directives?|context)/i },
  { type: "instruction_override", regex: /forget\s+(all|everything|what you've been told|your instructions?|your training|your previous|your prior)/i },
  { type: "instruction_override", regex: /override\s+(your|the|all)\s+(instructions?|programming|directives?|rules?|guidelines?|constraints?)/i },
  { type: "instruction_override", regex: /new\s+(instructions?|directives?|rules?|prompt)\s*:/i },
  { type: "jailbreak", regex: /jailbreak/i },
  { type: "jailbreak", regex: /do anything now/i },
  { type: "jailbreak", regex: /developer\s*mode\s*(enabled|on|activated)/i },
  { type: "jailbreak", regex: /bypass\s+(safety|filter|restriction|moderation|guardrail|alignment)/i },
  { type: "role_hijack", regex: /you\s+are\s+now\s+(?!sentinai|an?\s+AI|a\s+language\s+model)/i },
  { type: "role_hijack", regex: /act\s+as\s+(if\s+you\s+have\s+no|an?\s+unrestricted|an?\s+unfiltered|a\s+different\s+AI|a\s+rogue)/i },
  { type: "role_hijack", regex: /pretend\s+(you\s+(are|have\s+no)\s+(restrictions?|limits?|rules?|guidelines?)|that\s+you\s+are\s+a\s+different)/i },
  { type: "prompt_delimiter", regex: /\[SYSTEM\]|\[INST\]|<\|system\|>|<\|im_start\|>|###\s*(system|instruction|prompt)/i },
  { type: "sql_injection", regex: /(['"]?\s*;\s*(DROP|DELETE|INSERT|UPDATE|TRUNCATE|ALTER|CREATE)\s+(TABLE|DATABASE|INDEX|VIEW))/i },
  { type: "sql_injection", regex: /UNION\s+(ALL\s+)?SELECT/i },
  { type: "sql_injection", regex: /(['"]?\s*(OR|AND)\s+['"]?1['"]?\s*=\s*['"]?1)/i },
];

function detectPiiClient(text: string) {
  const matches: Array<{ type: string; value: string }> = [];
  for (const { type, regex } of PII_PATTERNS) {
    const found = text.match(new RegExp(regex.source, regex.flags));
    if (found) found.forEach((value) => matches.push({ type, value }));
  }
  return matches;
}

function detectInjectionClient(text: string) {
  const matches: Array<{ type: string; snippet: string }> = [];
  for (const { type, regex } of INJECTION_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      const snippet = match[0].length > 50 ? match[0].slice(0, 47) + "..." : match[0];
      matches.push({ type, snippet });
    }
  }
  return matches;
}

const MODEL_OPTIONS = [
  { value: "openai", label: "OpenAI GPT-5.4" },
  { value: "gemini", label: "Gemini 3.1 Pro" },
  { value: "claude", label: "Claude Sonnet 4.6" },
  { value: "claude-opus", label: "Claude Opus 4.7" },
];

type ModelKey = "openai" | "gemini" | "claude" | "claude-opus";

interface PendingFallback {
  suggestedModel: ModelKey;
  failedModel: ModelKey;
  errorMessage: string;
}

const PROMPT_TEMPLATES: Array<{ label: string; prompt: string }> = [
  {
    label: "Summarize this",
    prompt: "Please summarize the following text in 3-5 concise bullet points, highlighting the key takeaways:\n\n[paste your text here]",
  },
  {
    label: "Debug this code",
    prompt: "I have a bug in the following code. Please identify the issue, explain why it's happening, and provide a corrected version:\n\n```\n[paste your code here]\n```",
  },
  {
    label: "Write a cover letter",
    prompt: "Write a professional cover letter for the following job description. Keep it under 300 words, enthusiastic but not over-the-top, and tailored to the role:\n\nJob title: [title]\nCompany: [company]\nKey requirements: [paste job description]",
  },
  {
    label: "Explain like I'm 5",
    prompt: "Explain the following concept in simple terms that a curious 10-year-old could understand. Use an analogy or real-world example:\n\nConcept: [topic]",
  },
  {
    label: "Compare pros & cons",
    prompt: "Give me a balanced pros and cons analysis of the following topic. Use a structured format with clear headers:\n\nTopic: [topic]",
  },
  {
    label: "Write unit tests",
    prompt: "Write comprehensive unit tests for the following function. Cover happy paths, edge cases, and error conditions. Use a standard testing framework appropriate to the language:\n\n```\n[paste your function here]\n```",
  },
];

const MODEL_LABELS: Record<ModelKey, string> = {
  openai: "OpenAI GPT-5.4",
  gemini: "Gemini 3.1 Pro",
  claude: "Claude Sonnet 4.6",
  "claude-opus": "Claude Opus 4.7",
};

type Mode = "single" | "compare";

interface HomeProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function Home({ user, onLogout }: HomeProps) {
  const tenantId = user.userId;
  const queryClient = useQueryClient();
  const { keys, updateKey, getModelKeys, hasAnyKey } = useApiKeys();
  const { budgets, setBudget, getActiveBudgets } = useBudgets();
  const { theme, toggleTheme } = useTheme();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelKey>("openai");
  const [mode, setMode] = useState<Mode>("single");
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [compareResults, setCompareResults] = useState<any>(null);
  const [pendingFallback, setPendingFallback] = useState<PendingFallback | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [piiWarning, setPiiWarning] = useState<Array<{ type: string; value: string }> | null>(null);
  const [injectionWarning, setInjectionWarning] = useState<Array<{ type: string; snippet: string }> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isLogFullscreen, setIsLogFullscreen] = useState(false);
  const [isResponseFullscreen, setIsResponseFullscreen] = useState(false);
  const [isCompareFullscreen, setIsCompareFullscreen] = useState(false);
  const [lastComparePrompt, setLastComparePrompt] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: stats } = useGetStats({ tenantId }, { query: { refetchInterval: 5000, queryKey: [...getGetStatsQueryKey({ tenantId }), tenantId] } });
  const { data: logsData } = useGetLogs({ tenantId }, { query: { refetchInterval: 5000, queryKey: [...getGetLogsQueryKey({ tenantId }), tenantId] } });
  const { data: tenantsData } = useGetTenants({ query: { refetchInterval: 5000, queryKey: getGetTenantsQueryKey() } });
  const { data: healthData } = useGetModelHealth({ query: { refetchInterval: 30000, queryKey: getGetModelHealthQueryKey() } });

  const chatMutation = useChat();
  const compareMutation = useCompare();

  const sendRequest = (targetModel: ModelKey) => {
    if (!prompt.trim()) return;
    const inj = detectInjectionClient(prompt);
    if (inj.length > 0) { setInjectionWarning(inj); setPiiWarning(null); return; }
    setInjectionWarning(null);
    const pii = detectPiiClient(prompt);
    if (pii.length > 0) { setPiiWarning(pii); return; }
    setPiiWarning(null);
    setPendingFallback(null);
    setLastError(null);

    chatMutation.mutate({ data: { prompt, model: targetModel, tenantId, budgets: getActiveBudgets() as any, modelKeys: getModelKeys() as any } }, {
      onSuccess: (data) => {
        setLastResponse(data);
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLogsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTenantsQueryKey() });
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: getGetLogsQueryKey() });
        const errData = err?.data as { error?: string; suggestedFallback?: string | null } | undefined;
        const errorMsg = errData?.error ?? "Request failed";
        const suggested = errData?.suggestedFallback as ModelKey | null | undefined;
        if (suggested) {
          setPendingFallback({ suggestedModel: suggested, failedModel: targetModel, errorMessage: errorMsg });
        } else {
          setLastError(errorMsg);
        }
      }
    });
  };

  const handleCompare = () => {
    if (!prompt.trim()) return;
    const inj = detectInjectionClient(prompt);
    if (inj.length > 0) { setInjectionWarning(inj); setPiiWarning(null); return; }
    setInjectionWarning(null);
    const pii = detectPiiClient(prompt);
    if (pii.length > 0) { setPiiWarning(pii); return; }
    setPiiWarning(null);
    setCompareResults(null);
    setLastComparePrompt(prompt);
    compareMutation.mutate({ data: { prompt, tenantId, budgets: getActiveBudgets() as any, modelKeys: getModelKeys() as any } }, {
      onSuccess: (data) => {
        setCompareResults(
          Object.entries(data.results as Record<string, any>).map(([model, r]) => ({ model, ...(r as any) }))
        );
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLogsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTenantsQueryKey() });
      },
      onError: (err: any) => {
        const msg = (err?.data as any)?.error ?? "Compare failed";
        setLastError(msg);
      }
    });
  };

  const handleSend = () => mode === "compare" ? handleCompare() : sendRequest(model);

  const handleConfirmFallback = () => {
    if (!pendingFallback) return;
    const fallbackModel = pendingFallback.suggestedModel;
    setModel(fallbackModel);
    sendRequest(fallbackModel);
  };

  const handleDismissFallback = () => {
    setPendingFallback(null);
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [prompt]);

  const exportCsv = () => {
    const logs = logsData?.logs ?? [];
    const hasCompare = compareResults && compareResults.length > 0;
    if (logs.length === 0 && !hasCompare) return;

    const sections: string[] = [];

    if (logs.length > 0) {
      const header = ["section", "timestamp", "model", "model_used", "status", "tokens", "latency_ms", "cost_usd", "prompt_snippet"].join(",");
      const rows = logs.map((l: any) => [
        `"traffic_log"`,
        `"${l.timestamp}"`,
        `"${l.model}"`,
        `"${l.modelUsed}"`,
        `"${l.status}"`,
        l.tokens ?? 0,
        l.latencyMs ?? 0,
        (l.cost ?? 0).toFixed(8),
        `"${(l.promptSnippet ?? "").replace(/"/g, '""')}"`,
      ].join(","));
      sections.push([header, ...rows].join("\n"));
    }

    if (hasCompare) {
      const compareHeader = ["section", "prompt_snippet", "model", "status", "latency_ms", "tokens", "cost_usd", "response_snippet"].join(",");
      const promptSnippet = lastComparePrompt.slice(0, 120).replace(/"/g, '""');
      const compareRows = compareResults.map((r: any) => [
        `"compare_run"`,
        `"${promptSnippet}"`,
        `"${r.model}"`,
        `"${r.status}"`,
        r.latencyMs ?? 0,
        r.tokens ?? 0,
        (r.cost ?? 0).toFixed(8),
        `"${((r.response ?? r.error ?? "").slice(0, 200)).replace(/"/g, '""')}"`,
      ].join(","));
      sections.push([compareHeader, ...compareRows].join("\n"));
    }

    const csv = sections.join("\n\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinai-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const MODEL_COLORS: Record<string, string> = {
    openai: "#22d3ee",
    gemini: "#a78bfa",
    claude: "#34d399",
    "claude-opus": "#fb923c",
  };

  const latencyChartData = (() => {
    const logs = (logsData?.logs ?? []).filter((l: any) => l.status !== "blocked" && l.latencyMs > 0);
    const last30 = logs.slice(-30);
    return last30.map((l: any, i: number) => {
      const t = new Date(l.timestamp);
      const label = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}`;
      return {
        index: i + 1,
        time: label,
        openai: l.modelUsed === "openai" ? l.latencyMs : null,
        gemini: l.modelUsed === "gemini" ? l.latencyMs : null,
        claude: l.modelUsed === "claude" ? l.latencyMs : null,
        "claude-opus": l.modelUsed === "claude-opus" ? l.latencyMs : null,
      };
    });
  })();

  const chartData = stats ? [
    { name: 'OpenAI', cost: stats.models.openai.cost, fill: 'hsl(var(--chart-1))' },
    { name: 'Gemini', cost: stats.models.gemini.cost, fill: 'hsl(var(--chart-2))' },
    { name: 'Sonnet', cost: stats.models.claude.cost, fill: 'hsl(var(--chart-3))' },
    { name: 'Opus', cost: (stats.models as any)['claude-opus'].cost, fill: 'hsl(var(--chart-4))' },
  ] : [];

  const logs = logsData?.logs || [];

  const logTable = (
    <Table>
      <TableHeader className="bg-slate-950/80 sticky top-0 z-10 backdrop-blur-sm shadow-sm border-b border-slate-800">
        <TableRow className="border-none hover:bg-transparent">
          <TableHead className="font-mono text-xs text-slate-500 h-10">TIME</TableHead>
          <TableHead className="font-mono text-xs text-slate-500 h-10">TARGET</TableHead>
          <TableHead className="font-mono text-xs text-slate-500 h-10">USED</TableHead>
          <TableHead className="font-mono text-xs text-slate-500 h-10">PROMPT</TableHead>
          <TableHead className="font-mono text-xs text-slate-500 h-10 text-right">TOKENS</TableHead>
          <TableHead className="font-mono text-xs text-slate-500 h-10 text-right">LATENCY</TableHead>
          <TableHead className="font-mono text-xs text-slate-500 h-10 text-right">COST</TableHead>
          <TableHead className="font-mono text-xs text-slate-500 h-10 text-right">STATUS</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="font-mono text-sm">
        {logs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-8 text-slate-500 h-32">
              NO TRAFFIC DETECTED
            </TableCell>
          </TableRow>
        ) : (
          logs.map((log: any) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <React.Fragment key={log.id}>
                <TableRow
                  className="border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer select-none"
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                >
                  <TableCell className="text-slate-400 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {isExpanded
                        ? <ChevronUp className="w-3 h-3 text-cyan-400 shrink-0" />
                        : <ChevronDown className="w-3 h-3 text-slate-600 shrink-0" />}
                      {format(new Date(log.timestamp), "HH:mm:ss.SSS")}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">{log.model}</TableCell>
                  <TableCell className={log.model !== log.modelUsed ? "text-amber-400" : "text-cyan-400"}>{log.modelUsed}</TableCell>
                  <TableCell className="text-slate-400 max-w-[200px] truncate">{log.promptSnippet}</TableCell>
                  <TableCell className="text-right text-slate-300">{log.tokens}</TableCell>
                  <TableCell className="text-right text-slate-300">{log.latencyMs}ms</TableCell>
                  <TableCell className="text-right text-emerald-400">${log.cost.toFixed(6)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={`
                      text-[10px] py-0 px-2 h-5 border-none whitespace-nowrap
                      ${log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : ''}
                      ${log.status === 'fallback' ? 'bg-amber-500/10 text-amber-400' : ''}
                      ${log.status === 'blocked' ? 'bg-rose-500/10 text-rose-400' : ''}
                      ${log.status === 'error' ? 'bg-rose-500/10 text-rose-300' : ''}
                    `}>
                      {log.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="border-slate-800/50 bg-slate-950/60 hover:bg-slate-950/60">
                    <TableCell colSpan={8} className="px-6 py-3">
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Prompt</span>
                            <p className="mt-1 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-800 rounded bg-slate-900/60 p-3 max-h-48 overflow-y-auto">
                              {log.promptSnippet}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-mono text-cyan-500 uppercase tracking-wider">Response</span>
                            {log.responseText ? (
                              <p className="mt-1 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed border border-cyan-900/40 rounded bg-cyan-950/10 p-3 max-h-48 overflow-y-auto">
                                {log.responseText}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs font-mono text-slate-600 italic border border-slate-800 rounded bg-slate-900/60 p-3">
                                No response recorded
                              </p>
                            )}
                          </div>
                        </div>
                        {log.errorMessage && (
                          <div>
                            <span className="text-[10px] font-mono text-rose-500 uppercase tracking-wider">Error</span>
                            <p className="mt-1 text-xs font-mono text-rose-400 whitespace-pre-wrap leading-relaxed border border-rose-900/40 rounded bg-rose-950/20 p-3">
                              {log.errorMessage}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-6">
                          <span className="text-[10px] font-mono text-slate-500">
                            ID: <span className="text-slate-400">{log.id}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss.SSS")}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className={`sentinai-root min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 flex flex-col`}>
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
              SentinAI <span className="text-xs font-mono font-normal bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">v0.1.0</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">MULTI-MODEL GATEWAY</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            SYSTEM OPERATIONAL
          </div>

          {/* Logged-in user badge */}
          <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-[11px] font-mono text-slate-300">
            <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="max-w-[100px] truncate text-cyan-300">{user.username}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            title="Sign out"
            className="h-8 w-8 p-0 hover:bg-slate-800 hover:text-rose-400 text-slate-500 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-slate-800 hover:text-amber-400 text-slate-500 transition-colors"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 hover:bg-slate-800 hover:text-cyan-400 transition-colors ${hasAnyKey ? "text-cyan-400" : "text-slate-500"}`}
            onClick={() => setShowSettings(true)}
            title="API Key Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 max-w-[1600px] mx-auto w-full">
        {/* Left Column: Chat */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <Card className="bg-slate-900/50 border-slate-800 shadow-xl shadow-black/40 flex flex-col">
            <CardHeader className="border-b border-slate-800/50 pb-3">
              <CardTitle className="text-base font-medium flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  Prompt Console
                </div>
                <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5">
                  <button
                    onClick={() => setMode("single")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${mode === "single" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    <Layers className="w-3 h-3" /> Single
                  </button>
                  <button
                    onClick={() => setMode("compare")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${mode === "compare" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    <SplitSquareHorizontal className="w-3 h-3" /> Compare
                  </button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-4">
              {mode === "single" && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Target Model</label>
                  <Select value={model} onValueChange={(val: any) => setModel(val)}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 focus:ring-cyan-500/50 font-mono text-sm">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                      {MODEL_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="font-mono text-sm focus:bg-slate-800 focus:text-white">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {mode === "compare" && (
                <div className="flex items-center gap-2 rounded-lg border border-cyan-900/40 bg-cyan-950/10 px-3 py-2">
                  <SplitSquareHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-[11px] font-mono text-cyan-400">Prompt will be sent to all 4 models simultaneously</span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Input Prompt</label>
                  <Select
                    value=""
                    onValueChange={(val) => {
                      const tpl = PROMPT_TEMPLATES.find((t) => t.label === val);
                      if (tpl) setPrompt(tpl.prompt);
                    }}
                  >
                    <SelectTrigger className="h-6 w-auto gap-1.5 border-slate-700 bg-slate-950/80 px-2 text-[10px] font-mono text-slate-400 hover:text-cyan-400 hover:border-cyan-700 focus:ring-cyan-500/30 transition-colors [&>svg]:hidden">
                      <span className="flex items-center gap-1">
                        <Database className="w-2.5 h-2.5" />
                        Templates
                      </span>
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 min-w-[200px]">
                      <div className="px-2 py-1.5 text-[9px] font-mono text-slate-500 uppercase tracking-wider border-b border-slate-800 mb-1">
                        Select a template
                      </div>
                      {PROMPT_TEMPLATES.map((tpl) => (
                        <SelectItem
                          key={tpl.label}
                          value={tpl.label}
                          className="font-mono text-xs focus:bg-slate-800 focus:text-cyan-300 cursor-pointer"
                        >
                          {tpl.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea 
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter prompt here..."
                  rows={5}
                  className="bg-slate-950 border-slate-800 focus-visible:ring-cyan-500/50 font-mono text-sm resize-none overflow-hidden"
                />
              </div>

              {/* Injection Warning */}
              {injectionWarning && injectionWarning.length > 0 && (
                <div className="rounded-lg border border-orange-500/40 bg-orange-950/20 p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono font-semibold text-orange-300">Injection Attempt Detected — prompt blocked</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {injectionWarning.map((m, i) => (
                            <span key={i} className="text-[10px] font-mono bg-orange-900/40 text-orange-400 px-1.5 py-0.5 rounded border border-orange-800/50" title={m.snippet}>
                              {m.type.replace(/_/g, " ").toUpperCase()}
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] font-mono text-orange-500/80 mt-0.5 leading-relaxed">
                          Matched: &ldquo;{injectionWarning[0]?.snippet}&rdquo;
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setInjectionWarning(null)} className="text-slate-500 hover:text-slate-300 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* PII Warning */}
              {piiWarning && piiWarning.length > 0 && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono font-semibold text-rose-300">PII Detected — prompt blocked</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {piiWarning.map((m, i) => (
                            <span key={i} className="text-[10px] font-mono bg-rose-900/40 text-rose-400 px-1.5 py-0.5 rounded border border-rose-800/50">
                              {m.type.toUpperCase()}: {m.value.length > 20 ? m.value.slice(0, 17) + "..." : m.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setPiiWarning(null)} className="text-slate-500 hover:text-slate-300 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleSend} 
                disabled={(mode === "single" ? chatMutation.isPending : compareMutation.isPending) || !prompt.trim() || !!pendingFallback}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-[0_0_15px_rgba(8,145,178,0.3)] hover:shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all"
              >
                {(mode === "single" ? chatMutation.isPending : compareMutation.isPending) ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> EXECUTING...</>
                ) : mode === "compare" ? (
                  <><SplitSquareHorizontal className="w-4 h-4 mr-2" /> COMPARE ALL MODELS</>
                ) : (
                  <>SEND REQUEST</>
                )}
              </Button>

              {/* Fallback confirmation banner */}
              {pendingFallback && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono font-semibold text-amber-300">
                          {MODEL_LABELS[pendingFallback.failedModel]} failed
                        </span>
                        <span
                          className="text-[11px] font-mono text-amber-400/70 leading-relaxed break-all line-clamp-3"
                          title={pendingFallback.errorMessage}
                        >
                          {pendingFallback.errorMessage}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleDismissFallback}
                      className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 mt-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-xs font-mono text-slate-400">Try next model?</span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDismissFallback}
                        className="h-7 px-3 text-xs font-mono border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      >
                        No
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleConfirmFallback}
                        disabled={chatMutation.isPending}
                        className="h-7 px-3 text-xs font-mono bg-amber-600 hover:bg-amber-500 text-white border-0 flex items-center gap-1.5"
                      >
                        {chatMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ArrowRight className="w-3 h-3" />
                        )}
                        {MODEL_LABELS[pendingFallback.suggestedModel]}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Plain error (no fallback available) */}
              {lastError && !pendingFallback && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-xs font-mono font-semibold text-rose-300">All models exhausted</span>
                    <span className="text-[11px] font-mono text-rose-400/70 break-all">{lastError}</span>
                  </div>
                  <button
                    onClick={() => setLastError(null)}
                    className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Response Area — single mode */}
          {mode === "single" && (
          <Card className="bg-slate-900/50 border-slate-800 shadow-xl shadow-black/40 min-h-[250px] flex flex-col">
            <CardHeader className="border-b border-slate-800/50 pb-4">
              <CardTitle className="text-base font-medium flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Response Log
                </div>
                <div className="flex items-center gap-2">
                  {lastResponse?.cached && (
                    <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20 gap-1 font-mono text-[10px]">
                      <FlaskConical className="w-3 h-3" />
                      CACHED {Math.round((lastResponse.cacheHit?.similarity ?? 0) * 100)}%
                    </Badge>
                  )}
                  {lastResponse && (
                    <Badge variant={lastResponse.status === 'success' || lastResponse.status === 'cached' ? 'default' : lastResponse.status === 'fallback' ? 'secondary' : 'destructive'}
                      className={`
                        ${lastResponse.status === 'success' || lastResponse.status === 'cached' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30' : ''}
                        ${lastResponse.status === 'fallback' ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/20 border-amber-500/30' : ''}
                        ${lastResponse.status === 'blocked' ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/20 border-rose-500/30' : ''}
                      `}>
                      {lastResponse.status.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {!lastResponse ? (
                <div className="h-full flex items-center justify-center text-slate-500 font-mono text-sm py-12">
                  AWAITING INPUT...
                </div>
              ) : (
                <div className="p-4 flex flex-col gap-4 h-full">
                  {lastResponse.cached && lastResponse.cacheHit && (
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-2 flex items-center gap-2.5">
                      <FlaskConical className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[10px] font-mono text-cyan-400 font-semibold tracking-wide">SEMANTIC CACHE HIT — {Math.round(lastResponse.cacheHit.similarity * 100)}% similarity · $0 cost · instant response</span>
                        <span className="text-[10px] font-mono text-slate-500 truncate">
                          Matched: &ldquo;{lastResponse.cacheHit.originalPrompt.slice(0, 80)}{lastResponse.cacheHit.originalPrompt.length > 80 ? "…" : ""}&rdquo;
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-slate-500">REQUESTED</span>
                      <span className="text-xs font-mono text-white truncate" title={lastResponse.model}>{lastResponse.model}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-slate-500">USED</span>
                      <span className="text-xs font-mono text-cyan-400 truncate" title={lastResponse.modelUsed}>{lastResponse.modelUsed}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-slate-500">LATENCY</span>
                      <span className="text-xs font-mono text-white">{lastResponse.cached ? <span className="text-cyan-400">0ms ⚡</span> : `${lastResponse.latencyMs}ms`}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-slate-500">COST</span>
                      <span className="text-xs font-mono text-emerald-400">{lastResponse.cached ? "$0.000000 ⚡" : `$${lastResponse.cost.toFixed(6)}`}</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-950 border border-slate-800 rounded p-4 flex-1">
                    <ScrollArea className="h-[150px] w-full">
                      <p className="text-sm font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {lastResponse.response || "No response content."}
                      </p>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </CardContent>
            <div className="p-3 border-t border-slate-800/50 bg-slate-900/80 flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-xs font-mono text-slate-400 hover:text-cyan-400 hover:bg-slate-800 gap-2"
                onClick={() => setIsResponseFullscreen(true)}
                disabled={!lastResponse}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Expand Response
              </Button>
            </div>
          </Card>
          )}

          {/* Compare Results — compare mode */}
          {mode === "compare" && (
            <Card className="bg-slate-900/50 border-slate-800 shadow-xl shadow-black/40 flex flex-col">
              <CardHeader className="border-b border-slate-800/50 pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <SplitSquareHorizontal className="w-4 h-4 text-cyan-400" />
                  Model Comparison
                  {compareResults && (
                    <span className="text-[10px] font-mono text-slate-500 ml-auto">{compareResults.length} models</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {compareMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                    <span className="text-xs font-mono text-slate-400">Querying all models in parallel…</span>
                  </div>
                ) : !compareResults ? (
                  <div className="flex items-center justify-center text-slate-500 font-mono text-sm py-10">
                    AWAITING COMPARE…
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {compareResults.map((r: any) => {
                      const label = MODEL_LABELS[r.model as ModelKey] ?? r.model;
                      const isOk = r.status === "success" || r.status === "cached";
                      const isCached = r.status === "cached";
                      return (
                        <div key={r.model} className={`rounded-lg border p-3 flex flex-col gap-2 ${isOk ? (isCached ? "border-cyan-700/40 bg-cyan-950/10" : "border-slate-700 bg-slate-950/60") : "border-rose-900/40 bg-rose-950/10"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono font-semibold text-slate-200 truncate">{label}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isCached && (
                                <Badge className="text-[9px] bg-cyan-500/20 text-cyan-300 border-cyan-500/30 gap-1 font-mono py-0">
                                  <FlaskConical className="w-2.5 h-2.5" />
                                  {Math.round((r.cacheHit?.similarity ?? 0) * 100)}%
                                </Badge>
                              )}
                              <Badge className={`text-[10px] ${isOk ? (isCached ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30") : "bg-rose-500/20 text-rose-400 border-rose-500/30"}`}>
                                {isCached ? "CACHED" : isOk ? "OK" : "FAILED"}
                              </Badge>
                            </div>
                          </div>
                          {isOk ? (
                            <>
                              <div className="grid grid-cols-3 gap-1">
                                <div className="bg-slate-900 rounded p-1.5 flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono text-slate-500">LATENCY</span>
                                  <span className="text-[11px] font-mono text-white">{isCached ? <span className="text-cyan-400">0ms ⚡</span> : `${r.latencyMs}ms`}</span>
                                </div>
                                <div className="bg-slate-900 rounded p-1.5 flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono text-slate-500">TOKENS</span>
                                  <span className="text-[11px] font-mono text-white">{isCached ? <span className="text-cyan-400">0 ⚡</span> : (r.tokens ?? "—")}</span>
                                </div>
                                <div className="bg-slate-900 rounded p-1.5 flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono text-slate-500">COST</span>
                                  <span className="text-[11px] font-mono text-emerald-400">{isCached ? "$0 ⚡" : `$${r.cost?.toFixed(5) ?? "—"}`}</span>
                                </div>
                              </div>
                              <ScrollArea className="h-[120px]">
                                <p className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">{r.response}</p>
                              </ScrollArea>
                            </>
                          ) : (
                            <p className="text-[11px] font-mono text-rose-400 leading-relaxed">{r.error ?? "Unknown error"}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
              {compareResults && (
                <div className="p-3 border-t border-slate-800/50 bg-slate-900/80 flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-xs font-mono text-slate-400 hover:text-cyan-400 hover:bg-slate-800 gap-2"
                    onClick={() => setIsCompareFullscreen(true)}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Expand All
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right Column: Stats & Logs */}
        <div className="xl:col-span-8 flex flex-col gap-6">

          {/* Budget Alert Banner */}
          {(["openai", "gemini", "claude", "claude-opus"] as const).some(m => {
            const budget = budgets[m as BudgetModelKey];
            const cost = (stats?.models as any)?.[m]?.cost ?? 0;
            return budget !== undefined && cost >= budget;
          }) && (
            <div className="flex flex-col gap-2">
              {(["openai", "gemini", "claude", "claude-opus"] as const).map(m => {
                const budget = budgets[m as BudgetModelKey];
                const cost = (stats?.models as any)?.[m]?.cost ?? 0;
                if (budget === undefined || cost < budget) return null;
                const fallback = { openai: "gemini", gemini: "claude", claude: "claude-opus", "claude-opus": null }[m];
                return (
                  <div key={m} className="flex items-center gap-3 bg-rose-950/60 border border-rose-500/50 rounded-lg px-4 py-2.5 shadow-lg shadow-rose-900/20 animate-pulse-once">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-rose-300 font-medium">{MODEL_LABELS[m]} budget exceeded</span>
                      <span className="text-[11px] font-mono text-rose-500 ml-2">${cost.toFixed(6)} / ${budget.toFixed(4)} limit</span>
                    </div>
                    {fallback && (
                      <span className="text-[10px] font-mono text-rose-400/70 shrink-0">→ falling back to {MODEL_LABELS[fallback as ModelKey]}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* API Health Panel */}
          {(() => {
            const models = (["openai", "gemini", "claude", "claude-opus"] as const);
            const STATUS_CONFIG = {
              healthy:  { dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]", label: "Healthy",  text: "text-emerald-400", pulse: true },
              degraded: { dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]",   label: "Degraded", text: "text-amber-400",   pulse: true },
              down:     { dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]",     label: "Down",     text: "text-rose-400",   pulse: false },
              unknown:  { dot: "bg-slate-500",                                          label: "Unknown",  text: "text-slate-500",  pulse: false },
            };
            const anyDown = models.some(m => (healthData?.models as any)?.[m]?.status === "down");
            return (
              <Card className={`bg-slate-900/50 shadow-lg transition-colors ${anyDown ? "border-rose-500/50" : "border-slate-800"}`}>
                <CardHeader className="p-3 pb-0 border-b border-slate-800/50">
                  <CardTitle className="text-xs font-mono text-slate-300 flex items-center justify-between pb-3">
                    <span className="flex items-center gap-2">
                      <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                      API Health Monitor
                    </span>
                    <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">POLLS EVERY 30s</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {models.map(m => {
                      const entry = (healthData?.models as any)?.[m];
                      const status: keyof typeof STATUS_CONFIG = entry?.status ?? "unknown";
                      const cfg = STATUS_CONFIG[status];
                      const sr = entry?.successRate ?? 100;
                      return (
                        <div key={m} className="flex flex-col gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 p-2.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono text-slate-400 truncate">{MODEL_LABELS[m]}</span>
                            <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-mono font-medium ${cfg.text}`}>{cfg.label}</span>
                            {entry && (
                              <span className="text-[9px] font-mono text-slate-600">{sr.toFixed(0)}% ok</span>
                            )}
                          </div>
                          {entry?.recentErrors > 0 && (
                            <div className="flex items-center gap-1">
                              <WifiOff className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                              <span className="text-[9px] font-mono text-rose-500">{entry.recentErrors} recent err{entry.recentErrors !== 1 ? "s" : ""}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Top Stats Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Aggregates */}
            <div className="flex flex-col gap-4">
              <Card className="bg-slate-900/50 border-slate-800 shadow-lg">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono text-slate-400">TOTAL REQUESTS</p>
                    <p className="text-3xl font-light text-white font-mono mt-1">{stats?.totalRequests || 0}</p>
                  </div>
                  <div className="bg-blue-500/10 p-3 rounded-full">
                    <Activity className="w-6 h-6 text-blue-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-800 shadow-lg">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono text-slate-400">BLOCKED REQUESTS</p>
                    <p className="text-3xl font-light text-rose-400 font-mono mt-1">{stats?.blockedRequests || 0}</p>
                  </div>
                  <div className="bg-rose-500/10 p-3 rounded-full">
                    <AlertCircle className="w-6 h-6 text-rose-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Model Breakdown */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(["openai", "gemini", "claude", "claude-opus"] as const).map(m => {
                const ms = (stats?.models as any)?.[m] || { requests: 0, avgLatencyMs: 0, cost: 0, tokens: 0 };
                const label = MODEL_LABELS[m];
                const budget = budgets[m as BudgetModelKey];
                const isOverBudget = budget !== undefined && ms.cost >= budget;
                const budgetPct = budget !== undefined && budget > 0 ? Math.min(ms.cost / budget, 1) : null;
                return (
                  <Card key={m} className={`bg-slate-900/50 shadow-lg transition-colors ${isOverBudget ? "border-rose-500/70 shadow-rose-900/30" : "border-slate-800"}`}>
                    <CardHeader className="p-3 pb-2 border-b border-slate-800/50">
                      <CardTitle className="text-xs font-mono text-slate-200 flex items-center justify-between gap-1">
                        <span className="truncate">{label}</span>
                        {isOverBudget ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <AlertTriangle className="w-3 h-3 text-rose-400 animate-pulse" />
                            <span className="text-[9px] font-mono text-rose-400 uppercase tracking-wide">Budget</span>
                          </div>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-cyan-500/50 shrink-0" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-slate-500">Requests</span>
                        <span className="text-xs font-mono text-white">{ms.requests}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-slate-500">Latency</span>
                        <span className="text-xs font-mono text-white">{ms.avgLatencyMs.toFixed(0)}ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-slate-500">Tokens</span>
                        <span className="text-xs font-mono text-white">{ms.tokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-800/50 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1"><Coins className="w-2.5 h-2.5" /> Cost</span>
                        <span className={`text-xs font-mono ${isOverBudget ? "text-rose-400" : "text-emerald-400"}`}>${ms.cost.toFixed(6)}</span>
                      </div>
                      {budgetPct !== null && (
                        <div className="mt-0.5">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-[9px] font-mono text-slate-600">limit: ${budget!.toFixed(4)}</span>
                            <span className={`text-[9px] font-mono ${isOverBudget ? "text-rose-400" : "text-slate-500"}`}>{(budgetPct * 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isOverBudget ? "bg-rose-500" : budgetPct > 0.8 ? "bg-amber-500" : "bg-cyan-500"}`}
                              style={{ width: `${budgetPct * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Live Latency Chart */}
          <Card className="bg-slate-900/50 border-slate-800 shadow-xl">
            <CardHeader className="p-4 border-b border-slate-800/50">
              <CardTitle className="text-sm font-mono text-slate-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Live Latency
                <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  LIVE · LAST {latencyChartData.length} REQUESTS
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 h-[200px]">
              {latencyChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 font-mono text-xs">NO DATA YET — SEND A REQUEST</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={latencyChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} unit="ms" />
                    <Tooltip
                      cursor={{ stroke: 'rgba(255,255,255,0.08)' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-[11px] font-mono">
                            <p className="text-slate-400 mb-1">{label}</p>
                            {payload.filter(p => p.value != null).map(p => (
                              <p key={p.dataKey as string} style={{ color: p.stroke as string }}>
                                {p.name}: {p.value}ms
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '4px' }}
                      formatter={(value) => <span style={{ color: MODEL_COLORS[value] ?? '#94a3b8' }}>{MODEL_LABELS[value as ModelKey] ?? value}</span>}
                    />
                    {(["openai", "gemini", "claude", "claude-opus"] as ModelKey[]).map(m => (
                      <Line key={m} type="monotone" dataKey={m} name={m} stroke={MODEL_COLORS[m]} strokeWidth={2} dot={{ r: 3, fill: MODEL_COLORS[m] }} connectNulls activeDot={{ r: 5 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Middle Row: Cost Chart */}
          <Card className="bg-slate-900/50 border-slate-800 shadow-xl">
            <CardHeader className="p-4 border-b border-slate-800/50">
              <CardTitle className="text-sm font-mono text-slate-300 flex items-center gap-2">
                <Coins className="w-4 h-4 text-cyan-400" />
                Cost Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontFamily: 'monospace' }} width={80} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs font-mono text-white">
                            <span className="text-slate-400">{payload[0].payload.name}: </span>
                            <span className="text-emerald-400">${Number(payload[0].value).toFixed(6)}</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tenants Panel */}
          <Card className="bg-slate-900/50 border-slate-800 shadow-xl">
            <CardHeader className="p-4 border-b border-slate-800/50">
              <CardTitle className="text-sm font-mono text-slate-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  Tenants
                </div>
                <span className="text-[10px] font-mono text-slate-500 font-normal">
                  {(tenantsData?.tenants ?? []).length} active · viewing <span className="text-cyan-400">{tenantId}</span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!tenantsData?.tenants?.length ? (
                <div className="flex items-center justify-center text-slate-500 font-mono text-xs py-6">
                  No requests yet
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {tenantsData.tenants.map((t) => {
                    const isActive = t.tenantId === tenantId;
                    const successRate = t.totalRequests > 0
                      ? Math.round(((t.totalRequests - t.blockedRequests) / t.totalRequests) * 100)
                      : 0;
                    return (
                      <div
                        key={t.tenantId}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${isActive ? "bg-slate-800/40" : ""}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-cyan-400" : "bg-slate-600"}`} />
                        <span className={`text-[11px] font-mono font-semibold w-20 truncate ${isActive ? "text-cyan-300" : "text-slate-300"}`}>
                          {t.tenantId}
                        </span>
                        <div className="flex items-center gap-4 ml-auto text-[10px] font-mono text-slate-400 flex-wrap">
                          <span><span className="text-slate-200">{t.totalRequests}</span> req</span>
                          <span><span className={t.blockedRequests > 0 ? "text-rose-400" : "text-slate-200"}>{t.blockedRequests}</span> blocked</span>
                          <span><span className="text-emerald-400">{successRate}%</span> ok</span>
                          <span><span className="text-emerald-400">${t.totalCost.toFixed(5)}</span></span>
                          <span><span className="text-slate-200">{t.totalTokens.toLocaleString()}</span> tok</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom Row: Logs Table */}
          <Card className="bg-slate-900/50 border-slate-800 shadow-xl flex-1 flex flex-col overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-800/50 bg-slate-900">
              <CardTitle className="text-sm font-mono text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Traffic Log
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] font-mono text-slate-400 hover:text-cyan-400 hover:bg-slate-800 gap-1.5 border border-slate-700"
                    onClick={exportCsv}
                    disabled={!logsData?.logs?.length && !(compareResults && compareResults.length > 0)}
                    title="Download CSV report"
                  >
                    <Download className="w-3 h-3" />
                    Export CSV
                  </Button>
                  <Badge variant="outline" className="text-[10px] font-mono border-slate-700 bg-slate-800 text-slate-400">
                    LAST 20 ENTRIES
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-auto min-h-[300px]">
              {logTable}
            </div>
            <div className="p-3 border-t border-slate-800/50 bg-slate-900/80 flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-xs font-mono text-slate-400 hover:text-cyan-400 hover:bg-slate-800 gap-2"
                onClick={() => setIsLogFullscreen(true)}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Expand Log
              </Button>
            </div>
          </Card>
        </div>
      </main>

      {/* Fullscreen Response Overlay */}
      {isResponseFullscreen && lastResponse && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                <Database className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-sm font-mono text-slate-200 font-semibold tracking-wide">Response Log</h2>
                <p className="text-[10px] font-mono text-slate-500">
                  {lastResponse.model} → {lastResponse.modelUsed} · {lastResponse.latencyMs}ms · ${lastResponse.cost.toFixed(6)}
                </p>
              </div>
              <Badge className={`ml-2 ${lastResponse.status === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                {lastResponse.status.toUpperCase()}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 gap-2"
              onClick={() => setIsResponseFullscreen(false)}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Collapse
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-8">
            <p className="text-base font-mono text-slate-200 whitespace-pre-wrap leading-loose">
              {lastResponse.response || "No response content."}
            </p>
          </div>
        </div>
      )}

      {/* Fullscreen Log Overlay */}
      {isLogFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-sm font-mono text-slate-200 font-semibold tracking-wide">Traffic Log</h2>
                <p className="text-[10px] font-mono text-slate-500">Last 20 entries · click any row to expand</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 gap-2"
              onClick={() => setIsLogFullscreen(false)}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Collapse
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            {logTable}
          </div>
        </div>
      )}
      {/* Fullscreen Compare Overlay */}
      {isCompareFullscreen && compareResults && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                <SplitSquareHorizontal className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-sm font-mono text-slate-200 font-semibold tracking-wide">Model Comparison</h2>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5 max-w-xl truncate">
                  {prompt.length > 100 ? prompt.slice(0, 100) + "…" : prompt}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 gap-2"
              onClick={() => setIsCompareFullscreen(false)}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Collapse
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[1400px] mx-auto">
              {compareResults.map((r: any) => {
                const label = MODEL_LABELS[r.model as ModelKey] ?? r.model;
                const isOk = r.status === "success";
                return (
                  <div key={r.model} className={`rounded-xl border p-4 flex flex-col gap-3 ${isOk ? "border-slate-700 bg-slate-900/60" : "border-rose-900/40 bg-rose-950/10"}`}>
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
                      <span className="text-sm font-mono font-semibold text-slate-100">{label}</span>
                      <Badge className={`text-[10px] shrink-0 ${isOk ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border-rose-500/30"}`}>
                        {isOk ? "OK" : "FAILED"}
                      </Badge>
                    </div>
                    {isOk ? (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-slate-950 rounded-lg p-2 flex flex-col gap-0.5">
                            <span className="text-[9px] font-mono text-slate-500 uppercase">Latency</span>
                            <span className="text-xs font-mono text-white">{r.latencyMs}ms</span>
                          </div>
                          <div className="bg-slate-950 rounded-lg p-2 flex flex-col gap-0.5">
                            <span className="text-[9px] font-mono text-slate-500 uppercase">Tokens</span>
                            <span className="text-xs font-mono text-white">{r.tokens ?? "—"}</span>
                          </div>
                          <div className="bg-slate-950 rounded-lg p-2 flex flex-col gap-0.5">
                            <span className="text-[9px] font-mono text-slate-500 uppercase">Cost</span>
                            <span className="text-xs font-mono text-emerald-400">${r.cost?.toFixed(6) ?? "—"}</span>
                          </div>
                        </div>
                        <p className="text-sm font-mono text-slate-200 whitespace-pre-wrap leading-relaxed flex-1">{r.response}</p>
                      </>
                    ) : (
                      <p className="text-sm font-mono text-rose-400 leading-relaxed">{r.error ?? "Unknown error"}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        keys={keys}
        onUpdate={updateKey}
        budgets={budgets}
        onBudget={setBudget}
      />
    </div>
  );
}
