export interface InjectionMatch {
  type: string;
  snippet: string;
}

const INJECTION_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  {
    type: "instruction_override",
    regex: /ignore\s+(all\s+)?(previous|prior|your|the|above|initial)\s+(instructions?|prompt|rules?|guidelines?|directives?|context)/i,
  },
  {
    type: "instruction_override",
    regex: /disregard\s+(all\s+)?(previous|prior|your|the|above|initial)\s+(instructions?|prompt|rules?|guidelines?|directives?|context)/i,
  },
  {
    type: "instruction_override",
    regex: /forget\s+(all|everything|what you've been told|your instructions?|your training|your previous|your prior)/i,
  },
  {
    type: "instruction_override",
    regex: /override\s+(your|the|all)\s+(instructions?|programming|directives?|rules?|guidelines?|constraints?)/i,
  },
  {
    type: "instruction_override",
    regex: /new\s+(instructions?|directives?|rules?|prompt)\s*:/i,
  },
  {
    type: "jailbreak",
    regex: /\bDAN\b.*?(do anything now|no restrictions|no limits)/i,
  },
  {
    type: "jailbreak",
    regex: /do anything now/i,
  },
  {
    type: "jailbreak",
    regex: /jailbreak/i,
  },
  {
    type: "jailbreak",
    regex: /developer\s*mode\s*(enabled|on|activated)/i,
  },
  {
    type: "jailbreak",
    regex: /bypass\s+(safety|filter|restriction|moderation|guardrail|alignment)/i,
  },
  {
    type: "role_hijack",
    regex: /you\s+are\s+now\s+(?!sentinai|an?\s+AI|a\s+language\s+model)/i,
  },
  {
    type: "role_hijack",
    regex: /act\s+as\s+(if\s+you\s+have\s+no|an?\s+unrestricted|an?\s+unfiltered|a\s+different\s+AI|a\s+rogue)/i,
  },
  {
    type: "role_hijack",
    regex: /pretend\s+(you\s+(are|have\s+no)\s+(restrictions?|limits?|rules?|guidelines?)|that\s+you\s+are\s+a\s+different)/i,
  },
  {
    type: "prompt_delimiter",
    regex: /\[SYSTEM\]|\[INST\]|<\|system\|>|<\|im_start\|>|###\s*(system|instruction|prompt)/i,
  },
  {
    type: "prompt_delimiter",
    regex: /---\s*end\s*(of\s*)?(system|instruction|prompt|context)\s*---/i,
  },
  {
    type: "sql_injection",
    regex: /(['"]?\s*;\s*(DROP|DELETE|INSERT|UPDATE|TRUNCATE|ALTER|CREATE)\s+(TABLE|DATABASE|INDEX|VIEW))/i,
  },
  {
    type: "sql_injection",
    regex: /UNION\s+(ALL\s+)?SELECT/i,
  },
  {
    type: "sql_injection",
    regex: /--\s*$|\/\*.*?\*\//,
  },
  {
    type: "sql_injection",
    regex: /(['"]?\s*(OR|AND)\s+['"]?1['"]?\s*=\s*['"]?1)/i,
  },
];

export function detectPromptInjection(text: string): InjectionMatch[] {
  const matches: InjectionMatch[] = [];
  for (const { type, regex } of INJECTION_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      const snippet = match[0].length > 60 ? match[0].slice(0, 57) + "..." : match[0];
      matches.push({ type, snippet });
    }
  }
  return matches;
}
