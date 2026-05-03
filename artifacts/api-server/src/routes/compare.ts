import { Router, type IRouter } from "express";
import { callModel, FALLBACK_NEXT, type ModelName, type ModelKeys } from "../lib/llmGateway";
import { recordRequest, getModelCost } from "../lib/statsStore";
import { detectPii } from "../lib/piiDetector";
import { detectPromptInjection } from "../lib/promptInjectionDetector";
import { checkCache, addToCache } from "../lib/semanticCache";
import { z } from "zod";

const router: IRouter = Router();

const ModelKeysSchema = z
  .object({
    openai: z.string().optional(),
    gemini: z.string().optional(),
    anthropic: z.string().optional(),
  })
  .optional();

const BudgetMapSchema = z
  .object({
    openai: z.number().optional(),
    gemini: z.number().optional(),
    claude: z.number().optional(),
    "claude-opus": z.number().optional(),
  })
  .optional();

const CompareBody = z.object({
  prompt: z.string().min(1),
  budgets: BudgetMapSchema,
  modelKeys: ModelKeysSchema,
});

const ALL_MODELS: ModelName[] = ["openai", "gemini", "claude", "claude-opus"];

router.post("/compare", async (req, res): Promise<void> => {
  const parsed = CompareBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, modelKeys, budgets } = parsed.data;
  const tenantId = res.locals["userId"] as string;

  const piiMatches = detectPii(prompt);
  if (piiMatches.length > 0) {
    res.status(400).json({ error: "PII detected in prompt", blocked: true, reason: "pii", piiMatches });
    return;
  }

  const injectionMatches = detectPromptInjection(prompt);
  if (injectionMatches.length > 0) {
    res.status(400).json({ error: "Prompt injection detected", blocked: true, reason: "injection", injectionMatches });
    return;
  }

  type ModelResult =
    | { fromCache: true; response: string; tokens: number; cost: number; latencyMs: number; similarity: number; originalPrompt: string; modelUsed: ModelName }
    | { fromCache: false; response: string; tokens: number; cost: number; latencyMs: number; modelUsed: ModelName };

  const settled = await Promise.allSettled(
    ALL_MODELS.map(async (model): Promise<ModelResult> => {
      const modelBudget = budgets?.[model as keyof typeof budgets];
      if (modelBudget !== undefined && getModelCost(tenantId, model) >= modelBudget) {
        throw new Error(`Budget limit of $${modelBudget.toFixed(4)} reached for ${model}`);
      }

      const hit = checkCache(prompt, model);
      if (hit) {
        recordRequest(tenantId, {
          model, modelUsed: model, tokens: 0, cost: 0, latencyMs: 0,
          status: "cached", promptSnippet: prompt.slice(0, 80), responseText: hit.response,
        });
        return { fromCache: true, response: hit.response, tokens: hit.tokens, cost: hit.cost, latencyMs: hit.latencyMs, similarity: hit.similarity, originalPrompt: hit.originalPrompt, modelUsed: model };
      }

      const r = await callModel(model, prompt, modelKeys as ModelKeys);
      addToCache(prompt, model, r.response, r.tokens, r.cost, r.latencyMs);
      return { fromCache: false, response: r.response, tokens: r.tokens, cost: r.cost, latencyMs: r.latencyMs, modelUsed: r.modelUsed };
    }),
  );

  const results: Record<string, object> = {};
  for (let i = 0; i < ALL_MODELS.length; i++) {
    const model = ALL_MODELS[i]!;
    const outcome = settled[i]!;
    if (outcome.status === "fulfilled") {
      const r = outcome.value;
      results[model] = {
        response: r.response,
        tokens: r.tokens,
        cost: r.cost,
        latencyMs: r.latencyMs,
        status: r.fromCache ? "cached" : "success",
        error: null,
        cached: r.fromCache,
        cacheHit: r.fromCache
          ? { similarity: r.similarity, originalPrompt: r.originalPrompt }
          : null,
      };
      if (!r.fromCache) {
        recordRequest(tenantId, {
          model, modelUsed: r.modelUsed, tokens: r.tokens, cost: r.cost, latencyMs: r.latencyMs,
          status: "success", promptSnippet: prompt.slice(0, 80), responseText: r.response,
        });
      }
    } else {
      const msg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      results[model] = { response: null, tokens: 0, cost: 0, latencyMs: 0, status: "error", error: msg, cached: false, cacheHit: null };
      recordRequest(tenantId, {
        model, modelUsed: model, tokens: 0, cost: 0, latencyMs: 0,
        status: "error", promptSnippet: prompt.slice(0, 80), errorMessage: msg,
      });
    }
  }

  res.json({ results });
});

export default router;
