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
  tenantId: string;
  model: ModelName;
  modelUsed: ModelName;
  tokens: number;
  cost: number;
  latencyMs: number;
  status: RequestStatus;
  promptSnippet: string;
  responseText?: string | null;
  errorMessage?: string | null;
}

interface TenantBucket {
  modelStats: Record<ModelName, ModelStats>;
  totalRequests: number;
  blockedRequests: number;
  logs: LogEntry[];
}

const tenants = new Map<string, TenantBucket>();

function freshBucket(): TenantBucket {
  return {
    modelStats: {
      openai: { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
      gemini: { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
      claude: { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
      "claude-opus": { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
    },
    totalRequests: 0,
    blockedRequests: 0,
    logs: [],
  };
}

function getBucket(tenantId: string): TenantBucket {
  if (!tenants.has(tenantId)) tenants.set(tenantId, freshBucket());
  return tenants.get(tenantId)!;
}

export function recordRequest(
  tenantId: string,
  entry: {
    model: ModelName;
    modelUsed: ModelName;
    tokens: number;
    cost: number;
    latencyMs: number;
    status: RequestStatus;
    promptSnippet: string;
    responseText?: string | null;
    errorMessage?: string | null;
  },
): void {
  const bucket = getBucket(tenantId);
  bucket.totalRequests++;
  if (entry.status === "blocked" || entry.status === "error") {
    bucket.blockedRequests++;
  } else {
    const s = bucket.modelStats[entry.modelUsed];
    s.requests++;
    s.tokens += entry.tokens;
    s.cost += entry.cost;
    s.totalLatencyMs += entry.latencyMs;
  }

  const logEntry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    tenantId,
    ...entry,
  };

  bucket.logs.unshift(logEntry);
  if (bucket.logs.length > 20) bucket.logs.pop();
}

function buildModelStats(name: ModelName, s: ModelStats) {
  return {
    requests: s.requests,
    tokens: s.tokens,
    cost: s.cost,
    totalLatencyMs: s.totalLatencyMs,
    avgLatencyMs: s.requests > 0 ? s.totalLatencyMs / s.requests : 0,
  };
}

export function getStats(tenantId?: string) {
  if (tenantId) {
    const bucket = getBucket(tenantId);
    return {
      totalRequests: bucket.totalRequests,
      blockedRequests: bucket.blockedRequests,
      models: {
        openai: buildModelStats("openai", bucket.modelStats.openai),
        gemini: buildModelStats("gemini", bucket.modelStats.gemini),
        claude: buildModelStats("claude", bucket.modelStats.claude),
        "claude-opus": buildModelStats("claude-opus", bucket.modelStats["claude-opus"]),
      },
    };
  }

  const agg: Record<ModelName, ModelStats> = {
    openai: { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
    gemini: { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
    claude: { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
    "claude-opus": { requests: 0, tokens: 0, cost: 0, totalLatencyMs: 0 },
  };
  let totalRequests = 0;
  let blockedRequests = 0;

  for (const bucket of tenants.values()) {
    totalRequests += bucket.totalRequests;
    blockedRequests += bucket.blockedRequests;
    for (const model of ["openai", "gemini", "claude", "claude-opus"] as ModelName[]) {
      agg[model].requests += bucket.modelStats[model].requests;
      agg[model].tokens += bucket.modelStats[model].tokens;
      agg[model].cost += bucket.modelStats[model].cost;
      agg[model].totalLatencyMs += bucket.modelStats[model].totalLatencyMs;
    }
  }

  return {
    totalRequests,
    blockedRequests,
    models: {
      openai: buildModelStats("openai", agg.openai),
      gemini: buildModelStats("gemini", agg.gemini),
      claude: buildModelStats("claude", agg.claude),
      "claude-opus": buildModelStats("claude-opus", agg["claude-opus"]),
    },
  };
}

export function getLogs(tenantId?: string): LogEntry[] {
  if (tenantId) {
    return getBucket(tenantId).logs;
  }
  const all: LogEntry[] = [];
  for (const bucket of tenants.values()) {
    all.push(...bucket.logs);
  }
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 20);
}

export function getTenants() {
  const result: Array<{
    tenantId: string;
    totalRequests: number;
    blockedRequests: number;
    totalCost: number;
    totalTokens: number;
  }> = [];

  for (const [tenantId, bucket] of tenants.entries()) {
    let totalCost = 0;
    let totalTokens = 0;
    for (const model of ["openai", "gemini", "claude", "claude-opus"] as ModelName[]) {
      totalCost += bucket.modelStats[model].cost;
      totalTokens += bucket.modelStats[model].tokens;
    }
    result.push({
      tenantId,
      totalRequests: bucket.totalRequests,
      blockedRequests: bucket.blockedRequests,
      totalCost,
      totalTokens,
    });
  }

  return result.sort((a, b) => b.totalRequests - a.totalRequests);
}
