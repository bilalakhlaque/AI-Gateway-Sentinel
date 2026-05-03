import { Router, type IRouter } from "express";
import { getAllUsers } from "../lib/userStore";
import { getTenants, getStats, type ModelName } from "../lib/statsStore";
import { getCacheStats } from "../lib/semanticCache";

const router: IRouter = Router();

const MARKUP = 0.2;
const ALL_MODELS: ModelName[] = ["openai", "gemini", "claude", "claude-opus"];

router.get("/admin/stats", (req, res): void => {
  const allUsers = getAllUsers();
  const allTenants = getTenants();
  const globalStats = getStats();

  const users = allUsers
    .map((user) => {
      const tenant = allTenants.find((t) => t.tenantId === user.userId);
      const userStats = getStats(user.userId);

      let topModel: ModelName | null = null;
      let topModelRequests = 0;
      const modelBreakdown: Record<ModelName, { requests: number; cost: number; tokens: number }> = {
        openai: { requests: 0, cost: 0, tokens: 0 },
        gemini: { requests: 0, cost: 0, tokens: 0 },
        claude: { requests: 0, cost: 0, tokens: 0 },
        "claude-opus": { requests: 0, cost: 0, tokens: 0 },
      };

      for (const model of ALL_MODELS) {
        const m = userStats.models[model];
        modelBreakdown[model] = { requests: m.requests, cost: m.cost, tokens: m.tokens };
        if (m.requests > topModelRequests) {
          topModelRequests = m.requests;
          topModel = model;
        }
      }

      return {
        userId: user.userId,
        username: user.username,
        createdAt: user.createdAt,
        totalRequests: tenant?.totalRequests ?? 0,
        blockedRequests: tenant?.blockedRequests ?? 0,
        totalTokens: tenant?.totalTokens ?? 0,
        totalCost: tenant?.totalCost ?? 0,
        topModel: topModelRequests > 0 ? topModel : null,
        modelBreakdown,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);

  const totalCost = users.reduce((s, u) => s + u.totalCost, 0);

  let mostPopularModel: ModelName | null = null;
  let mostPopularCount = 0;
  for (const model of ALL_MODELS) {
    if (globalStats.models[model].requests > mostPopularCount) {
      mostPopularCount = globalStats.models[model].requests;
      mostPopularModel = model;
    }
  }

  const globalTotalTokens = ALL_MODELS.reduce(
    (s, m) => s + globalStats.models[m].tokens,
    0,
  );

  res.json({
    users,
    global: {
      totalUsers: allUsers.length,
      totalRequests: globalStats.totalRequests,
      blockedRequests: globalStats.blockedRequests,
      totalTokens: globalTotalTokens,
      totalCost,
      models: globalStats.models,
      mostPopularModel,
    },
    revenue: {
      totalCost,
      markupPercent: MARKUP * 100,
      margin: totalCost * MARKUP,
      projectedRevenue: totalCost * (1 + MARKUP),
      perUser: users.map((u) => ({
        userId: u.userId,
        username: u.username,
        cost: u.totalCost,
        revenue: u.totalCost * (1 + MARKUP),
      })),
    },
    cache: getCacheStats(),
  });
});

export default router;
