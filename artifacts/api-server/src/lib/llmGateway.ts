import { logger } from "./logger";

export type ModelName = "openai" | "gemini" | "claude" | "claude-opus";

export const FALLBACK_NEXT: Record<ModelName, ModelName | null> = {
  openai: "gemini",
  gemini: "claude",
  claude: "claude-opus",
  "claude-opus": null,
};

const COST_PER_TOKEN: Record<ModelName, number> = {
  openai: 0.000015,
  gemini: 0.000007,
  claude: 0.000018,
  "claude-opus": 0.000075,
};

export interface ModelKeys {
  openai?: string;
  gemini?: string;
  anthropic?: string;
}

export interface LLMResult {
  response: string;
  modelUsed: ModelName;
  tokens: number;
  cost: number;
  latencyMs: number;
}

async function callOpenAI(
  prompt: string,
  apiKey?: string,
): Promise<{ text: string; tokens: number }> {
  const key = apiKey || process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { total_tokens: number };
  };

  return {
    text: data.choices[0]?.message?.content ?? "",
    tokens: data.usage?.total_tokens ?? 0,
  };
}

async function callGemini(
  prompt: string,
  apiKey?: string,
): Promise<{ text: string; tokens: number }> {
  const key = apiKey || process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    usageMetadata?: { totalTokenCount: number };
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const tokens =
    data.usageMetadata?.totalTokenCount ?? Math.ceil(prompt.length / 4);
  return { text, tokens };
}

async function callClaude(
  prompt: string,
  apiKey?: string,
): Promise<{ text: string; tokens: number }> {
  const key = apiKey || process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const text = data.content?.[0]?.text ?? "";
  const tokens =
    (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
  return { text, tokens };
}

async function callClaudeOpus(
  prompt: string,
  apiKey?: string,
): Promise<{ text: string; tokens: number }> {
  const key = apiKey || process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude Opus ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const text = data.content?.[0]?.text ?? "";
  const tokens =
    (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
  return { text, tokens };
}

const callers: Record<
  ModelName,
  (
    prompt: string,
    apiKey?: string,
  ) => Promise<{ text: string; tokens: number }>
> = {
  openai: callOpenAI,
  gemini: callGemini,
  claude: callClaude,
  "claude-opus": callClaudeOpus,
};

function resolveKey(model: ModelName, keys?: ModelKeys): string | undefined {
  if (!keys) return undefined;
  if (model === "openai") return keys.openai || undefined;
  if (model === "gemini") return keys.gemini || undefined;
  if (model === "claude" || model === "claude-opus")
    return keys.anthropic || undefined;
  return undefined;
}

export async function callModel(
  model: ModelName,
  prompt: string,
  modelKeys?: ModelKeys,
): Promise<LLMResult> {
  const start = Date.now();
  try {
    const key = resolveKey(model, modelKeys);
    const result = await callers[model](prompt, key);
    const latencyMs = Date.now() - start;
    const cost = result.tokens * COST_PER_TOKEN[model];
    return {
      response: result.text,
      modelUsed: model,
      tokens: result.tokens,
      cost,
      latencyMs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ model, err: msg }, "Model call failed");
    throw err;
  }
}
