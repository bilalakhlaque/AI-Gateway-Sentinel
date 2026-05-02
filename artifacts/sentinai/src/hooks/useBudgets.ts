import { useState } from "react";

export type ModelKey = "openai" | "gemini" | "claude" | "claude-opus";
export type BudgetMap = Partial<Record<ModelKey, number>>;

const STORAGE_KEY = "sentinai-budgets";

function loadBudgets(): BudgetMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BudgetMap;
  } catch {}
  return {};
}

export function useBudgets() {
  const [budgets, setBudgetsState] = useState<BudgetMap>(loadBudgets);

  const setBudget = (model: ModelKey, value: string) => {
    const num = parseFloat(value);
    setBudgetsState((prev) => {
      const next: BudgetMap = { ...prev };
      if (isNaN(num) || value.trim() === "") {
        delete next[model];
      } else {
        next[model] = num;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const getActiveBudgets = (): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(budgets)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  };

  return { budgets, setBudget, getActiveBudgets };
}
