# SentinAI — Multi-Model AI API Gateway

SentinAI is a full-stack AI gateway that routes prompts across multiple LLM providers (OpenAI, Gemini, Claude) with automatic fallback, sliding-window rate limiting, and a real-time monitoring dashboard.

## What It Does

- **Multi-model routing** — Send a prompt to OpenAI, Gemini, or Claude from a single interface
- **Automatic fallback** — If a model fails or is unavailable, SentinAI automatically tries the next provider in order: OpenAI → Gemini → Claude
- **Rate limiting** — Sliding window limiter enforces a maximum of 10 requests per minute per API key using in-memory storage
- **Live stats** — Track total requests, per-model costs, token usage, average latency, and blocked request counts
- **Traffic log** — Real-time table of the last 20 requests with timestamps, model used, tokens, cost, latency, and status

## Architecture

```
Frontend (React + Vite)          Backend (Express 5 + Node)
┌────────────────────┐           ┌──────────────────────────┐
│  Chat Interface    │──POST /chat──▶  Rate Limiter          │
│  Stats Panel       │◀─────────────  LLM Gateway            │
│  Traffic Log       │──GET /stats──▶  ├── OpenAI (gpt-4o)  │
│  Cost Chart        │──GET /logs───▶  ├── Gemini (1.5 Flash)│
└────────────────────┘           │     └── Claude (3.5 Sonnet)│
                                 │  Stats Store (in-memory)   │
                                 └──────────────────────────────┘
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send a prompt to a model (with fallback) |
| GET | `/api/stats` | Get total requests, per-model stats, costs |
| GET | `/api/logs` | Get last 20 traffic log entries |
| GET | `/api/healthz` | Health check |

### POST /api/chat

**Request body:**
```json
{
  "prompt": "Explain quantum computing in one sentence",
  "model": "openai",
  "apiKey": "optional-per-user-rate-limit-key"
}
```

**Response:**
```json
{
  "response": "Quantum computing uses...",
  "model": "openai",
  "modelUsed": "gemini",
  "fallback": true,
  "tokens": 142,
  "cost": 0.000994,
  "latencyMs": 843,
  "status": "fallback"
}
```

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd sentinai
pnpm install
```

### 2. Set environment variables

Add the following secrets in the Replit Secrets panel (or as environment variables):

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key from platform.openai.com |
| `GEMINI_API_KEY` | Google AI API key from aistudio.google.com |
| `ANTHROPIC_API_KEY` | Anthropic API key from console.anthropic.com |

You only need keys for the models you want to use. Models without keys will be skipped during fallback.

### 3. Run locally

```bash
# Start the API server
pnpm --filter @workspace/api-server run dev

# Start the frontend (in a separate terminal)
pnpm --filter @workspace/sentinai run dev
```

### 4. Deploy on Replit

Click the **Publish** button in Replit. The app is pre-configured for static frontend hosting and Express backend deployment.

## Rate Limiting

- **Window:** 60 seconds (sliding)
- **Limit:** 10 requests per window
- **Key:** Uses the `apiKey` field if provided, otherwise falls back to the model name
- **Storage:** In-memory (resets on server restart)
- **On limit:** Returns HTTP 429 and records a "blocked" entry in the traffic log

## Cost Estimates

Costs are estimated per-token at the following rates:

| Model | Rate |
|-------|------|
| OpenAI (gpt-4o) | $0.000015 / token |
| Gemini (1.5 Flash) | $0.000007 / token |
| Claude (3.5 Sonnet) | $0.000018 / token |

These are approximations. Refer to each provider's pricing page for exact rates.

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, Recharts, TanStack Query
- **Backend:** Node.js 24, Express 5, TypeScript
- **API contract:** OpenAPI 3.1 with Orval codegen (typed hooks + Zod validators)
- **Monorepo:** pnpm workspaces
