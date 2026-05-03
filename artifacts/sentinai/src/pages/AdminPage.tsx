import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Shield, Users, TrendingUp, Coins, ArrowLeft, Crown, Zap, Database, BarChart3, LogOut, ChevronRight, Sun, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AuthUser } from "@/hooks/useAuth";
import { getToken } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const MODEL_COLORS: Record<string, string> = {
  openai: "text-emerald-400",
  gemini: "text-blue-400",
  claude: "text-violet-400",
  "claude-opus": "text-purple-400",
};

const MODEL_BG: Record<string, string> = {
  openai: "bg-emerald-500/20 border-emerald-500/30",
  gemini: "bg-blue-500/20 border-blue-500/30",
  claude: "bg-violet-500/20 border-violet-500/30",
  "claude-opus": "bg-purple-500/20 border-purple-500/30",
};

const MODEL_LABELS: Record<string, string> = {
  openai: "GPT-4o",
  gemini: "Gemini 1.5",
  claude: "Claude 3.5",
  "claude-opus": "Claude Opus",
};

const RANK_ICONS = ["🥇", "🥈", "🥉"];

interface AdminStats {
  users: Array<{
    userId: string;
    username: string;
    createdAt: string;
    totalRequests: number;
    blockedRequests: number;
    totalTokens: number;
    totalCost: number;
    topModel: string | null;
    modelBreakdown: Record<string, { requests: number; cost: number; tokens: number }>;
  }>;
  global: {
    totalUsers: number;
    totalRequests: number;
    blockedRequests: number;
    totalTokens: number;
    totalCost: number;
    models: Record<string, { requests: number; cost: number; tokens: number; avgLatencyMs: number }>;
    mostPopularModel: string | null;
  };
  revenue: {
    totalCost: number;
    markupPercent: number;
    margin: number;
    projectedRevenue: number;
    perUser: Array<{ userId: string; username: string; cost: number; revenue: number }>;
  };
  cache: { size: number; threshold: number; ttlMinutes: number };
}

async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch(`${BASE}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch admin stats");
  return res.json();
}

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export default function AdminPage({ user, onLogout }: Props) {
  const { theme, toggleTheme } = useTheme();

  const { data, isLoading, error } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
    refetchInterval: 10000,
  });

  const allModels = ["openai", "gemini", "claude", "claude-opus"];
  const modelsSorted = data
    ? allModels
        .map((m) => ({ model: m, ...data.global.models[m] }))
        .sort((a, b) => b.requests - a.requests)
    : [];
  const totalGlobalRequests = modelsSorted.reduce((s, m) => s + m.requests, 0);

  return (
    <div className="sentinai-root min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 transition-colors text-xs font-mono">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Gateway
            </button>
          </Link>
          <div className="w-px h-5 bg-slate-800" />
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                Admin Dashboard
                <Badge className="text-[9px] font-mono bg-amber-500/20 text-amber-400 border-amber-500/30">INTERNAL</Badge>
              </h1>
              <p className="text-[10px] text-slate-500 font-mono">Multi-tenant overview</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-mono text-slate-400">
          <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-[11px]">
            <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-amber-300">{user.username}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleTheme}
            className="h-8 w-8 p-0 hover:bg-slate-800 hover:text-amber-400 text-slate-500 transition-colors">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout} title="Sign out"
            className="h-8 w-8 p-0 hover:bg-slate-800 hover:text-rose-400 text-slate-500 transition-colors">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full flex flex-col gap-6">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-slate-500 font-mono text-sm">
            Loading admin stats…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-4 text-rose-400 font-mono text-sm">
            Failed to load admin stats. Make sure you have access.
          </div>
        )}

        {data && (
          <>
            {/* Top stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Total Users</span>
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <span className="text-2xl font-bold font-mono text-white">{data.global.totalUsers}</span>
                  <span className="text-[10px] font-mono text-slate-500">{data.global.totalRequests} total requests</span>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Total Tokens</span>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-2xl font-bold font-mono text-white">{data.global.totalTokens.toLocaleString()}</span>
                  <span className="text-[10px] font-mono text-slate-500">{data.global.blockedRequests} blocked</span>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">API Cost</span>
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-2xl font-bold font-mono text-emerald-400">${data.revenue.totalCost.toFixed(4)}</span>
                  <span className="text-[10px] font-mono text-slate-500">real provider cost</span>
                </CardContent>
              </Card>

              <Card className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-amber-500/70 uppercase tracking-wider">Projected Revenue</span>
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-2xl font-bold font-mono text-amber-400">${data.revenue.projectedRevenue.toFixed(4)}</span>
                  <span className="text-[10px] font-mono text-amber-500/60">+{data.revenue.markupPercent}% markup · +${data.revenue.margin.toFixed(4)} margin</span>
                </CardContent>
              </Card>
            </div>

            {/* Middle row: Users table + Model leaderboard */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              {/* Users table */}
              <Card className="bg-slate-900/50 border-slate-800 xl:col-span-3">
                <CardHeader className="border-b border-slate-800/50 py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    User Spend ({data.users.length} accounts)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {data.users.length === 0 ? (
                    <div className="py-10 text-center text-slate-500 font-mono text-sm">No users yet</div>
                  ) : (
                    <ScrollArea className="max-h-[360px]">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-800/50">
                            <th className="text-left text-[9px] font-mono text-slate-500 uppercase tracking-wider px-4 py-2">#</th>
                            <th className="text-left text-[9px] font-mono text-slate-500 uppercase tracking-wider px-4 py-2">User</th>
                            <th className="text-right text-[9px] font-mono text-slate-500 uppercase tracking-wider px-4 py-2">Requests</th>
                            <th className="text-right text-[9px] font-mono text-slate-500 uppercase tracking-wider px-4 py-2">Tokens</th>
                            <th className="text-right text-[9px] font-mono text-slate-500 uppercase tracking-wider px-4 py-2">Cost</th>
                            <th className="text-right text-[9px] font-mono text-slate-500 uppercase tracking-wider px-4 py-2">Revenue</th>
                            <th className="text-center text-[9px] font-mono text-slate-500 uppercase tracking-wider px-4 py-2">Top Model</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.users.map((u, i) => {
                            const revenue = u.totalCost * 1.2;
                            return (
                              <tr key={u.userId} className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-2.5 text-[11px] font-mono text-slate-500">{i + 1}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-[10px] font-mono font-bold text-cyan-400 shrink-0">
                                      {u.username[0]?.toUpperCase() ?? "?"}
                                    </div>
                                    <div>
                                      <span className="text-xs font-mono text-slate-200">{u.username}</span>
                                      {i === 0 && u.totalCost > 0 && (
                                        <span className="ml-1.5 text-[9px] font-mono text-amber-400">TOP SPENDER</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-right text-[11px] font-mono text-slate-300">{u.totalRequests}</td>
                                <td className="px-4 py-2.5 text-right text-[11px] font-mono text-slate-300">{u.totalTokens.toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-right text-[11px] font-mono text-emerald-400">${u.totalCost.toFixed(5)}</td>
                                <td className="px-4 py-2.5 text-right text-[11px] font-mono text-amber-400">${revenue.toFixed(5)}</td>
                                <td className="px-4 py-2.5 text-center">
                                  {u.topModel ? (
                                    <Badge className={`text-[9px] font-mono ${MODEL_BG[u.topModel] ?? "bg-slate-700 border-slate-600"} ${MODEL_COLORS[u.topModel] ?? "text-slate-300"}`}>
                                      {MODEL_LABELS[u.topModel] ?? u.topModel}
                                    </Badge>
                                  ) : (
                                    <span className="text-[10px] font-mono text-slate-600">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Model leaderboard */}
              <Card className="bg-slate-900/50 border-slate-800 xl:col-span-2">
                <CardHeader className="border-b border-slate-800/50 py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    Global Model Popularity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex flex-col gap-3">
                  {modelsSorted.map((m, i) => {
                    const pct = totalGlobalRequests > 0 ? (m.requests / totalGlobalRequests) * 100 : 0;
                    const isTop = i === 0 && m.requests > 0;
                    return (
                      <div key={m.model} className={`rounded-lg border p-3 flex flex-col gap-2 ${isTop ? "border-amber-500/30 bg-amber-500/5" : "border-slate-800 bg-slate-950/40"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{RANK_ICONS[i] ?? "·"}</span>
                            <span className={`text-xs font-mono font-semibold ${MODEL_COLORS[m.model] ?? "text-slate-300"}`}>
                              {MODEL_LABELS[m.model] ?? m.model}
                            </span>
                            {isTop && (
                              <Crown className="w-3 h-3 text-amber-400" />
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">{m.requests} req</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                              m.model === "openai" ? "bg-emerald-500" :
                              m.model === "gemini" ? "bg-blue-500" :
                              m.model === "claude" ? "bg-violet-500" : "bg-purple-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] font-mono text-slate-500">
                          <span>{pct.toFixed(1)}% share</span>
                          <span>${m.cost.toFixed(5)} · {m.tokens.toLocaleString()} tok</span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Bottom row: Revenue breakdown + Cache stats */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Revenue breakdown */}
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader className="border-b border-slate-800/50 py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    Revenue Projection (20% markup)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex flex-col gap-4">
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">API Cost</span>
                      <span className="text-sm font-mono font-bold text-slate-200">${data.revenue.totalCost.toFixed(5)}</span>
                      <span className="text-[9px] font-mono text-slate-600">provider charges</span>
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1">
                        <ChevronRight className="w-5 h-5 text-amber-400" />
                        <span className="text-[9px] font-mono text-amber-400">+20%</span>
                      </div>
                    </div>
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-amber-500/70 uppercase tracking-wider">Revenue</span>
                      <span className="text-sm font-mono font-bold text-amber-400">${data.revenue.projectedRevenue.toFixed(5)}</span>
                      <span className="text-[9px] font-mono text-amber-500/50">+${data.revenue.margin.toFixed(5)} margin</span>
                    </div>
                  </div>

                  {/* Per-user revenue */}
                  {data.revenue.perUser.filter(u => u.cost > 0).length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Revenue per User</span>
                      {data.revenue.perUser
                        .filter(u => u.cost > 0)
                        .map((u) => (
                          <div key={u.userId} className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-[9px] font-mono font-bold text-cyan-400 shrink-0">
                              {u.username[0]?.toUpperCase() ?? "?"}
                            </div>
                            <span className="text-[11px] font-mono text-slate-300 w-24 truncate">{u.username}</span>
                            <div className="flex-1 bg-slate-800 rounded-full h-1 overflow-hidden">
                              <div
                                className="h-1 bg-amber-500/60 rounded-full"
                                style={{ width: data.revenue.projectedRevenue > 0 ? `${(u.revenue / data.revenue.projectedRevenue) * 100}%` : "0%" }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-amber-400 w-16 text-right">${u.revenue.toFixed(5)}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 font-mono text-xs py-4">No billable activity yet</div>
                  )}
                </CardContent>
              </Card>

              {/* Cache + System stats */}
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader className="border-b border-slate-800/50 py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    System Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Cache Entries</span>
                      <span className="text-lg font-mono font-bold text-cyan-400">{data.cache.size}</span>
                      <span className="text-[9px] font-mono text-slate-600">/ 500 max · {data.cache.ttlMinutes}min TTL</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Cache Threshold</span>
                      <span className="text-lg font-mono font-bold text-cyan-400">{Math.round(data.cache.threshold * 100)}%</span>
                      <span className="text-[9px] font-mono text-slate-600">TF-IDF cosine similarity</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Total Blocked</span>
                      <span className="text-lg font-mono font-bold text-rose-400">{data.global.blockedRequests}</span>
                      <span className="text-[9px] font-mono text-slate-600">PII + injection + rate limit</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Success Rate</span>
                      <span className="text-lg font-mono font-bold text-emerald-400">
                        {data.global.totalRequests > 0
                          ? `${Math.round(((data.global.totalRequests - data.global.blockedRequests) / data.global.totalRequests) * 100)}%`
                          : "—"}
                      </span>
                      <span className="text-[9px] font-mono text-slate-600">across all tenants</span>
                    </div>
                  </div>

                  {/* Model cost breakdown */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Cost by Model</span>
                    {allModels.map((m) => {
                      const stats = data.global.models[m];
                      const costPct = data.global.totalCost > 0 ? (stats.cost / data.global.totalCost) * 100 : 0;
                      return (
                        <div key={m} className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono w-20 shrink-0 ${MODEL_COLORS[m] ?? "text-slate-400"}`}>{MODEL_LABELS[m]}</span>
                          <div className="flex-1 bg-slate-800 rounded-full h-1 overflow-hidden">
                            <div
                              className={`h-1 rounded-full ${
                                m === "openai" ? "bg-emerald-500" :
                                m === "gemini" ? "bg-blue-500" :
                                m === "claude" ? "bg-violet-500" : "bg-purple-500"
                              }`}
                              style={{ width: `${costPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 w-16 text-right">${stats.cost.toFixed(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
