import { useState, useCallback } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface AuthUser {
  token: string;
  userId: string;
  username: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

let _token: string | null = null;

function getToken(): string | null {
  return _token;
}

setAuthTokenGetter(getToken);

async function apiPost(path: string, body: object): Promise<{ data?: any; error?: string }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Request failed" };
    return { data };
  } catch {
    return { error: "Network error" };
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await apiPost("/api/auth/login", { username, password });
    setLoading(false);
    if (err) { setError(err); return false; }
    _token = data.token;
    setUser({ token: data.token, userId: data.userId, username: data.username });
    return true;
  }, []);

  const register = useCallback(async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await apiPost("/api/auth/register", { username, password });
    setLoading(false);
    if (err) { setError(err); return false; }
    _token = data.token;
    setUser({ token: data.token, userId: data.userId, username: data.username });
    return true;
  }, []);

  const logout = useCallback(() => {
    _token = null;
    setUser(null);
    setError(null);
  }, []);

  return { user, loading, error, login, register, logout };
}
