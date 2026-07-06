# Railway Deployment

This repository is a monorepo. Deploy every Railway service from the repository root so npm workspaces can resolve `@repo/impact-contract`.

## Required Services

Create these Railway services:

- `postgres`: Railway PostgreSQL database.
- `backend`: Fastify API.
- `frontend`: Vite frontend.
- `refresh`: worker/scheduled job that writes real GitHub data to PostgreSQL.

## Required Secrets

- `GITHUB_TOKEN`: GitHub token with enough rate limit for `PostHog/posthog` ingestion.
- `DATABASE_URL`: use the Railway Postgres service reference.
- `WEB_ORIGIN`: deployed frontend URL.
- `VITE_API_BASE_URL`: deployed backend URL.

## CLI Setup

```bash
railway login
railway init --name Analyzer
railway add --database postgres --service postgres
railway add --service backend
railway add --service frontend
railway add --service refresh
```

Generate domains:

```bash
railway domain --service backend
railway domain --service frontend
```

Set backend variables:

```bash
railway variable set --service backend \
  NODE_ENV=production \
  GITHUB_REPOSITORY=PostHog/posthog \
  ANALYSIS_WINDOW_DAYS=90 \
  API_AVERAGE_LATENCY_TARGET_MS=150 \
  DATABASE_URL='${{postgres.DATABASE_URL}}' \
  NIXPACKS_BUILD_CMD='npm run build:backend' \
  NIXPACKS_START_CMD='npm run start:backend'

railway variable set --service backend WEB_ORIGIN='https://YOUR_FRONTEND_DOMAIN'
railway variable set --service backend --stdin GITHUB_TOKEN
```

Set frontend variables:

```bash
railway variable set --service frontend \
  VITE_APP_NAME='PostHog Impact Dashboard' \
  VITE_API_BASE_URL='https://YOUR_BACKEND_DOMAIN' \
  NIXPACKS_BUILD_CMD='npm run build:frontend' \
  NIXPACKS_START_CMD='npm run start:frontend'
```

Set refresh variables:

```bash
railway variable set --service refresh \
  NODE_ENV=production \
  GITHUB_REPOSITORY=PostHog/posthog \
  ANALYSIS_WINDOW_DAYS=90 \
  DATABASE_URL='${{postgres.DATABASE_URL}}' \
  NIXPACKS_BUILD_CMD='npm run build:refresh' \
  NIXPACKS_START_CMD='npm run start:refresh'

railway variable set --service refresh --stdin GITHUB_TOKEN
```

## Deploy

```bash
railway up --service backend
railway up --service frontend
railway up --service refresh
```

Apply migrations and seed the first real report:

```bash
railway run --service backend npm run railway:migrate
railway run --service backend npm run railway:refresh
```

After the first refresh, the API should return `dataFreshness.source = "github_ingestion"`.

## Verify

```bash
curl https://YOUR_BACKEND_DOMAIN/health
curl https://YOUR_BACKEND_DOMAIN/ready
curl https://YOUR_BACKEND_DOMAIN/api/v1/impact/summary
```

Production should not serve mock data. If no completed report exists, the API returns `503` with `code: "NO_IMPACT_REPORT"` until the refresh job succeeds.
