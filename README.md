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

Not yet production-complete:

- PostgreSQL-backed repository is planned but not wired yet.
- Real GitHub ingestion pipeline is planned but not replacing the current seed data yet.
- Queue-backed scheduled refresh is planned but not implemented yet.
- Railway services still need to be created and configured with production env vars.

The full implementation blueprint is in [FINAL_ARCHITECTURE_PLAN.md](./FINAL_ARCHITECTURE_PLAN.md). [ARCHITECTURE.md](./ARCHITECTURE.md) intentionally stays short and points to that source of truth.

## Repository Layout

```text
.
├── backend/                  # Fastify API, scoring boundary, export jobs
│   ├── src/app.ts            # Server factory, plugins, routes, health checks
│   ├── src/config/env.ts     # Zod-backed runtime env parsing
│   ├── src/jobs/             # PostHog export and refresh entrypoints
│   └── src/modules/          # Impact, HTTP errors, performance logging
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

Planned production data layer:

- PostgreSQL on Railway
- Queue-backed ingestion job
- GitHub API ingestion with pagination, deduplication, and contributor normalization

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
| `npm run test` | Run all Vitest suites. |
| `npm run check` | Run typecheck, lint, and build. |

Backend scripts:

| Command | Purpose |
| --- | --- |
| `npm run refresh -w backend` | Refresh entrypoint, currently a placeholder for real ingestion. |
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
- scheduled refresh job: every 6 to 12 hours after ingestion is implemented.

Backend production checks:

- `GITHUB_TOKEN` must be set.
- `DATABASE_URL` must be set.
- `WEB_ORIGIN` must match the deployed frontend origin.
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

1. Add PostgreSQL client, schema, and migrations.
2. Replace seed data with DB-backed impact reports.
3. Implement GitHub ingestion with pagination, rate-limit handling, and deduplication.
4. Add contributor normalization across login, email, co-authors, and bot identities.
5. Add queue-backed refresh jobs.
6. Deploy backend, frontend, and PostgreSQL to Railway.
7. Verify `GET /api/v1/impact/summary` averages under 150ms in production.
