import { Router, type IRouter } from "express";
import { callModel, type ModelName, type ModelKeys } from "../lib/llmGateway";
import { detectPii } from "../lib/piiDetector";
import { z } from "zod";

const router: IRouter = Router();

const ModelKeysSchema = z
  .object({
    openai: z.string().optional(),
    gemini: z.string().optional(),
    anthropic: z.string().optional(),
  })
  .optional();

const CompareBody = z.object({
  prompt: z.string().min(1),
  modelKeys: ModelKeysSchema,
});

const ALL_MODELS: ModelName[] = ["openai", "gemini", "claude", "claude-opus"];

router.post("/compare", async (req, res): Promise<void> => {
  const parsed = CompareBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, modelKeys } = parsed.data;

  const piiMatches = detectPii(prompt);
  if (piiMatches.length > 0) {
    res.status(400).json({
      error: "PII detected in prompt",
      piiMatches,
    });
    return;
  }

  const settled = await Promise.allSettled(
    ALL_MODELS.map((model) => callModel(model, prompt, modelKeys as ModelKeys)),
  );

  const results: Record<string, object> = {};
  for (let i = 0; i < ALL_MODELS.length; i++) {
    const model = ALL_MODELS[i];
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      const r = outcome.value;
      results[model] = {
        response: r.response,
        tokens: r.tokens,
        cost: r.cost,
        latencyMs: r.latencyMs,
        status: "success",
        error: null,
      };
    } else {
      const msg =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason);
      results[model] = {
        response: null,
        tokens: 0,
        cost: 0,
        latencyMs: 0,
        status: "error",
        error: msg,
      };
    }
  }

  res.json({ results });
});

export default router;
