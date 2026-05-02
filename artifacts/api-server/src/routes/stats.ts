import { Router, type IRouter } from "express";
import { getStats, getLogs } from "../lib/statsStore";

const router: IRouter = Router();

router.get("/stats", (_req, res): void => {
  res.json(getStats());
});

router.get("/logs", (_req, res): void => {
  res.json({ logs: getLogs() });
});

export default router;
