const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

const store = new Map<string, number[]>();

export function isRateLimited(tenantId: string, apiKey: string): boolean {
  const key = `${tenantId}:${apiKey}`;
  const now = Date.now();
  const timestamps = (store.get(key) ?? []).filter(
    (t) => now - t < WINDOW_MS,
  );
  if (timestamps.length >= MAX_REQUESTS) {
    store.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  store.set(key, timestamps);
  return false;
}
