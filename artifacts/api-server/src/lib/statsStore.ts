export type ModelName = "openai" | "gemini" | "claude" | "claude-opus";

export type RequestStatus = "success" | "fallback" | "blocked" | "error";

interface ModelStats {
  requests: number;
  tokens: number;
  cost: number;
  totalLatencyMs: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  model: ModelName;
  modelUsed: ModelName;
  tokens: number;
  cost: number;
  latencyMs: number;
  status: RequestStatus;
  promptSnippet: string;
  errorMessage?: string | null;
}

const modelStats: Record<ModelName, ModelStats> = {
  openai: { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
  gemini: { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
  claude: { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
  "claude-opus": { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
};

let totalRequests = 0;
let blockedRequests = 0;
const logs: LogEntry[] = [];

export function recordRequest(entry: {
  model: ModelName;
  modelUsed: ModelName;
  tokens: number;
  cost: number;
  latencyMs: number;
  status: RequestStatus;
  promptSnippet: string;
  errorMessage?: string | null;
}): void {
  totalRequests++;
  if (entry.status === "blocked" || entry.status === "error") {
    blockedRequests++;
  } else {
    const s = modelStats[entry.modelUsed];
    s.requests++;
    s.tokens += entry.tokens;
    s.cost += entry.cost;
    s.totalLatencyMs += entry.latencyMs;
  }

  const logEntry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  logs.unshift(logEntry);
  if (logs.length > 20) logs.pop();
}

export function getStats() {
  const buildModel = (name: ModelName) => {
    const s = modelStats[name];
    return {
      requests: s.requests,
      tokens: s.tokens,
      cost: s.cost,
      totalLatencyMs: s.totalLatencyMs,
      avgLatencyMs: s.requests > 0 ? s.totalLatencyMs / s.requests : 0,
    };
  };

  return {
    totalRequests,
    blockedRequests,
    models: {
      openai: buildModel("openai"),
      gemini: buildModel("gemini"),
      claude: buildModel("claude"),
      "claude-opus": buildModel("claude-opus"),
    },
  };
}

export function getLogs(): LogEntry[] {
  return logs;
}
