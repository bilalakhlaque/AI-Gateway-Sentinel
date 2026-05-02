import { Router, type IRouter } from "express";
import { getStats, getLogs, getTenants } from "../lib/statsStore";

const router: IRouter = Router();

router.get("/stats", (req, res): void => {
  const userId = res.locals["userId"] as string;
  res.json(getStats(userId));
});

router.get("/logs", (req, res): void => {
  const userId = res.locals["userId"] as string;
  res.json({ logs: getLogs(userId) });
});

router.get("/tenants", (_req, res): void => {
  res.json({ tenants: getTenants() });
});

export default router;
