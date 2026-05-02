import { useState } from "react";

const STORAGE_KEY = "sentinai-tenant-id";
const PRESET_TENANTS = ["default", "alice", "bob", "charlie"];

function load(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "default";
  } catch {
    return "default";
  }
}

export { PRESET_TENANTS };

export function useTenantId() {
  const [tenantId, setTenantIdState] = useState<string>(load);

  const setTenantId = (id: string) => {
    const clean = id.trim() || "default";
    localStorage.setItem(STORAGE_KEY, clean);
    setTenantIdState(clean);
  };

  return { tenantId, setTenantId, PRESET_TENANTS };
}
