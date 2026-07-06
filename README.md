# PostHog Impact Dashboard

A two-service Railway-ready architecture for analyzing the most impactful engineers in `PostHog/posthog`.

## Folder Split

```text
frontend/  React + Vite + strict TypeScript dashboard
backend/   Fastify + strict TypeScript API and impact-analysis boundary
```

The frontend communicates with the backend through JSON over HTTP:

```text
frontend -> GET /api/impact/summary -> backend
```

## Commands

- `npm run dev:frontend` starts the React dashboard.
- `npm run dev:backend` starts the Fastify API.
- `npm run typecheck` type-checks both services.
- `npm run lint` lints both services.
- `npm run build` builds both services.
- `npm run check` runs type checking, linting, and builds.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the frontend/backend ownership model and Railway deployment plan.

## Environment

Frontend:

- `VITE_APP_NAME`
- `VITE_API_BASE_URL`

Backend:

- `PORT`
- `WEB_ORIGIN`
- `GITHUB_REPOSITORY`
- `ANALYSIS_WINDOW_DAYS`
