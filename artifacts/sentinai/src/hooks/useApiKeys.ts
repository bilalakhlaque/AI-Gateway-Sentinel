import { useState } from "react";

export interface ApiKeys {
  openai: string;
  gemini: string;
  anthropic: string;
}

const STORAGE_KEY = "sentinai-api-keys";

function loadKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { openai: "", gemini: "", anthropic: "", ...JSON.parse(raw) };
  } catch {}
  return { openai: "", gemini: "", anthropic: "" };
}

export function useApiKeys() {
  const [keys, setKeys] = useState<ApiKeys>(loadKeys);

  const updateKey = (field: keyof ApiKeys, value: string) => {
    setKeys((prev) => {
      const next = { ...prev, [field]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const getModelKeys = () => ({
    openai: keys.openai || undefined,
    gemini: keys.gemini || undefined,
    anthropic: keys.anthropic || undefined,
  });

  const hasAnyKey = Object.values(keys).some((v) => v.trim() !== "");

  return { keys, updateKey, getModelKeys, hasAnyKey };
}
