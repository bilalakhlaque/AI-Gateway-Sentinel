import React, { useState } from "react";
import { 
  useChat, 
  useGetStats, 
  useGetLogs, 
  getGetStatsQueryKey, 
  getGetLogsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Loader2, Shield, Activity, AlertCircle, Zap, Clock, Coins, Database, ArrowRight, X, ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
import { format } from "date-fns";

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

const MODEL_LABELS: Record<ModelKey, string> = {
  openai: "OpenAI GPT-5.4",
  gemini: "Gemini 3.1 Pro",
  claude: "Claude Sonnet 4.6",
  "claude-opus": "Claude Opus 4.7",
};

export default function Home() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelKey>("openai");
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [pendingFallback, setPendingFallback] = useState<PendingFallback | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isLogFullscreen, setIsLogFullscreen] = useState(false);
  const [isResponseFullscreen, setIsResponseFullscreen] = useState(false);

  const { data: stats } = useGetStats({ query: { refetchInterval: 5000, queryKey: getGetStatsQueryKey() } });
  const { data: logsData } = useGetLogs({ query: { refetchInterval: 5000, queryKey: getGetLogsQueryKey() } });

  const chatMutation = useChat();

  const sendRequest = (targetModel: ModelKey) => {
    if (!prompt.trim()) return;
    setPendingFallback(null);
    setLastError(null);

    chatMutation.mutate({ data: { prompt, model: targetModel } }, {
      onSuccess: (data) => {
        setLastResponse(data);
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLogsQueryKey() });
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: getGetLogsQueryKey() });
        const errData = err?.data as { error?: string; suggestedFallback?: string | null } | undefined;
        const errorMsg = errData?.error ?? "Request failed";
        const suggested = errData?.suggestedFallback as ModelKey | null | undefined;

        if (suggested) {
          setPendingFallback({
            suggestedModel: suggested,
            failedModel: targetModel,
            errorMessage: errorMsg,
          });
        } else {
          setLastError(errorMsg);
        }
      }
    });
  };

  const handleSend = () => sendRequest(model);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 flex flex-col">
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
        <div className="flex items-center gap-4 text-sm font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            SYSTEM OPERATIONAL
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 max-w-[1600px] mx-auto w-full">
        {/* Left Column: Chat */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <Card className="bg-slate-900/50 border-slate-800 shadow-xl shadow-black/40 flex-1 flex flex-col">
            <CardHeader className="border-b border-slate-800/50 pb-4">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Prompt Console
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 flex flex-col gap-4">
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

              <div className="flex flex-col gap-2 flex-1">
                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Input Prompt</label>
                <Textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter prompt here..."
                  className="flex-1 min-h-[200px] bg-slate-950 border-slate-800 focus-visible:ring-cyan-500/50 font-mono text-sm resize-none"
                />
              </div>

              <Button 
                onClick={handleSend} 
                disabled={chatMutation.isPending || !prompt.trim() || !!pendingFallback}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-[0_0_15px_rgba(8,145,178,0.3)] hover:shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all"
              >
                {chatMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> EXECUTING...</>
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

          {/* Response Area */}
          <Card className="bg-slate-900/50 border-slate-800 shadow-xl shadow-black/40 min-h-[250px] flex flex-col">
            <CardHeader className="border-b border-slate-800/50 pb-4">
              <CardTitle className="text-base font-medium flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Response Log
                </div>
                {lastResponse && (
                  <Badge variant={lastResponse.status === 'success' ? 'default' : lastResponse.status === 'fallback' ? 'secondary' : 'destructive'} 
                    className={`
                      ${lastResponse.status === 'success' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30' : ''}
                      ${lastResponse.status === 'fallback' ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/20 border-amber-500/30' : ''}
                      ${lastResponse.status === 'blocked' ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/20 border-rose-500/30' : ''}
                    `}>
                    {lastResponse.status.toUpperCase()}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {!lastResponse ? (
                <div className="h-full flex items-center justify-center text-slate-500 font-mono text-sm py-12">
                  AWAITING INPUT...
                </div>
              ) : (
                <div className="p-4 flex flex-col gap-4 h-full">
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
                      <span className="text-xs font-mono text-white">{lastResponse.latencyMs}ms</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-slate-500">COST</span>
                      <span className="text-xs font-mono text-emerald-400">${lastResponse.cost.toFixed(6)}</span>
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
        </div>

        {/* Right Column: Stats & Logs */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          
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
                return (
                  <Card key={m} className="bg-slate-900/50 border-slate-800 shadow-lg">
                    <CardHeader className="p-3 pb-2 border-b border-slate-800/50">
                      <CardTitle className="text-xs font-mono text-slate-200 flex items-center justify-between gap-1">
                        <span className="truncate">{label}</span>
                        <div className="w-2 h-2 rounded-full bg-cyan-500/50 shrink-0" />
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
                        <span className="text-xs font-mono text-emerald-400">${ms.cost.toFixed(6)}</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

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

          {/* Bottom Row: Logs Table */}
          <Card className="bg-slate-900/50 border-slate-800 shadow-xl flex-1 flex flex-col overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-800/50 bg-slate-900">
              <CardTitle className="text-sm font-mono text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Traffic Log
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-slate-700 bg-slate-800 text-slate-400">
                  LAST 20 ENTRIES
                </Badge>
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
    </div>
  );
}
