export interface PiiMatch {
  type: "email" | "phone" | "ssn";
  value: string;
}

const PATTERNS: Array<{ type: PiiMatch["type"]; regex: RegExp }> = [
  {
    type: "email",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    type: "phone",
    regex: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  {
    type: "ssn",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
];

export function detectPii(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  for (const { type, regex } of PATTERNS) {
    const found = text.match(new RegExp(regex.source, regex.flags));
    if (found) {
      for (const value of found) {
        matches.push({ type, value });
      }
    }
  }
  return matches;
}
