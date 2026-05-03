const SIMILARITY_THRESHOLD = 0.82;
const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = 500;

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by",
  "from","is","it","its","be","was","are","were","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might","shall",
  "can","not","no","nor","so","yet","both","either","neither","this","that",
  "these","those","i","you","he","she","we","they","me","him","her","us","them",
  "my","your","his","our","their","what","which","who","whom","how","when",
  "where","why","as","if","than","then","about","up","out","just","because",
  "into","over","after","s","re","ve","ll","d","t","m",
]);

interface CacheEntry {
  prompt: string;
  model: string;
  response: string;
  tokens: number;
  cost: number;
  latencyMs: number;
  timestamp: number;
  tf: Map<string, number>;
}

export interface CacheHit {
  response: string;
  tokens: number;
  cost: number;
  latencyMs: number;
  similarity: number;
  originalPrompt: string;
}

const store: CacheEntry[] = [];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function computeTF(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const len = Math.max(tokens.length, 1);
  for (const [k, v] of freq) freq.set(k, v / len);
  return freq;
}

function buildIDF(): Map<string, number> {
  const N = store.length;
  const df = new Map<string, number>();
  for (const entry of store) {
    for (const term of entry.tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log((N + 1) / (count + 1)) + 1);
  }
  return idf;
}

function applyIDF(
  tf: Map<string, number>,
  idf: Map<string, number>,
): Map<string, number> {
  const tfidf = new Map<string, number>();
  for (const [term, tfVal] of tf) {
    tfidf.set(term, tfVal * (idf.get(term) ?? 1));
  }
  return tfidf;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, val] of a) {
    dot += val * (b.get(term) ?? 0);
    normA += val * val;
  }
  for (const [, val] of b) normB += val * val;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function evict(): void {
  const now = Date.now();
  for (let i = store.length - 1; i >= 0; i--) {
    if (now - store[i]!.timestamp > TTL_MS) store.splice(i, 1);
  }
  if (store.length > MAX_ENTRIES) {
    store.splice(0, store.length - MAX_ENTRIES);
  }
}

export function checkCache(prompt: string, model: string): CacheHit | null {
  evict();
  if (store.length === 0) return null;

  const tokens = tokenize(prompt);
  if (tokens.length === 0) return null;

  const idf = buildIDF();
  const queryTFIDF = applyIDF(computeTF(tokens), idf);

  let best: CacheEntry | null = null;
  let bestSim = 0;

  for (const entry of store) {
    if (entry.model !== model) continue;
    const entrySim = cosine(queryTFIDF, applyIDF(entry.tf, idf));
    if (entrySim > bestSim) {
      bestSim = entrySim;
      best = entry;
    }
  }

  if (bestSim >= SIMILARITY_THRESHOLD && best !== null) {
    return {
      response: best.response,
      tokens: best.tokens,
      cost: best.cost,
      latencyMs: best.latencyMs,
      similarity: Math.round(bestSim * 1000) / 1000,
      originalPrompt: best.prompt,
    };
  }
  return null;
}

export function addToCache(
  prompt: string,
  model: string,
  response: string,
  tokens: number,
  cost: number,
  latencyMs: number,
): void {
  const tf = computeTF(tokenize(prompt));
  store.push({ prompt, model, response, tokens, cost, latencyMs, timestamp: Date.now(), tf });
  if (store.length > MAX_ENTRIES) store.splice(0, store.length - MAX_ENTRIES);
}

export function getCacheStats(): { size: number; threshold: number; ttlMinutes: number } {
  evict();
  return { size: store.length, threshold: SIMILARITY_THRESHOLD, ttlMinutes: TTL_MS / 60000 };
}
