const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

const store = new Map<string, number[]>();

export function isRateLimited(apiKey: string): boolean {
  const now = Date.now();
  const timestamps = (store.get(apiKey) ?? []).filter(
    (t) => now - t < WINDOW_MS,
  );
  if (timestamps.length >= MAX_REQUESTS) {
    store.set(apiKey, timestamps);
    return true;
  }
  timestamps.push(now);
  store.set(apiKey, timestamps);
  return false;
}
