import { Router, type IRouter } from "express";
import { getModelHealth } from "../lib/statsStore";

const router: IRouter = Router();

router.get("/health/models", (_req, res): void => {
  res.json({ models: getModelHealth(), timestamp: new Date().toISOString() });
});

export default router;
