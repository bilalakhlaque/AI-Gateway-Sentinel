import { logger } from "./logger";

export type ModelName = "openai" | "gemini" | "claude";

const MODEL_ORDER: ModelName[] = ["openai", "gemini", "claude"];

const COST_PER_TOKEN: Record<ModelName, number> = {
  openai: 0.000015,
  gemini: 0.000007,
  claude: 0.000018,
};

export interface LLMResult {
  response: string;
  modelUsed: ModelName;
  tokens: number;
  cost: number;
  latencyMs: number;
  fallback: boolean;
}

async function callOpenAI(prompt: string): Promise<{ text: string; tokens: number }> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
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

async function callGemini(prompt: string): Promise<{ text: string; tokens: number }> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    usageMetadata?: { totalTokenCount: number };
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const tokens = data.usageMetadata?.totalTokenCount ?? Math.ceil(prompt.length / 4);
  return { text, tokens };
}

async function callClaude(prompt: string): Promise<{ text: string; tokens: number }> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const text = data.content?.[0]?.text ?? "";
  const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
  return { text, tokens };
}

const callers: Record<ModelName, (prompt: string) => Promise<{ text: string; tokens: number }>> = {
  openai: callOpenAI,
  gemini: callGemini,
  claude: callClaude,
};

export async function callWithFallback(
  requestedModel: ModelName,
  prompt: string,
  unavailable: Set<ModelName>,
): Promise<LLMResult> {
  const order = [requestedModel, ...MODEL_ORDER.filter((m) => m !== requestedModel)];
  const candidates = order.filter((m) => !unavailable.has(m));

  for (const model of candidates) {
    const start = Date.now();
    try {
      const result = await callers[model](prompt);
      const latencyMs = Date.now() - start;
      const tokens = result.tokens;
      const cost = tokens * COST_PER_TOKEN[model];
      return {
        response: result.text,
        modelUsed: model,
        tokens,
        cost,
        latencyMs,
        fallback: model !== requestedModel,
      };
    } catch (err) {
      logger.warn({ model, err }, "Model call failed, trying next");
    }
  }

  throw new Error("All models failed or unavailable");
}
