import { Router, type IRouter } from "express";
import { getStats, getLogs, getTenants } from "../lib/statsStore";

const router: IRouter = Router();

router.get("/stats", (req, res): void => {
  const tenantId = req.query.tenantId as string | undefined;
  res.json(getStats(tenantId));
});

router.get("/logs", (req, res): void => {
  const tenantId = req.query.tenantId as string | undefined;
  res.json({ logs: getLogs(tenantId) });
});

router.get("/tenants", (_req, res): void => {
  res.json({ tenants: getTenants() });
});

export default router;
