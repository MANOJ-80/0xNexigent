# 0xNexigent — AI Runtime Budget Governance

> A real-time LLM budget controller for AIVAR Problem Statement 8.1. 0xNexigent sits between an agent and Groq, reserves budget **before** a provider call, reconciles provider usage **after** the call, and records every governance decision in an audit ledger.

---

## Contents

1. [Problem statement](#problem-statement)
2. [What 0xNexigent does](#what-0xnexigent-does)
3. [Architecture](#architecture)
4. [Request lifecycle](#request-lifecycle)
5. [Budget enforcement model](#budget-enforcement-model)
6. [Model routing and runaway protection](#model-routing-and-runaway-protection)
7. [Dashboard and auditability](#dashboard-and-auditability)
8. [Technology stack](#technology-stack)
9. [Repository layout](#repository-layout)
10. [Local setup](#local-setup)
11. [Gateway integration](#gateway-integration)
12. [Control-plane API](#control-plane-api)
13. [Testing](#testing)
14. [Security and operating notes](#security-and-operating-notes)
15. [Deployment](#deployment)
16. [Current scope](#current-scope)

---

## Problem statement

An enterprise may operate many LLM agents across products, teams, and user sessions. Standard cloud billing reports spend after the provider has already processed requests. A recursive or stuck agent can therefore consume an entire monthly budget before anyone notices.

PS 8.1 requires an infrastructure-layer controller that enforces spend limits per team, agent, and session; warns at 80%; blocks exhausted budgets; closes exhausted sessions; and attempts a cheaper same-provider model before blocking.

0xNexigent solves that by becoming the LLM execution chokepoint. Agents send OpenAI-compatible chat-completion requests to 0xNexigent instead of directly to Groq.

## What 0xNexigent does

- Defines monthly budgets for teams and agents, plus a lifetime budget for each session.
- Authenticates an agent from its gateway API key; callers cannot choose an agent or team in the request body.
- Estimates the maximum cost of a request and atomically reserves it across all applicable scopes before invoking Groq.
- Reconciles that reservation against Groq-reported prompt and completion usage.
- Emits one warning when a budget crosses its configured threshold (80% by default).
- Returns `429 BUDGET_EXHAUSTED` when no approved model can safely fit the remaining budget.
- Marks a session `EXHAUSTED` and rejects later calls when its session allowance is consumed.
- Reroutes from `openai/gpt-oss-120b` to the cheaper `openai/gpt-oss-20b` when the preferred route does not fit.
- Detects an agent that spends more than 20% of its monthly budget in one hour, creates an incident, and pauses the agent.
- Exposes a live React operations dashboard, request audit trail, incident review tools, and signed webhook delivery.

## Architecture

```mermaid
flowchart LR
    A[Agent / OpenAI-compatible client] -->|Bearer agent key| G[0xNexigent Gateway]
    D[React operations dashboard] -->|JWT| G

    subgraph Gateway
        AU[Agent authentication]
        PE[Policy and capability evaluation]
        BR[Atomic budget reservation]
        MR[Model routing]
        RC[Usage reconciliation]
        RD[Runaway detector]
        AL[Audit ledger]
    end

    G --> AU --> PE --> BR
    BR -->|allow / reroute| MR --> GR[Groq Chat Completions API]
    GR --> RC --> RD --> AL
    BR -->|block| AL

    BR <--> R[(Redis)]
    RC <--> P[(PostgreSQL)]
    AL <--> P
    RD --> W[Webhook delivery]
```

### Core services

| Component | Responsibility |
|---|---|
| FastAPI gateway | OpenAI-compatible request entry point and control-plane API |
| Budget service | Estimates cost, reserves across scopes, reconciles actual usage |
| Redis | Atomic Lua reservation, idempotency cache/lock, one-hour runaway counter, SSE pub/sub |
| PostgreSQL | Durable organizations, teams, agents, budgets, sessions, requests, ledger events, incidents, and webhook deliveries |
| Groq adapter | Executes real non-streaming chat completions and returns provider usage |
| React dashboard | Fleet, budgets, sessions, requests, incidents, keys, webhooks, and live updates |

## Request lifecycle

```mermaid
sequenceDiagram
    participant A as Agent
    participant G as 0xNexigent
    participant R as Redis
    participant P as PostgreSQL
    participant L as Groq

    A->>G: POST /v1/chat/completions
    G->>G: Authenticate agent key and validate request
    G->>G: Estimate input + max output cost
    G->>R: Atomically reserve team + agent + session budgets
    alt Preferred model fits
        G->>P: Record ALLOW + reservation
        G->>L: Execute preferred model
    else Fallback model fits
        G->>P: Record REROUTE + MODEL_REROUTED
        G->>L: Execute cheaper approved model
    else No model fits
        G->>P: Record BLOCK / session exhaustion
        G-->>A: HTTP 429 budget error
    end
    L-->>G: Completion + usage
    G->>R: Release reservation and charge actual cost
    G->>P: Persist tokens, cost, ledger, session state
    G-->>A: Provider-compatible completion + governance headers
```

## Budget enforcement model

Every request is governed by all three applicable scopes:

| Scope | Window | Example |
|---|---|---|
| Team | Calendar month | `$500/month` shared by a product team |
| Agent | Calendar month | `$50/month` for one agent |
| Session | Session lifetime | `$2` for one conversation/workflow |

The effective invariant is:

```text
spent + reserved + requested_reservation <= limit
```

The gateway uses a Redis Lua script to evaluate and reserve every applicable budget in one atomic operation. A request is only sent to Groq after all scopes succeed. If one scope cannot reserve, none of the scopes are changed.

### Cost estimation and reconciliation

Before Groq is called, 0xNexigent estimates input tokens using a lightweight character heuristic:

```text
estimated_input_tokens = ceil(character_count / 4)
estimated_cost = input_estimate × input_price + max_tokens × output_price
```

It reserves the estimated input plus the caller's requested maximum output. After Groq returns, the gateway records Groq's authoritative `prompt_tokens` and `completion_tokens`, calculates actual cost from the selected model's configured price, releases the unused reservation, and persists the resulting spend.

Financial enforcement uses integer microdollars in Redis and conservative upward rounding. PostgreSQL stores durable decimal spend and reservation totals used by the dashboard, audit trail, and recovery path.

### Threshold behavior

| Condition | Result |
|---|---|
| Below warning threshold | Request proceeds normally if every scope can reserve. |
| At or above 80% | One `BUDGET_WARNING` ledger event is created per budget window and an optional webhook is dispatched. |
| Preferred route cannot fit | Compatible configured fallback is evaluated. |
| No approved route fits | Request is blocked with `429 BUDGET_EXHAUSTED`. |
| Session reaches its limit | Session is marked `EXHAUSTED`; later requests receive `429 SESSION_BUDGET_EXHAUSTED`. |
| Agent spends >20% of monthly budget in one hour | Agent is paused, a `RUNAWAY_AGENT` incident is created, and later requests receive `429 AGENT_PAUSED`. |

## Model routing and runaway protection

The current Groq model policy is deliberately small and explicit:

| Model | Role | Input / 1M tokens | Output / 1M tokens |
|---|---|---:|---:|
| `openai/gpt-oss-120b` | Preferred | `$0.150` | `$0.600` |
| `openai/gpt-oss-20b` | Same-provider fallback | `$0.075` | `$0.300` |

A reroute is allowed only when the fallback is configured for the agent, supports the requested capabilities, and fits all active budgets. The request ledger records the requested model, selected model, decision, reservation, actual usage, and `MODEL_REROUTED` event.

The runaway circuit breaker uses a Redis one-hour counter per agent. Once actual spend exceeds 20% of the agent's monthly limit inside that hour, the agent is paused until an authorized operator resumes it.

## Dashboard and auditability

The dashboard is available at `http://localhost:5173` in local Docker setup. It includes:

- Agent playground for governed real Groq requests.
- Overview and analytics for spend, reservations, blocks, and warnings.
- Fleet and budget control for teams and agents.
- Session lifecycle state: `ACTIVE`, `EXHAUSTED`, or `CLOSED`.
- Request audit records with timeline events such as `RECEIVED`, `RESERVED`, `MODEL_REROUTED`, `GROQ_EXECUTED`, and `USAGE_RECONCILED`.
- Incident review for runaway agents, including acknowledge, resolve/resume, keep-paused, and key-revocation actions.
- Admin configuration for teams, agents, model policies, key lifecycle, and webhook delivery history.
- Server-Sent Events (`/api/events`) that refresh operational data when governance events occur.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Framer Motion, Nginx |
| Backend | Python 3.12, FastAPI, Pydantic, SQLAlchemy async |
| LLM provider | Groq OpenAI-compatible Chat Completions API |
| Transactional budget gate | Redis 7 and Lua |
| Durable storage | PostgreSQL 16 |
| Schema migrations | Alembic |
| Auth | JWT for the control plane; hashed gateway API keys for agents |
| Delivery | Docker and Docker Compose |
| Tests | pytest, pytest-asyncio, httpx; live Groq integration coverage |

## Repository layout

```text
0xNexigent/
├── backend/
│   ├── app/
│   │   ├── auth.py          # JWT creation and validation
│   │   ├── config.py        # Environment-driven settings
│   │   ├── database.py      # Async SQLAlchemy setup
│   │   ├── main.py          # Gateway and control-plane routes
│   │   ├── models.py        # PostgreSQL models
│   │   ├── schemas.py       # Request/response validation
│   │   └── services.py      # Budget, routing, Groq, audit, webhooks
│   ├── alembic/             # Database migration configuration
│   ├── tests/               # Live integration and RBAC tests
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/      # In-app developer documentation
│   │   ├── lib/             # Auth/types/formatting helpers
│   │   └── pages/           # Landing, login, dashboard
│   ├── Dockerfile
│   └── nginx.conf
├── examples/groq-agent/     # Minimal agent example
├── docker-compose.yml
├── .env.example
├── Final_Design.md
└── README.md
```

## Local setup

### Prerequisites

- Docker and Docker Compose
- A valid Groq API key with access to the configured GPT-OSS models

### 1. Configure environment

```bash
cp .env.example .env
```

Set `GROQ_API_KEY` in `.env`. For a non-local environment also set a strong admin secret, JWT secret, and explicit frontend origins:

```env
GROQ_API_KEY=gsk_...
GROQ_BASE_URL=https://api.groq.com/openai/v1
DATABASE_URL=postgresql+asyncpg://nexigent:nexigent@postgres:5432/nexigent
REDIS_URL=redis://redis:6379/0

ADMIN_API_KEY=replace-with-a-strong-secret
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173
```

Never commit your populated `.env` file.

### 2. Start the stack

```bash
docker compose up -d --build
```

| Service | Local address |
|---|---|
| Dashboard | `http://localhost:5173` |
| Backend / gateway | `http://localhost:8000` |
| Health check | `http://localhost:8000/health` |
| Readiness check | `http://localhost:8000/ready` |

The backend applies the Alembic migration at container startup. On first local startup it seeds an Acme Engineering demonstration fleet: 12 agents across Research, Support, Development, and Operations.

### 3. Obtain a control-plane JWT

Use the configured `ADMIN_API_KEY` to create a local control-plane token:

```bash
curl -sS -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","admin_key":"replace-with-a-strong-secret"}'
```

Save the returned `access_token`:

```bash
export NEXIGENT_JWT='eyJ...'
```

## Gateway integration

### Request contract

Send `POST /v1/chat/completions` with:

- `Authorization: Bearer <agent_gateway_key>`
- `model`
- `messages`
- `session_id` in the JSON body
- optional `max_tokens`, `tools`, `tool_choice`, `response_format`, and `Idempotency-Key`

Streaming (`stream: true`) is intentionally rejected in the current scope. The controller must observe a completed provider usage record to reconcile a request.

### curl example

For local seeded data, a demonstration key follows the pattern `nx_demo_<agent-slug>`. Provisioned agent keys are returned only once when an admin creates or rotates the agent key.

```bash
curl -sS http://localhost:8000/v1/chat/completions \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer nx_demo_research-agent' \
  -H 'Idempotency-Key: research-001' \
  -d '{
    "model": "openai/gpt-oss-120b",
    "session_id": "research-session-001",
    "max_tokens": 120,
    "messages": [
      {"role": "user", "content": "Summarize why runtime LLM budgets matter."}
    ]
  }'
```

Successful responses retain the Groq-compatible body and include governance headers:

| Header | Meaning |
|---|---|
| `X-Nexigent-Request-ID` | Audit correlation ID |
| `X-Nexigent-Decision` | `ALLOW` or `REROUTE` |
| `X-Nexigent-Requested-Model` | Model requested by the agent |
| `X-Nexigent-Selected-Model` | Model actually invoked |
| `X-Nexigent-Estimated-Cost` | Preflight reserved USD cost |
| `X-Nexigent-Actual-Cost` | Reconciled USD cost |
| `X-Nexigent-Warning` | Present when this request crosses a warning threshold |
| `X-Cache: HIT` | Returned from idempotency cache; no second provider call or charge |

### Python example

```python
import httpx

response = httpx.post(
    "http://localhost:8000/v1/chat/completions",
    headers={
        "Authorization": "Bearer nx_demo_research-agent",
        "Idempotency-Key": "research-001",
    },
    json={
        "model": "openai/gpt-oss-120b",
        "session_id": "research-session-001",
        "max_tokens": 120,
        "messages": [
            {"role": "user", "content": "Summarize why runtime LLM budgets matter."}
        ],
    },
    timeout=60,
)

response.raise_for_status()
print(response.headers["X-Nexigent-Decision"])
print(response.json()["choices"][0]["message"]["content"])
```

### Expected governance errors

| Status | Code | Meaning |
|---:|---|---|
| 401 | `AUTHENTICATION_FAILED` | Unknown/revoked agent key or missing Bearer key |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | Matching idempotent request is currently executing |
| 429 | `BUDGET_EXHAUSTED` | No approved model fits all active budgets |
| 429 | `SESSION_BUDGET_EXHAUSTED` | Session is exhausted and closed to new requests |
| 429 | `CAPABILITY_MISMATCH` | No allowed model supports the request requirements |
| 400 | `SESSION_CLOSED` | Session was manually closed |
| 400 | `STREAMING_NOT_YET_SUPPORTED` | Streaming is outside the current controller scope |

## Control-plane API

All control-plane routes require `Authorization: Bearer <JWT>`. The OpenAPI schema is available from the FastAPI service at `/docs` during local development.

### Teams and agents

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/admin/teams` | List teams and budget utilization |
| `POST` | `/api/admin/teams` | Create a team and its budget |
| `PUT` | `/api/admin/teams/{team_id}/budget` | Change a team budget; requires confirmation for unsafe reduction |
| `GET` | `/api/admin/agents` | List governed agents and burn rate |
| `POST` | `/api/admin/agents` | Provision an agent and show raw gateway key once |
| `PUT` | `/api/admin/agents/{slug}/budget` | Change agent monthly/default session budget |
| `PUT` | `/api/admin/agents/{slug}/status` | Pause or reactivate an agent |
| `POST` | `/api/admin/agents/{slug}/rotate-key` | Rotate an agent key |
| `POST` | `/api/admin/agents/{slug}/revoke-key` | Revoke key and pause agent |
| `GET` | `/api/admin/models` | View supported Groq model policy and pricing |

### Operations and audit

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/overview` | Fleet spend, reservations, blocks, warnings, and recent requests |
| `GET` | `/api/sessions` | List sessions, optionally filtered by agent/status |
| `GET` | `/api/sessions/{session_id}` | Session detail and requests |
| `POST` | `/api/sessions/{session_id}/close` | Manually close a session |
| `PUT` | `/api/sessions/{session_id}/budget` | Set/reset a session allowance |
| `GET` | `/api/requests` | List request audit records and filters |
| `GET` | `/api/requests/{request_id}` | Full request decision and ledger timeline |
| `GET` | `/api/ledger` | Latest governance ledger events |
| `GET` | `/api/incidents` | List runaway/security incidents |
| `POST` | `/api/agents/{slug}/resume` | Resume a paused agent |
| `GET` | `/api/events` | Server-Sent Events stream for dashboard updates |

### Webhooks

Webhook management is available under `/api/admin/webhooks`. Events include:

```text
BUDGET_WARNING
BUDGET_EXHAUSTED
MODEL_REROUTED
RUNAWAY_AGENT_PAUSED
AGENT_RESUMED
AGENT_KEY_REVOKED
```

When a secret is configured, deliveries are signed with:

```text
X-Nexigent-Signature: sha256=<hmac-sha256-payload-signature>
```

The delivery record is persisted with status, response code, error, and payload for investigation.

## Testing

The suite uses the running Docker backend and real Groq calls. It validates core PS 8.1 behavior, including:

- Health and JWT/RBAC enforcement.
- Normal allow, hard block, warning ledger event, and cheaper-model reroute.
- Session auto-exhaustion and later request rejection.
- Runaway incident, agent pause, and resume.
- Idempotency behavior and unsafe budget-reduction guard.
- Atomic single-agent stress and three-agent shared-team concurrency invariants.
- Request audit, ledger, administrative provisioning, and webhook URL validation.

Run the suite after the stack is ready:

```bash
docker compose exec -T \
  -e TEST_BASE_URL=http://backend:8000 \
  backend pytest -q
```

Build the frontend production bundle:

```bash
cd frontend
npm install
npm run build
```

## Security and operating notes

- Gateway API keys are stored as SHA-256 hashes. Raw provisioned keys are returned only on creation or rotation.
- Control-plane APIs require JWT authentication and role checks.
- Redis is the real-time atomic enforcement layer; PostgreSQL persists the durable accounting and audit record.
- Requests with unknown provider outcome remain `RECONCILIATION_PENDING` rather than silently releasing a potentially billed reservation.
- Use strong `ADMIN_API_KEY` and `JWT_SECRET` values. Production configuration rejects known weak defaults.
- Configure `CORS_ORIGINS` explicitly for the dashboard origin in non-local environments.
- Do not expose PostgreSQL or Redis outside the internal Docker network in production.
- A populated `.env` is excluded from source control.

## Deployment

The 0xNexigent platform is designed to run its backend services seamlessly on a single Virtual Machine while offloading the frontend React dashboard to a global CDN.

### Vercel (Frontend)
The React dashboard is optimized for Vercel, which securely hosts the application and handles all HTTPs routing natively. The repository includes a `vercel.json` configuration file that creates an edge proxy. This proxy automatically and securely tunnels all API requests (`/api` and `/v1`) to the AWS backend without triggering browser Mixed-Content policies, even if the backend is accessed via IP address.

### AWS EC2 (Backend)
The FastAPI backend, Redis instance, and PostgreSQL database are containerized and deployed on an **AWS EC2 t2/t3.micro instance (Free Tier)**. 
- Due to EC2 Free Tier memory constraints (1GB RAM), a 2GB swap file is configured on the host instance to ensure the `docker-compose.prod.yml` stack runs flawlessly.
- The EC2 security group is locked down, allowing inbound traffic *only* on port `8000` (for API traffic) and port `22` (for SSH administration).

## Current scope

0xNexigent is intentionally focused on PS 8.1:

- One provider adapter: Groq.
- Two configured GPT-OSS routes.
- OpenAI-compatible **non-streaming** chat completions.
- USD-denominated budget accounting.
- Calendar-month team/agent budgets and session-lifetime budgets.

Potential extensions include streaming-aware metering, provider adapters beyond Groq, organization-level budgets, managed identity/SSO provisioning, KMS-backed webhook secrets, background reconciliation workers, and richer operational telemetry.

---

Built for **AIVAR PS 8.1 — Agent Budget Controller**.
