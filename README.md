# PostHog Impact Dashboard

An engineering-impact analysis dashboard for the public [`PostHog/posthog`](https://github.com/PostHog/posthog) repository.

The goal is not to rank engineers by raw activity such as lines changed, commit count, or files touched. The dashboard is designed for a busy engineering leader who needs a compact, evidence-backed view of the top 5 most impactful engineers and why their work mattered.

## What This Project Measures

Impact is modeled as a weighted engineering signal, not a volume metric.

The current scoring model focuses on:

- Customer value: visible product improvements, high-value fixes, and user-facing outcomes.
- Technical leverage: reusable infrastructure, platform improvements, test tooling, and shared abstractions.
- Risk reduction: reliability fixes, regressions prevented, security work, and production hardening.
- Ownership: sustained work across meaningful areas rather than one-off activity.
- Collaboration: review participation, cross-area support, and evidence that work helped other engineers.

The dashboard should answer:

```text
Who had the most meaningful engineering impact recently, and what evidence supports that ranking?
```

## Current State

Implemented:

- React + Vite + strict TypeScript frontend.
- Fastify + strict TypeScript backend.
- Shared Zod contract package used by both frontend and backend.
- Versioned API route: `GET /api/v1/impact/summary`.
- Runtime response validation on backend and frontend API boundary.
- Global API error shape.
- Rate limiting, CORS, liveness, readiness, and request-duration logging.
- Vitest coverage for contracts, backend routes/env/scoring, and frontend API parsing.
- GitHub Actions CI running install, check, and tests.
- Railway-ready config and env examples.
- Local 90-day PostHog branch/commit export tooling.
- PostgreSQL client foundation with lazy pool creation, readiness checks, schema constants, and initial SQL migration.
- Queue abstraction with local in-memory behavior and explicit durable-driver guardrails.
- GitHub collection module with pagination, rate-limit retry handling, normalized PR/commit/review types, and tests.
- Contributor identity normalization for aliases, noreply emails, co-authors, bots, diacritics, and ambiguous identities.
- Migration runner for applying SQL migrations through `npm run migrate -w backend`.
- Refresh job that collects GitHub signals, builds a scored report, and persists it to PostgreSQL.
- Refresh worker supports `REFRESH_INTERVAL_MS=60000` so Railway can keep the 90-day report within a one-minute refresh cadence when a GitHub token is configured.
- API repository that reads the latest completed PostgreSQL report when `DATABASE_URL` is configured, with local seed fallback for development only.
- Scoring now uses capped evidence strength, issue linkage, review-quality weighting, recency decay, size guardrails, and team-relative normalization rather than raw PR/commit/review counts.
- Post-merge adoption scoring compares later merged PRs against files and areas touched by earlier merged work.
- Frontend dashboard includes area, confidence, and score-dimension filters plus clickable bar and line charts with engineer names and drill-down evidence.

Not yet production-complete:

- Durable `pg-boss` queue execution is not enabled yet.
- Railway services still need to be created and configured with production env vars and a scheduled refresh command.

Deployment instructions are in [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md).

The full implementation blueprint is in [FINAL_ARCHITECTURE_PLAN.md](./FINAL_ARCHITECTURE_PLAN.md). [ARCHITECTURE.md](./ARCHITECTURE.md) intentionally stays short and points to that source of truth.

## Repository Layout

```text
.
├── backend/                  # Fastify API, scoring boundary, export jobs
│   ├── src/app.ts            # Server factory, plugins, routes, health checks
│   ├── src/config/env.ts     # Zod-backed runtime env parsing
│   ├── src/db/               # PostgreSQL client, schema constants, migrations
│   ├── src/jobs/             # PostHog export and refresh entrypoints
│   └── src/modules/          # Impact, GitHub, contributors, queue, HTTP, performance
├── frontend/                 # React dashboard
│   ├── src/features/impact-dashboard/
│   │   ├── api/              # Fetch + Zod response validation
│   │   └── components/       # Dashboard feature components
│   └── src/styles/           # WorkWeave-inspired glass visual system
├── packages/
│   └── impact-contract/      # Shared Zod schemas + inferred TypeScript types
├── .github/workflows/ci.yml  # CI quality gate
├── railway.toml              # Railway deploy defaults
└── FINAL_ARCHITECTURE_PLAN.md
```

## Tech Stack

Frontend:

- React 19
- Vite
- Strict TypeScript
- Shared Zod schemas from `@repo/impact-contract`
- WorkWeave-inspired glass UI treatment

Backend:

- Fastify 5
- Strict TypeScript
- Zod runtime validation
- Fastify CORS
- Fastify rate limiting
- Structured JSON logging

Shared:

- npm workspaces
- Vitest
- oxlint
- TypeScript project builds

Production data layer foundation:

- PostgreSQL on Railway
- SQL migration for reports, engineers, evidence, and ingestion runs
- Queue abstraction for refresh jobs
- GitHub API collection with pagination, deduplication, retry, and contributor normalization support

## API Contract

Frontend and backend communicate over JSON HTTP.

Primary route:

```http
GET /api/v1/impact/summary
```

Health routes:

```http
GET /health
GET /ready
```

All public API errors use this shape:

```ts
type ApiError = {
  error: string
  code: string
  details?: unknown
}
```

The canonical response schemas live in:

```text
packages/impact-contract/src/impact.schema.ts
```

Do not duplicate API types in frontend or backend. Import from `@repo/impact-contract`.

## Prerequisites

- Node.js 24 or newer
- npm
- Git

For production ingestion later:

- GitHub token with enough rate limit for repository data collection
- Railway PostgreSQL database

## Local Setup

Install dependencies:

```bash
npm install
```

Create local env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

For local development, the backend can run without `GITHUB_TOKEN` and `DATABASE_URL`. In production, both are required and the backend will fail fast if they are missing.

Production does not serve mock impact data. If `DATABASE_URL` is configured and no completed GitHub-ingested report exists, the API returns `503` with `code: "NO_IMPACT_REPORT"` until `npm run refresh -w backend` succeeds.

Start the backend:

```bash
npm run dev:backend
```

Start the frontend:

```bash
npm run dev:frontend
```

Open:

```text
http://localhost:5173
```

Backend defaults to:

```text
http://localhost:4000
```

## Environment Variables

Backend env:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes | Runtime mode. Production enables stricter checks. |
| `PORT` | Yes | Backend port. Defaults to `4000` locally. |
| `WEB_ORIGIN` | Yes | Allowed frontend origin for CORS. |
| `DATABASE_URL` | Production | PostgreSQL connection string. |
| `GITHUB_TOKEN` | Production | GitHub API token for ingestion. |
| `GITHUB_REPOSITORY` | Yes | Repository to analyze, default `PostHog/posthog`. |
| `ANALYSIS_WINDOW_DAYS` | Yes | Analysis window, default `90`. |
| `API_AVERAGE_LATENCY_TARGET_MS` | Yes | Target average API latency, default `150`. |
| `REFRESH_INTERVAL_MS` | Refresh worker | Optional continuous refresh interval. Use `60000` for a one-minute latest-feed cadence. |

Frontend env:

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_APP_NAME` | Yes | Browser title/app label. |
| `VITE_API_BASE_URL` | Yes | Backend base URL. |

## Scripts

Root scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev:frontend` | Start the React/Vite dashboard. |
| `npm run dev:backend` | Start the Fastify API in watch mode. |
| `npm run typecheck` | Build shared contract and type-check all workspaces. |
| `npm run lint` | Run oxlint across packages, frontend, and backend. |
| `npm run build` | Build shared contract, backend, and frontend. |
| `npm run build:backend` | Build only the shared contract and backend for Railway. |
| `npm run build:frontend` | Build only the shared contract and frontend for Railway. |
| `npm run build:refresh` | Build backend artifacts for the refresh worker. |
| `npm run start:backend` | Start the compiled backend API. |
| `npm run start:frontend` | Start the frontend preview server on Railway's `$PORT`. |
| `npm run start:refresh` | Run the compiled GitHub refresh worker once, or continuously when `REFRESH_INTERVAL_MS` is set. |
| `npm run start:migrate` | Run compiled SQL migrations once. |
| `npm run test` | Run all Vitest suites. |
| `npm run check` | Run typecheck, lint, and build. |

Backend scripts:

| Command | Purpose |
| --- | --- |
| `npm run migrate -w backend` | Apply SQL migrations to `DATABASE_URL`. |
| `npm run refresh -w backend` | Collect GitHub signals, score the report, and persist it to PostgreSQL. |
| `npm run export:posthog-90d -w backend` | Export 90-day PostHog branch and commit data into `.data/`. |

## Quality Gates

Before committing or deploying:

```bash
npm run check
npm run test
```

CI runs the same gates in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

Current test coverage includes:

- Shared contract schema tests.
- Backend environment validation tests.
- Backend scoring tests.
- Backend route tests through Fastify injection.
- Backend DB client/readiness/migration tests.
- Backend queue client tests.
- Backend GitHub client/service tests.
- Backend contributor normalization/repository tests.
- Backend GitHub-to-impact ingestion and DB persistence tests.
- Frontend API response validation tests.

Production standard from the architecture plan:

```text
Every scoring rule and public API contract must have at least one test.
```

## Data Export

The repository includes a 90-day export job:

```bash
npm run export:posthog-90d -w backend
```

Generated files are written under:

```text
.data/posthog-90d/
```

`.data/` is intentionally ignored by Git because exports can be large and should not be committed.

The export is designed to preserve branch and commit evidence with:

- Branch count stability checks.
- Commit deduplication.
- Author identity normalization fields.
- Bot, merge, revert, generated, and mechanical-change flags.
- Mainline versus branch-only classification.

## Performance Target

The primary dashboard API should average under:

```text
150ms
```

Current backend route logging records:

- Method
- Route
- Status code
- Duration
- Cache/source status
- Report age
- Whether the route exceeded the latency target

The production design uses a precomputed report read path so the dashboard API does not perform expensive GitHub analysis synchronously.

## Deployment

Target platform: Railway.

Recommended Railway services:

- `backend`: Fastify API service.
- `frontend`: static Vite frontend service.
- `postgres`: Railway PostgreSQL service.
- scheduled refresh job: every 6 to 12 hours.

Backend production checks:

- `GITHUB_TOKEN` must be set.
- `DATABASE_URL` must be set.
- `WEB_ORIGIN` must match the deployed frontend origin.
- Run `npm run migrate -w backend` before the first refresh.
- Run `npm run refresh -w backend` once to seed the first persisted impact report.
- `/health` must return ok.
- `/ready` must confirm required dependencies are configured.

Frontend production checks:

- `VITE_API_BASE_URL` must point to the deployed backend.
- No secrets should be exposed through Vite env vars.

## Architecture Rules

- Keep `frontend/` and `backend/` separate.
- Keep shared API schemas in `packages/impact-contract`.
- Do not duplicate components, helper functions, or type definitions.
- Remove obsolete code instead of leaving legacy branches in place.
- Validate external data at runtime before trusting it.
- Keep comments useful and focused on intent, edge cases, or non-obvious behavior.
- Keep `FINAL_ARCHITECTURE_PLAN.md` updated when architecture decisions change.

## Next Production Milestones

1. Enable durable queue execution with `pg-boss` or an equivalent Railway-compatible worker.
2. Add Railway scheduled refresh every 6 to 12 hours.
3. Deploy backend, frontend, and PostgreSQL to Railway.
4. Run migrations and first refresh against production env vars.
5. Verify `GET /api/v1/impact/summary` averages under 150ms in production.
