import { Router, type IRouter } from "express";
import { isRateLimited } from "../lib/rateLimiter";
import { callWithFallback, AllModelsFailedError, type ModelName } from "../lib/llmGateway";
import { recordRequest } from "../lib/statsStore";
import { ChatBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, model } = parsed.data;
  const rateLimitKey = parsed.data.apiKey ?? model;

  if (isRateLimited(rateLimitKey)) {
    recordRequest({
      model: model as ModelName,
      modelUsed: model as ModelName,
      tokens: 0,
      cost: 0,
      latencyMs: 0,
      status: "blocked",
      promptSnippet: prompt.slice(0, 80),
      errorMessage: "Rate limit exceeded (max 10 requests/min)",
    });
    res.status(429).json({ error: "Rate limit exceeded (max 10 requests/min)" });
    return;
  }

  try {
    const result = await callWithFallback(model as ModelName, prompt, new Set());
    const status = result.fallback ? "fallback" : "success";

    recordRequest({
      model: model as ModelName,
      modelUsed: result.modelUsed,
      tokens: result.tokens,
      cost: result.cost,
      latencyMs: result.latencyMs,
      status,
      promptSnippet: prompt.slice(0, 80),
    });

    res.json({
      response: result.response,
      model,
      modelUsed: result.modelUsed,
      fallback: result.fallback,
      tokens: result.tokens,
      cost: result.cost,
      latencyMs: result.latencyMs,
      status,
      errorMessage: null,
    });
  } catch (err) {
    const errorMessage =
      err instanceof AllModelsFailedError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";

    recordRequest({
      model: model as ModelName,
      modelUsed: model as ModelName,
      tokens: 0,
      cost: 0,
      latencyMs: 0,
      status: "error",
      promptSnippet: prompt.slice(0, 80),
      errorMessage,
    });

    res.status(500).json({ error: errorMessage });
  }
});

export default router;
