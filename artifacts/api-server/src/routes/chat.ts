import { Router, type IRouter } from "express";
import { isRateLimited } from "../lib/rateLimiter";
import { callModel, FALLBACK_NEXT, type ModelName, type ModelKeys } from "../lib/llmGateway";
import { recordRequest, getModelCost } from "../lib/statsStore";
import { detectPii } from "../lib/piiDetector";
import { detectPromptInjection } from "../lib/promptInjectionDetector";
import { ChatBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, model } = parsed.data;
  const modelKeys = (parsed.data as any).modelKeys as ModelKeys | undefined;
  const tenantId: string = res.locals["userId"] as string;
  const budgets: Record<string, number> | undefined = (parsed.data as any).budgets;
  const rateLimitKey = parsed.data.apiKey ?? model;

  const piiMatches = detectPii(prompt);
  if (piiMatches.length > 0) {
    res.status(400).json({ error: "PII detected in prompt", blocked: true, reason: "pii", piiMatches });
    return;
  }

  const injectionMatches = detectPromptInjection(prompt);
  if (injectionMatches.length > 0) {
    recordRequest(tenantId, {
      model: model as ModelName,
      modelUsed: model as ModelName,
      tokens: 0,
      cost: 0,
      latencyMs: 0,
      status: "blocked",
      promptSnippet: prompt.slice(0, 80),
      errorMessage: `Prompt injection blocked: ${injectionMatches.map((m) => m.type).join(", ")}`,
    });
    res.status(400).json({ error: "Prompt injection detected", blocked: true, reason: "injection", injectionMatches });
    return;
  }

  if (isRateLimited(tenantId, rateLimitKey)) {
    recordRequest(tenantId, {
      model: model as ModelName,
      modelUsed: model as ModelName,
      tokens: 0,
      cost: 0,
      latencyMs: 0,
      status: "blocked",
      promptSnippet: prompt.slice(0, 80),
      errorMessage: "Rate limit exceeded (max 10 requests/min)",
    });
    res.status(429).json({ error: "Rate limit exceeded (max 10 requests/min)", suggestedFallback: null });
    return;
  }

  const modelBudget = budgets?.[model];
  if (modelBudget !== undefined && getModelCost(tenantId, model as ModelName) >= modelBudget) {
    const suggestedFallback = FALLBACK_NEXT[model as ModelName] ?? null;
    recordRequest(tenantId, {
      model: model as ModelName,
      modelUsed: model as ModelName,
      tokens: 0,
      cost: 0,
      latencyMs: 0,
      status: "blocked",
      promptSnippet: prompt.slice(0, 80),
      errorMessage: `Budget limit of $${modelBudget.toFixed(4)} reached for ${model}`,
    });
    res.status(503).json({
      error: `Budget limit of $${modelBudget.toFixed(4)} reached for ${model}`,
      suggestedFallback,
    });
    return;
  }

  try {
    const result = await callModel(model as ModelName, prompt, modelKeys);

    recordRequest(tenantId, {
      model: model as ModelName,
      modelUsed: result.modelUsed,
      tokens: result.tokens,
      cost: result.cost,
      latencyMs: result.latencyMs,
      status: "success",
      promptSnippet: prompt.slice(0, 80),
      responseText: result.response,
    });

    res.json({
      response: result.response,
      model,
      modelUsed: result.modelUsed,
      fallback: false,
      tokens: result.tokens,
      cost: result.cost,
      latencyMs: result.latencyMs,
      status: "success",
      errorMessage: null,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const suggestedFallback = FALLBACK_NEXT[model as ModelName] ?? null;

    recordRequest(tenantId, {
      model: model as ModelName,
      modelUsed: model as ModelName,
      tokens: 0,
      cost: 0,
      latencyMs: 0,
      status: "error",
      promptSnippet: prompt.slice(0, 80),
      errorMessage,
    });

    res.status(503).json({ error: errorMessage, suggestedFallback });
  }
});

export default router;
