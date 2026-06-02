# SentinAI Gateway – Multi-Provider AI Gateway & Analytics Platform

SentinAI Gateway is a full-stack AI infrastructure platform that provides a centralized interface for interacting with multiple Large Language Model (LLM) providers. The platform combines a modern React dashboard, an Express-based API gateway, authentication, analytics, caching, cost tracking, and model comparison tools into a unified system.

Built using a TypeScript-first architecture, the project demonstrates modern software engineering practices including contract-first API development, code generation, shared schemas, and monorepo organization.

---

## Overview

Modern AI applications often rely on multiple providers for performance, cost optimization, and model specialization.

SentinAI Gateway acts as a centralized orchestration layer that allows users to:

- Route requests to multiple AI providers
- Compare model outputs side-by-side
- Monitor usage and health metrics
- Track estimated costs
- Manage authentication and tenants
- Apply security and validation controls
- Analyze system performance through dashboards

The platform was designed around a contract-first development workflow using OpenAPI specifications and generated client libraries, ensuring consistency across frontend and backend services.

---

## Key Features

### Multi-Provider AI Gateway

- OpenAI integration
- Google Gemini integration
- Anthropic Claude integration
- Claude Opus integration
- Unified request handling layer

### Model Comparison

- Execute parallel requests across multiple models
- Compare responses side-by-side
- Evaluate output quality and behavior

### Authentication & Authorization

- User registration and login
- JWT authentication
- Protected API routes
- Admin functionality

### Analytics Dashboard

- Usage monitoring
- Request logging
- Health metrics
- Tenant statistics
- Cost analysis and projections

### Intelligent Request Processing

- Semantic caching
- Provider fallback logic
- Rate limiting
- Prompt injection detection
- PII detection and filtering

---

## Technologies Used

### Languages

- TypeScript
- JavaScript
- HTML
- CSS

### Frontend

- React
- Vite
- Tailwind CSS
- Radix UI
- React Query
- Recharts
- Wouter

### Backend

- Node.js
- Express 5
- Pino Logging
- Jose JWT

### AI Providers

- OpenAI
- Gemini
- Anthropic Claude
- Claude Opus

### API & Contract Generation

- OpenAPI
- Orval
- Zod

### Database & Storage

- PostgreSQL
- Drizzle ORM

### Monorepo Tooling

- pnpm Workspaces

---

## Monorepo Structure

```text
AI-Gateway-Sentinel
│
├── artifacts/
│   ├── sentinai
│   │   └── React dashboard
│   │
│   ├── api-server
│   │   └── Express backend gateway
│   │
│   └── mockup-sandbox
│       └── UI prototypes
│
├── lib/
│   ├── api-spec
│   │   └── OpenAPI specifications
│   │
│   ├── api-client-react
│   │   └── Generated React Query clients
│   │
│   ├── api-zod
│   │   └── Shared validation schemas
│   │
│   └── db
│       └── PostgreSQL / Drizzle package
│
└── pnpm-workspace.yaml
```

---

## System Architecture

```text
User
 │
 ▼
React Dashboard
 │
 ▼
Express API Gateway
 │
 ├── OpenAI
 ├── Gemini
 ├── Claude
 └── Claude Opus
 │
 ▼
Analytics + Cache + Security Layer
 │
 ├── Rate Limiting
 ├── Semantic Cache
 ├── PII Detection
 ├── Prompt Injection Detection
 └── Cost Tracking
```

---

## Engineering Highlights

- Designed and implemented a monorepo architecture using pnpm workspaces
- Built a contract-first API workflow using OpenAPI, Orval, and Zod code generation
- Integrated multiple LLM providers behind a unified gateway layer
- Developed model comparison capabilities for side-by-side evaluation
- Implemented semantic caching to reduce duplicate provider requests
- Added provider fallback mechanisms to improve resiliency
- Built analytics dashboards for monitoring usage, health, and cost metrics
- Implemented JWT authentication and authorization workflows
- Developed reusable shared schemas and generated API clients to maintain type safety across services

---

## Challenges & Lessons Learned

One of the most valuable lessons from this project was learning how to maintain consistency across a rapidly evolving full-stack codebase.

By adopting a contract-first architecture with OpenAPI specifications, generated React Query clients, and shared Zod schemas, frontend and backend services remained synchronized while reducing manual maintenance overhead.

The project also provided hands-on experience with:

- Monorepo architecture
- Full-stack TypeScript development
- API design
- AI infrastructure
- Authentication systems
- Performance optimization
- Security controls
- Software scalability patterns

---

## Demo Video

[![Watch Demo](assets/mq2.jpg)](https://youtu.be/mAeBLBr5VG4)

---

## Future Improvements

- Persistent database-backed analytics
- Distributed caching layer
- Containerized deployment infrastructure
- Kubernetes orchestration
- Multi-region provider routing
- Team collaboration features
- Advanced prompt evaluation tooling

---

## Installation

### Clone Repository

```bash
git clone https://github.com/bilalakhlaque/AI-Gateway-Sentinel.git
cd AI-Gateway-Sentinel
```

### Install Dependencies

```bash
pnpm install
```

### Start Development Environment

```bash
pnpm dev
```

---

## Author

Bilal Akhlaque, Arhum Khan

- GitHub: https://github.com/bilalakhlaque
- LinkedIn: https://linkedin.com/in/bilalaakhlaque
