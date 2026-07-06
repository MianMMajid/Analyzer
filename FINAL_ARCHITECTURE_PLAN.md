# PostHog Impact Dashboard Architecture Plan

## Objective

Build a Railway-hosted dashboard that identifies the top five most impactful engineers in the `PostHog/posthog` GitHub repository over at least the last 90 days.

The dashboard must help a busy engineering leader understand not only who ranked highly, but why they ranked highly.

## Core Product Requirement

The product must avoid shallow engineering metrics as the primary definition of impact.

Do not rank engineers primarily by:

- Lines of code
- Number of commits
- Number of files changed
- Number of PRs opened
- Number of comments or reviews alone

These values may be used as supporting signals, but they must not define impact by themselves.

## PostHog-Specific Execution Plan

The analysis is built specifically around the public `PostHog/posthog` repository.

The system must answer:

```text
Which five engineers had the most meaningful engineering impact in PostHog over the last 90 days, and what evidence proves it?
```

### Analysis Window

Default window:

```text
Last 90 days from the refresh job execution date.
```

For example, if the job runs on `2026-07-06`, the default analysis window is:

```text
2026-04-07 through 2026-07-06
```

The backend must use `ANALYSIS_WINDOW_DAYS=90` so this stays configurable.

### PostHog Data We Collect

For the full 90-day window, collect all relevant GitHub activity from `PostHog/posthog`:

- Merged pull requests
- Open pull requests updated during the window
- Closed but unmerged pull requests updated during the window
- Pull request titles
- Pull request bodies
- Pull request labels
- Pull request authors
- Pull request assignees
- Pull request reviewers
- Pull request review decisions
- Pull request review comments
- Issue comments on pull requests
- Commits associated with pull requests
- Direct commits on the default branch
- Changed file paths
- File statuses such as added, modified, renamed, deleted
- PR open time
- First review time
- Merge time
- Close time
- Linked issues when available
- Revert PRs
- Bot-authored activity
- Co-authored commit metadata

### PostHog Data We Derive

The raw GitHub records are converted into higher-level engineering signals:

- Product area touched
- Code ownership area
- Contribution type
- Customer-value signal
- Technical-leverage signal
- Risk-reduction signal
- Collaboration signal
- Review depth signal
- Flow efficiency signal
- Mechanical-change likelihood
- Bot/generated-change likelihood
- Confidence level for attribution

### PostHog Area Classification

PostHog is a large product/codebase, so file paths and labels should be mapped into product and platform areas.

Initial area categories:

- Product analytics
- Session replay
- Feature flags
- Experiments
- Surveys
- Data pipelines
- Ingestion
- Querying
- Dashboards
- Billing
- Authentication and authorization
- Frontend experience
- Backend services
- Infrastructure
- CI/CD
- Testing
- Developer tooling
- Documentation
- Migrations
- Observability

This classification helps prevent the model from treating every PR equally.

### PostHog Impact Analysis Method

The backend processes the data in this order:

```text
1. Fetch GitHub activity for the 90-day window.
2. Deduplicate records by stable GitHub IDs.
3. Normalize identities across GitHub login, commit author, email, and co-author metadata.
4. Exclude or cap bots, generated changes, vendored files, lockfile-only work, and mechanical formatting.
5. Classify each PR and review into product/platform/risk/collaboration categories.
6. Score contribution themes instead of raw activity counts.
7. Aggregate signals per engineer.
8. Select the top five engineers.
9. Attach evidence explaining each ranking.
10. Save the completed dashboard report for fast API reads.
```

### What Matters Most for PostHog

Because PostHog is a product-heavy open-source company, the highest-value signals are:

- Work that improves customer-facing analytics workflows.
- Work that improves data correctness or reliability.
- Work that improves ingestion, querying, or performance.
- Work that reduces production or operational risk.
- Work that improves engineering leverage across the codebase.
- Work that shows ownership of complex product/platform areas.
- Reviews that materially improve risky or important PRs.

The score should reward people who make PostHog better, safer, faster, or easier to build.

### What Must Not Dominate

The analysis must actively prevent these from dominating:

- Large formatting changes
- Lockfile-only dependency bumps
- Generated file changes
- Raw PR volume
- Raw commit volume
- Raw review volume
- Tiny drive-by edits
- One unusually large PR
- Bot-authored automation

### Top-Five Explanation Format

Each top-five engineer must have a concise explanation suitable for a busy PostHog engineering leader:

```text
Why they rank here:
  Short narrative explaining the impact pattern.

What they moved:
  Product/platform areas affected.

Evidence:
  3 to 5 representative PRs, reviews, or contribution themes.

Risk/quality note:
  Whether their work reduced operational, product, or maintenance risk.

Confidence:
  High, medium, or low based on identity mapping and evidence quality.
```

### Dashboard Outcome

The dashboard must show:

- Top five engineers
- Impact score
- Score breakdown
- Area, confidence, and score-dimension filters
- Clickable bar chart with engineer names below each bar
- Line chart showing the selected engineer's impact profile across dimensions
- Primary contribution theme
- Representative evidence
- Why this matters to PostHog
- Analysis window
- Data freshness
- Methodology summary

The dashboard must fit on one laptop screen and avoid overwhelming the leader with raw GitHub activity.
The frontend must poll the summary API every 60 seconds so the page reflects the latest completed report without a full refresh.

## Impact Definition

Engineer impact is defined as a weighted combination of meaningful contribution signals:

| Dimension | Weight | Meaning |
| --- | ---: | --- |
| Customer Value | 30% | User-facing features, fixes, workflow improvements, and product outcomes. |
| Technical Leverage | 25% | Infrastructure, platform, testing, observability, performance, and developer productivity work. |
| Risk Reduction | 20% | Reliability, regressions, security, migrations, correctness, and operational stability. |
| Ownership | 15% | Sustained responsibility across important areas instead of isolated activity spikes. |
| Collaboration | 10% | Reviews, cross-team support, unblocking others, and work across ownership boundaries. |

Every ranked engineer must include:

- Total impact score
- Score breakdown
- Human-readable explanation
- Evidence from GitHub activity
- Primary impact area

## Complete Metrics Catalog

The system should collect a broad set of metrics, but only a curated subset should directly affect the impact score.

Metrics are grouped into:

- Primary scoring metrics
- Supporting explanation metrics
- Diagnostic metrics
- Guardrail metrics
- Anti-metrics that must not dominate ranking

### Primary Scoring Metrics

These metrics directly contribute to the impact score.

#### Customer Value Metrics

- Product-facing PRs merged
- User-facing bugs fixed
- Customer pain keywords in PR title or description
- Product area importance
- Feature completion signals
- Experiment, analytics, replay, ingestion, billing, or dashboard improvements
- Issues closed by PRs
- PRs linked to customer-facing requests
- PRs with release-note-worthy changes
- Work touching high-usage product surfaces
- Work that improves onboarding or activation paths
- Work that improves reporting, dashboards, exports, or data access
- Work that reduces customer-visible friction

#### Technical Leverage Metrics

- Infrastructure improvements
- CI/CD improvements
- Test framework improvements
- Build performance improvements
- Developer tooling improvements
- Shared library or platform improvements
- Observability improvements
- Query performance improvements
- API performance improvements
- Type-safety improvements
- Reusable abstraction improvements
- Work that reduces future maintenance cost
- Work that improves local development speed
- Work that reduces flaky tests
- Work that simplifies deployment or release workflows

#### Risk Reduction Metrics

- Reliability fixes
- Security fixes
- Data correctness fixes
- Regression fixes
- Incident follow-up work
- Migration safety work
- Backward compatibility fixes
- Error handling improvements
- Monitoring and alerting improvements
- Authentication or authorization fixes
- Privacy or compliance-related fixes
- Dangerous edge-case handling
- Rollback or recovery improvements
- Production stability improvements

#### Ownership Metrics

- Sustained contribution in important code areas
- Repeated work in high-complexity modules
- Maintainer-like behavior in a domain
- End-to-end ownership from implementation to review follow-through
- Returning to fix regressions in previously touched areas
- Cross-cutting ownership across related subsystems
- Balance of feature, quality, and maintenance work
- Ownership of unpopular but necessary work
- Consistency across the full 90-day window

#### Collaboration Metrics

- Meaningful code reviews
- Review comments with requested changes or technical guidance
- Reviews across multiple teams or code areas
- Unblocking stalled PRs
- Helping reduce review cycle time
- Participating in complex PR discussions
- Co-authoring or pairing signals
- Responding to requested changes quickly
- Improving others' PRs through review
- Cross-functional or cross-area contribution evidence

### Supporting Explanation Metrics

These metrics provide context and evidence but should not dominate the score.

#### Pull Request Metrics

- PRs opened
- PRs merged
- PRs closed without merge
- Merge rate
- Average PR size
- Median PR size
- Large PR count
- Small PR count
- PRs with tests
- PRs without tests
- PRs with documentation changes
- PRs with migrations
- PRs with feature flags
- PRs with schema changes
- PRs touching frontend
- PRs touching backend
- PRs touching infrastructure
- PRs touching tests
- PRs touching docs
- PRs touching high-risk paths
- PRs reverting previous changes
- PRs labeled bug
- PRs labeled feature
- PRs labeled performance
- PRs labeled security
- PRs labeled reliability
- PRs labeled refactor
- PRs labeled documentation

#### Review Metrics

- Reviews submitted
- Approvals
- Change requests
- Comment-only reviews
- Review comments
- Distinct PRs reviewed
- Distinct authors reviewed
- Review participation in high-risk PRs
- Review participation in large PRs
- Review participation outside owned area
- Average time to review after request
- Median time to review after request
- Reviews that unblock merge
- Reviews followed by author changes
- Review depth, inferred from comment count and changed-file coverage

#### Flow Metrics

- PR cycle time from open to merge
- Time from first commit to merge
- Time from PR open to first review
- Time from first review to merge
- Time spent waiting for review
- Time spent after requested changes
- Number of review rounds
- Number of stale PRs revived
- Number of blocked PRs unblocked
- Median lead time by engineer
- Median lead time by contribution type
- Work-in-progress count

#### Code Area Metrics

- Number of code areas touched
- Primary code area
- Secondary code areas
- High-complexity areas touched
- High-ownership areas touched
- Product areas touched
- Platform areas touched
- Test areas touched
- Documentation areas touched
- Migration areas touched
- Hotspot files touched
- Files with frequent historical changes touched
- Files with high incident or regression likelihood touched

#### Quality Metrics

- Test additions
- Test fixes
- Test coverage signals where available
- Flaky test fixes
- Reverts caused by own changes
- Follow-up fixes after own changes
- Bug-fix-to-feature balance
- Regression-prone area work
- Static typing improvements
- Error boundary or validation improvements
- Observability added with feature work
- Documentation or runbook added with risky work

#### Delivery Metrics

- Deployment-related PRs
- Release preparation work
- Release unblock work
- Hotfix work
- Rollback-related work
- Feature flag usage
- Changes merged close to incidents or releases
- Change batching patterns
- Lead time for changes
- Deployment frequency contribution where deploy data is available

#### Repository Activity Metrics

- Commits
- Commit authorship
- Co-authored commits
- Commit recency
- Commit distribution across the window
- Files changed
- Lines added
- Lines deleted
- Net line delta
- Binary/generated file changes
- Mechanical rename or formatting changes
- Dependency update changes

Repository activity metrics must be treated as weak supporting evidence only.

### Diagnostic Metrics

Diagnostic metrics help leaders interpret the system and spot process issues.

- Team-level review load
- Engineer review load
- Review bottlenecks
- Areas with slow review cycles
- Areas with repeated regressions
- Areas with high maintenance burden
- Bus-factor risk by code area
- Concentration of ownership
- High-impact work without enough review
- Important work hidden behind small PR count
- Large volume work with low apparent impact
- Unusually high mechanical-change activity
- Stale PR count by area
- Failed refresh job count
- GitHub API rate-limit pressure
- Data freshness
- Confidence level per engineer score

### Guardrail Metrics

Guardrail metrics prevent misleading rankings.

- Bot-authored PRs excluded
- Generated-file-heavy PRs capped
- Dependency-only PRs capped
- Formatting-only PRs capped
- Massive mechanical refactors capped
- Vendored or lockfile changes capped
- Duplicate PR references deduplicated
- Reverts handled separately
- One unusually large PR cannot dominate the full score
- One unusually active review burst cannot dominate collaboration score
- Missing GitHub identity mappings lower confidence
- Low evidence count lowers confidence

### Anti-Metrics

These metrics must never be used as primary ranking metrics:

- Lines of code
- Raw commit count
- Raw PR count
- Raw review count
- Raw comment count
- Raw files changed
- Raw number of repositories touched
- Raw activity streaks
- Raw GitHub contribution graph activity

They can appear only as context or guardrails.

### Dashboard Metrics

The single-page dashboard should show only high-signal metrics:

- Rank
- Engineer name
- Total impact score
- Primary impact area
- Score breakdown across the five impact dimensions
- Top evidence items
- Confidence level
- Analysis window
- Data freshness
- Methodology summary

The dashboard should not show every collected metric by default.

### Backend-Only Metrics

These should be collected and stored for analysis but hidden from the default dashboard:

- Raw commits
- Raw line counts
- Raw file counts
- Raw review counts
- Detailed pagination state
- GitHub rate-limit logs
- Refresh-job internals
- Deduplication records
- Full normalized contribution records
- Confidence calculation inputs

### Metric Source Map

| Metric Group | Main Source |
| --- | --- |
| PR activity | GitHub pull requests API |
| Reviews | GitHub pull request reviews API |
| Review comments | GitHub pull request review comments API |
| Changed files | GitHub PR files API |
| Commits | GitHub commits API |
| Labels | GitHub issues and PR metadata |
| Code areas | Changed file paths |
| Ownership | Historical contribution distribution |
| Flow | PR timestamps and review timestamps |
| Risk reduction | Labels, titles, descriptions, paths, and contribution classifier |
| Customer value | Labels, titles, descriptions, product paths, and linked issues |
| Technical leverage | Paths, labels, titles, and infrastructure/tooling classifiers |
| Collaboration | Reviews, comments, authors reviewed, and cross-area participation |

### Metric Storage Rule

Store metrics at the lowest useful level of detail needed to explain rankings.

Do store:

- Normalized PR records
- Normalized review records
- Normalized contributor records
- Aggregated engineer score records
- Evidence records attached to score dimensions

Do not store:

- Full source code blobs
- Full patches unless absolutely required
- Unbounded GitHub API payloads
- Duplicate activity rows
- Unused metrics that are never displayed, scored, or audited

### Metric Selection Rule

Every metric must have one of these purposes:

```text
Score
Explain
Diagnose
Guardrail
Audit
```

If a metric has none of those purposes, it should not be collected.

## High-Level Architecture

The codebase is split into two top-level folders:

```text
frontend/
backend/
```

No additional top-level app folders should be introduced unless there is a clear production need.

## Frontend Architecture

Technology:

- React
- Vite
- Strict TypeScript
- REST API client over HTTPS JSON
- Lightweight dashboard UI

Responsibilities:

- Render the single-page dashboard.
- Show the top five most impactful engineers.
- Show impact breakdowns and evidence.
- Explain the scoring methodology.
- Handle UI interaction such as selecting an engineer.
- Never call GitHub directly.
- Never own final scoring logic.
- Never expose GitHub tokens.

Suggested structure:

```text
frontend/
  src/
    app/
      App.tsx
      providers.tsx

    features/
      impact-dashboard/
        components/
          ImpactDashboard.tsx
          EngineerLeaderboard.tsx
          EngineerDetailPanel.tsx
          ImpactBreakdown.tsx
          EvidenceList.tsx
          MethodologyPanel.tsx
        api/
          impactApi.ts
        types.ts

    components/
      ui/
        Button.tsx
        Card.tsx
        Tabs.tsx
        Tooltip.tsx
        Meter.tsx

    config/
      env.ts

    styles/
      global.css
```

Frontend rules:

- Keep feature-specific components inside `features/impact-dashboard`.
- Keep reusable UI primitives inside `components/ui`.
- Do not duplicate components with similar responsibilities.
- Do not calculate source-of-truth impact scores in the browser.
- Use strict TypeScript types for all API responses.
- Keep dashboard content to a single laptop-screen page where possible.
- Prefer clear analytical UI over decorative design.
- Follow the WorkWeave visual language from `https://workweave.dev/`.

## Frontend Visual Design Rules

The frontend must visually align with the WorkWeave design direction.

Reference:

```text
https://workweave.dev/
```

Observed design traits:

- Warm off-white page background.
- Dark brown-black text instead of pure blue or slate themes.
- Orange primary accent.
- Muted green secondary accent.
- Blue chart/data accent.
- Glass-like translucent dashboard panels.
- Soft borders and low-contrast dividers.
- Dense analytical cards rather than marketing-heavy sections.
- Clean engineering-intelligence language around normalized work, benchmarks, PRs, reviews, deploys, and business value.

Required color tokens:

```css
:root {
  --ww-bg: rgb(243, 241, 235);
  --ww-bg-soft: rgb(235, 232, 228);
  --ww-surface: rgba(252, 252, 252, 0.7);
  --ww-surface-strong: rgb(253, 252, 252);
  --ww-border: rgba(130, 130, 130, 0.2);
  --ww-border-strong: rgb(200, 197, 188);
  --ww-text: rgb(26, 21, 18);
  --ww-text-muted: rgba(26, 21, 18, 0.55);
  --ww-accent-orange: #e8532a;
  --ww-accent-green: #4aa78a;
  --ww-accent-blue: #0099ff;
  --ww-accent-pink: #ffaff4;
}
```

Required glass treatment:

```css
.glass-panel {
  background: var(--ww-surface);
  border: 1px solid var(--ww-border);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 80px rgba(26, 21, 18, 0.09);
}
```

Glass usage rules:

- Use glass panels for dashboard cards, leaderboard rows, detail panels, and methodology cards.
- Do not put cards inside cards.
- Do not overuse blur where it harms readability.
- Text contrast must remain readable on every glass surface.
- Keep radius restrained, usually 8px to 16px.
- Use orange only for primary emphasis, rank highlights, and primary actions.
- Use green for positive stability/quality signals.
- Use blue for charts, benchmark lines, or neutral data highlights.
- Use pink only as a rare accent, not a dominant theme.

Dashboard layout rules:

- Keep the page compact enough for a laptop viewport.
- Use a WorkWeave-style analytical hero/header, not a large marketing hero.
- The first viewport must show the top-five ranking and selected-engineer explanation.
- Use small, dense labels and metric cards.
- Prefer charts, meters, and compact evidence lists over long prose.
- Avoid dark-blue/slate dashboards, purple gradients, beige-only palettes, and generic SaaS card walls.

Typography rules:

- Prefer Geist, Inter, or a close system fallback.
- Use a clean sans-serif for UI labels and body text.
- Use a mono font only for small technical labels, IDs, or timestamps.
- Keep letter spacing at `0`.
- Do not scale font sizes directly with viewport width.

Implementation rule:

```text
All WorkWeave-inspired colors must be defined once in global CSS tokens.
Components must consume tokens instead of hardcoded colors.
```

## Backend Architecture

Technology:

- Node.js
- Fastify
- Strict TypeScript
- PostgreSQL on Railway
- GitHub API via a server-side token
- Scheduled Railway job for refreshes

Responsibilities:

- Fetch GitHub data from `PostHog/posthog`.
- Include at least the last 90 days of activity.
- Normalize engineers across GitHub usernames, commit authors, and emails.
- Classify contribution types.
- Calculate impact scores.
- Store or cache analyzed results.
- Serve dashboard-ready JSON to the frontend.
- Keep secrets and GitHub tokens server-side.

Suggested structure:

```text
backend/
  src/
    server.ts

    config/
      env.ts

    modules/
      github/
        github.client.ts
        github.service.ts
        github.types.ts

      impact/
        impact.routes.ts
        impact.service.ts
        impact.scoring.ts
        impact.repository.ts
        impact.types.ts

      contributors/
        contributors.normalizer.ts
        contributors.repository.ts

      queue/
        queue.client.ts
        queue.types.ts

      performance/
        requestTiming.ts
        cachePolicy.ts

    jobs/
      refreshImpactData.ts

    db/
      client.ts
      schema.ts
      migrations/
```

Backend rules:

- All GitHub communication must happen in the backend.
- All scoring logic must live in `impact.scoring.ts`.
- All API response shaping must live in the impact service layer.
- Routes should remain thin and delegate business logic.
- Environment variables must be parsed in `config/env.ts`.
- GitHub tokens must never be sent to the frontend.
- The refresh job must be repeatable and safe to rerun.
- With `REFRESH_INTERVAL_MS=60000`, the refresh worker must run immediately and then every minute, while skipping ticks when the prior refresh is still running.

## Database Recommendation

Use PostgreSQL as the primary and default database.

Decision:

```text
Primary database: Railway PostgreSQL
Queue storage: PostgreSQL with pg-boss
Cache: PostgreSQL first, Redis only if latency requires it
Search/vector database: not needed for the first version
Document database: not needed for the first version
```

Why PostgreSQL is the best fit:

- Railway supports PostgreSQL as a managed database with minimal setup.
- The data model is relational: repositories, pull requests, reviews, commits, contributors, reports, and jobs.
- The dashboard needs reliable indexed reads, not unbounded document search.
- PostgreSQL supports `jsonb`, which is useful for compact dashboard report payloads.
- PostgreSQL supports GIN indexes for JSONB when querying inside JSON is necessary.
- PostgreSQL can also power the background job queue through `pg-boss`, avoiding an extra Redis service at the start.
- Keeping storage and queue state in one database reduces operational complexity on Railway.

Do not start with MongoDB:

- The core data has strong relationships and deduplication needs.
- Contributor normalization, PR-review joins, and report history are easier to model relationally.
- A document database would add flexibility we do not currently need.

Do not start with Redis as the main database:

- Redis is excellent for cache and queue workloads, but the source-of-truth data needs durable relational storage.
- Redis can be added later if API latency exceeds the 150ms average target.

Do not start with ClickHouse or an analytical warehouse:

- The project analyzes one GitHub repository over a 90-day window.
- PostgreSQL is sufficient for this data size and avoids unnecessary infrastructure.
- A warehouse can be reconsidered only if the product expands to many repositories or many organizations.

Recommended database tables:

```text
contributors
github_pull_requests
github_reviews
github_review_comments
github_commits
github_changed_files
impact_reports
impact_report_engineers
refresh_jobs
```

Recommended report strategy:

```text
Normalized GitHub tables
  -> scoring job
  -> compact impact_reports.summary_json
  -> GET /api/impact/summary reads latest completed report
```

This keeps the user-facing API fast while preserving enough normalized data to explain and audit the ranking.

## Frontend and Backend Communication

Use REST over HTTPS with JSON.

Primary data flow:

```text
frontend
  -> GET /api/impact/summary
backend
  -> PostgreSQL cached analysis
backend refresh job
  -> GitHub API
```

Initial API endpoints:

```http
GET /api/impact/summary
GET /api/impact/engineers/:id
GET /api/impact/methodology
POST /api/jobs/refresh-impact-data
```

The first production version can ship with only:

```http
GET /api/impact/summary
```

## Performance Requirement

The average API response time for dashboard reads must stay under 150ms.

Performance target:

| Metric | Target |
| --- | ---: |
| Average API latency | < 150ms |
| p95 API latency | < 300ms |
| p99 API latency | < 500ms |
| Dashboard summary payload | < 75KB |
| Request path GitHub API calls | 0 |

The 150ms target applies to backend API communication after the request reaches the backend. Full browser page load can be slower due to network, frontend assets, and Railway cold starts.

Hard rule:

```text
No user-facing API request may call the GitHub API synchronously.
```

The backend must serve dashboard reads from precomputed data in PostgreSQL or a cache.

## Read Path Design

The primary read endpoint must be optimized for a single dashboard page.

```text
GET /api/impact/summary
  -> read latest completed impact report
  -> return compact top-five dashboard payload
```

Recommended storage shape:

```text
impact_reports
  id
  repository
  analysis_window_days
  generated_at
  status
  summary_json
  created_at
```

Indexes:

```text
impact_reports(repository, analysis_window_days, status, generated_at desc)
```

Read complexity:

```text
Time:  O(1) relative to raw GitHub activity
Space: O(K) where K is the size of the returned dashboard payload
```

`K` should remain small because the dashboard only needs the top five engineers, explanations, methodology, and selected evidence.

## Write and Analysis Path Design

GitHub ingestion and scoring must happen outside the user request path.

```text
scheduled refresh job
  -> enqueue or run ingestion
  -> paginate through GitHub data
  -> normalize contributors
  -> classify contributions
  -> score engineers
  -> write completed impact report
```

Analysis complexity:

```text
P = pull requests in the analysis window
C = commits in the analysis window
R = reviews and review comments in the analysis window
F = changed file records in the analysis window
E = normalized engineers

Ingestion time: O(P + C + R + F)
Normalization time: O(P + C + R)
Scoring time: O(E)
Top-five ranking time: O(E log 5)
Storage space: O(P + C + R + F) for raw cached data, or O(E) for aggregate-only storage
```

The preferred first version should store enough raw normalized data to explain the ranking, not every raw GitHub field.

## Pagination Rules

Pagination is required for GitHub ingestion.

GitHub data collection must:

- Use cursor or page-based pagination.
- Respect GitHub rate limits.
- Persist ingestion cursors or checkpoints.
- Resume safely after failure.
- Cap each job batch to avoid Railway timeouts.
- Deduplicate by stable GitHub IDs.

Recommended pagination strategy:

```text
Pull requests:
  Fetch merged PRs by updated or merged date.
  Page until records are older than the analysis window.

Reviews:
  Fetch per PR only for PRs inside the analysis window.

Commits:
  Fetch by since date.
  Normalize author identity separately from PR author.

Changed files:
  Fetch only for candidate PRs.
  Store summarized path/category data, not unnecessary file blobs.
```

Frontend pagination is not required for the first dashboard because the product shows only the top five engineers.

If future views expose raw PRs or contribution evidence lists, use cursor pagination:

```http
GET /api/impact/engineers/:id/evidence?cursor=abc&limit=20
```

Pagination response shape:

```ts
type PaginatedResponse<T> = {
  items: T[]
  nextCursor: string | null
}
```

## Queue and Background Job Rules

A message queue is not required for the first static/mock implementation, but it is required once GitHub ingestion becomes production-grade and any of these are true:

- Refresh work takes longer than one Railway request timeout.
- GitHub rate limits require retry scheduling.
- Multiple refresh jobs can overlap.
- Ingestion needs durable retry after failure.
- Analysis must be split into batches.

Preferred queue options:

1. `pg-boss` using Railway PostgreSQL.
2. BullMQ using Railway Redis.

Recommendation:

Start with `pg-boss` if the team wants fewer Railway services. Use BullMQ with Redis only if job throughput or delayed retry behavior becomes more demanding.

Queue responsibilities:

- Run GitHub ingestion in the background.
- Retry failed pages with backoff.
- Prevent duplicate refreshes for the same repository and window.
- Track job status for observability.
- Write only completed reports to the read table.

Queue rules:

- API reads must not wait for queue jobs.
- Only one active refresh job per repository/window should run at a time.
- Failed jobs must not overwrite the latest successful report.
- Partial reports must be marked `status = failed` or `status = running`, never `status = completed`.

## Caching Strategy

Use cache only where it protects the 150ms read target.

Required:

- Store the latest completed dashboard summary in PostgreSQL.
- Return the latest completed report even if a refresh is currently running.
- Keep the response compact and dashboard-specific.

Optional:

- Add Redis only if PostgreSQL reads or Railway cold starts make the average response exceed 150ms.
- Cache `GET /api/impact/summary` by repository and analysis window.
- Use a short cache TTL such as 5 to 15 minutes.

Cache invalidation:

- Refresh job writes a new completed report.
- API begins serving the newest completed report.
- Old reports can be retained for audit or deleted by retention policy.

## Database and Indexing Rules

Minimum tables:

```text
impact_reports
github_pull_requests
github_reviews
github_commits
contributors
refresh_jobs
```

Required indexes:

```text
impact_reports(repository, analysis_window_days, status, generated_at desc)
github_pull_requests(repository, merged_at)
github_pull_requests(repository, github_id)
github_reviews(repository, submitted_at)
github_commits(repository, committed_at)
contributors(repository, github_login)
refresh_jobs(repository, analysis_window_days, status, created_at desc)
```

Storage rule:

```text
Store raw data only when it improves explainability, deduplication, or refresh correctness.
```

Do not store:

- File contents
- Full repository blobs
- Unbounded API responses
- Duplicate GitHub records

## Observability Rules

Performance must be measured from the beginning.

Backend must log:

- Request method
- Route
- Status code
- Duration in milliseconds
- Cache hit or miss
- Report age
- Job ID for refresh-related activity

Track:

- Average latency
- p95 latency
- p99 latency
- Error rate
- Latest successful refresh time
- GitHub rate-limit remaining
- Queue depth if a queue is added

If average latency exceeds 150ms:

1. Confirm no GitHub calls are on the request path.
2. Check database indexes.
3. Check payload size.
4. Add or tune cache.
5. Investigate Railway cold starts or region mismatch.

## Performance Gate Checklist

Before any backend API change is complete:

```text
[ ] The endpoint does not call GitHub synchronously.
[ ] The endpoint has a stated time complexity.
[ ] The endpoint has a stated space complexity.
[ ] The endpoint returns only fields needed by the frontend.
[ ] The endpoint has pagination if it can return an unbounded list.
[ ] The endpoint uses an indexed database access path.
[ ] The endpoint logs request duration.
[ ] The change does not threaten the 150ms average API target.
```

## API Response Contract

The backend should return dashboard-ready data.

Example contract:

```ts
type ImpactEngineer = {
  id: string
  name: string
  githubLogin: string
  rank: number
  totalScore: number
  primaryImpactArea: string
  breakdown: {
    customerValue: number
    technicalLeverage: number
    riskReduction: number
    ownership: number
    collaboration: number
  }
  explanation: string
  evidence: {
    title: string
    url: string
    reason: string
    contributionType: string
  }[]
}
```

## Data Collection Rules

Required GitHub data sources:

- Pull requests
- Commits
- Reviews
- Review comments
- Changed file paths
- Labels
- PR titles and descriptions
- Merge dates
- Authors and reviewers

Recommended contribution classification:

- Product feature
- Bug fix
- Performance
- Reliability
- Security
- Infrastructure
- Testing
- Tooling
- Documentation
- Migration
- Refactor

Analysis must cover:

- At least the last 90 days
- Merged work
- Review and collaboration activity
- Evidence behind each ranked engineer

## Scoring Rules

The scoring model must be transparent and explainable.

Rules:

- Use raw activity counts only as supporting evidence.
- Favor contribution quality and leverage over volume.
- Tie every high score to concrete evidence.
- Penalize noisy activity that has little product or platform relevance.
- Avoid over-crediting large mechanical changes.
- Group related work into themes where possible.
- Explain confidence level when evidence is incomplete.

## Attribution and Edge Case Rules

The system must protect against missing data and incorrectly crediting the wrong engineer.

### Identity Resolution

Contributor identity must be normalized before scoring.

Identity inputs:

- GitHub login
- Commit author name
- Commit author email
- Commit committer name
- Commit committer email
- Co-authored-by trailers
- PR author
- PR merger
- Review author
- Bot identity

Rules:

- One human engineer can have multiple emails and GitHub identities.
- `users.noreply.github.com` emails must be mapped to the underlying GitHub login when possible.
- `@posthog.com` emails are strong identity signals but not sufficient alone.
- Commit author and committer are different signals and must not be collapsed blindly.
- Co-authors should receive partial contribution credit only when trailers are present.
- PR merger should not receive author credit unless they authored or co-authored the work.
- Unknown identities must be grouped as unresolved and excluded from top-five ranking unless manually mapped.
- Every top-five engineer must have an identity confidence level.

Required identity table:

```text
contributor_id
github_login
primary_email
known_emails
known_names
is_bot
is_posthog_member
confidence
last_seen_at
```

### Bot and Automation Handling

Bots must not be ranked as engineers.

Bot detection signals:

- GitHub login ending in `[bot]`
- Email containing `bot`
- Known automation names such as dependency updaters, snapshot updaters, generated-code bots, and scheduled actions
- Commit subjects dominated by snapshot, generated, dependency, or formatting work

Rules:

- Bot-authored commits are excluded from engineer ranking.
- Human-authored commits that apply bot suggestions stay credited to the human, but the evidence should note mechanical assistance where detectable.
- Generated snapshot-only commits are capped even when authored by a human.
- Dependency-only commits are capped.
- Formatting-only commits are capped.

### Branch and Commit Reachability

Branch and commit exports must avoid double-counting and missing branch-only work.

Rules:

- Fetch all branch refs, not only the default branch.
- Export all branch heads.
- Export active branches separately from all branches.
- A branch is active if its head commit date is inside the analysis window.
- Commits must be deduplicated by SHA across all branches.
- Branch-only commits must be identified as commits reachable from active branches but not reachable from `master`.
- Mainline commits must be identified as commits reachable from `master`.
- Merge commits must be marked and handled separately.
- A merge commit should not count as original code contribution unless the merge itself resolves conflicts or changes code.
- Rebases can create new SHAs for equivalent patches; use patch-id or PR metadata later to deduplicate when GitHub data is available.
- Cherry-picks can create duplicate patches; use patch-id or title/PR linkage to avoid double credit.

Required commit categories:

```text
mainline_accepted
branch_only_candidate
merge_commit
revert_commit
cherry_pick_candidate
bot_or_generated
unresolved_identity
```

### Deleted and Moving Branches

GitHub branches can be created, deleted, renamed, or force-pushed during export.

Rules:

- Record export time.
- Record remote branch count before and after export when possible.
- If branch counts differ during export, refetch and rerun once.
- If counts still differ, mark the export as `unstable` and do not use it for final ranking.
- Store branch head SHA with the branch name so force-push changes are visible.
- Do not assume deleted branches are low value; merged branches may disappear after merge and must be recovered from PR/merge history in the GitHub ingestion phase.

### Code Diff Evaluation Edge Cases

Actual code evaluation must account for noisy or misleading diffs.

Must detect or cap:

- Generated files
- Snapshot files
- Lockfiles
- Vendored files
- Minified files
- Large renames
- Pure formatting changes
- Import-sort-only changes
- Dependency bumps
- Mass codemods
- Mechanical migrations
- Deleted-code-only commits
- Reverts
- Merge conflict resolution commits
- Test-only commits
- Docs-only commits
- Config-only commits

Rules:

- Generated or mechanical diffs can support leverage but cannot dominate impact.
- Test-only work can be high impact when it protects important product paths or removes CI risk.
- Docs-only work can be high impact when it enables operations, onboarding, or incident response.
- Deleted code can be high impact when it removes complexity, dead paths, or risk.
- Large diffs must be normalized by semantic value, not size.
- Very small diffs can be high impact if they fix correctness, security, billing, data loss, or reliability.

### Mainline Quality Baseline

To compare branch work against company code quality, build a baseline from accepted `master` commits.

Baseline should include:

- Human-authored mainline commits
- Merged PR commits
- Tests and product code patterns
- Typical file ownership and module boundaries
- Common change sizes by area
- Common test-to-code relationships
- Accepted patterns for migrations, API changes, frontend components, and backend services

Exclude from baseline:

- Bots
- Generated files
- Dependency-only commits
- Snapshot-only commits
- Formatting-only commits
- Merge commits with no code changes

Quality comparison dimensions:

- Matches existing module boundaries
- Adds or updates relevant tests
- Avoids duplicate components or functions
- Keeps abstractions proportional
- Uses existing PostHog patterns
- Reduces complexity or contains complexity locally
- Avoids broad risky changes without evidence
- Has clear product or reliability purpose

### Wrong-Engineer Prevention

No engineer should be shown in the top five unless attribution is defensible.

Top-five eligibility requirements:

- Not a bot
- Identity confidence is not low
- Has at least two independent evidence items or one very strong evidence item
- Evidence is tied to authored or co-authored work, not only merge activity
- Score is not primarily from mechanical/generated work
- Branch-only work is not treated as accepted impact unless clearly merged or otherwise valuable
- Review-only impact is supported by review/comment data, not inferred from commit metadata

If these requirements are not met:

```text
Show the engineer in diagnostics, not the top-five leaderboard.
```

### Confidence Levels

Every engineer score must include confidence.

High confidence:

- GitHub login and email are mapped.
- Evidence includes PR metadata.
- Reviews/comments are available.
- Work is merged or clearly attributable.
- Mechanical work is filtered.

Medium confidence:

- Commit metadata is strong.
- PR numbers are visible in subjects.
- Some review/comment data is missing.
- Identity is likely but not fully confirmed.

Low confidence:

- Identity mapping is ambiguous.
- Work is mostly branch-only.
- Commit author differs from committer with no PR context.
- Evidence is mostly mechanical.
- GitHub API data is missing.

Low-confidence engineers must not be ranked in the top five by default.

### Data Integrity Gates

Before analysis is accepted:

```text
[ ] Remote branch count matches exported branch count.
[ ] Expected commit count matches exported commit count.
[ ] Commit SHAs are unique after deduplication.
[ ] Active branch count is recorded.
[ ] Bot identities are excluded from ranking.
[ ] Unresolved identities are listed separately.
[ ] Mainline and branch-only commits are separated.
[ ] Merge commits are marked.
[ ] Reverts are marked.
[ ] Generated/mechanical changes are capped.
[ ] Every top-five engineer has confidence and evidence.
[ ] Any missing GitHub API data is reflected in confidence.
```

If any required gate fails, the dashboard must show the export as incomplete or low confidence.

## Railway Deployment Plan

Use one Railway project with separate services:

```text
frontend service
backend service
postgres service
refresh worker service
```

Frontend service:

```text
Root directory: frontend/
Build command: npm run build
Start command: npm run preview
```

Backend service:

```text
Root directory: backend/
Build command: npm run build
Start command: npm run start
```

PostgreSQL:

```text
Use Railway PostgreSQL.
Expose DATABASE_URL only to the backend service.
```

Refresh worker:

```text
Run backend refresh job continuously with REFRESH_INTERVAL_MS=60000.
Skip overlapping refresh ticks if ingestion takes longer than one minute.
```

Optional queue service:

```text
Use Railway PostgreSQL with pg-boss first.
Add Railway Redis and BullMQ only when queue throughput or retry requirements justify another service.
```

## Environment Variables

Frontend:

```text
VITE_API_BASE_URL=https://backend-service.railway.app
VITE_APP_NAME=PostHog Impact Dashboard
```

Backend:

```text
PORT=4000
WEB_ORIGIN=https://frontend-service.railway.app
DATABASE_URL=
GITHUB_TOKEN=
GITHUB_REPOSITORY=PostHog/posthog
ANALYSIS_WINDOW_DAYS=90
API_AVERAGE_LATENCY_TARGET_MS=150
```

Queue, if enabled:

```text
QUEUE_DRIVER=pg-boss
REDIS_URL=
```

## Engineering Standards

TypeScript:

- Enable `strict`.
- Enable `noUncheckedIndexedAccess`.
- Enable `exactOptionalPropertyTypes`.
- Avoid `any`.
- Prefer explicit domain types.
- Validate external data before trusting it.

React:

- Use function components.
- Keep components small and focused.
- Keep data fetching out of presentational components.
- Keep feature logic inside feature folders.
- Avoid duplicate UI components.

Backend:

- Keep routes thin.
- Keep business logic in services.
- Keep scoring logic isolated.
- Keep database access in repositories.
- Keep environment parsing centralized.

Security:

- Never expose GitHub tokens to the frontend.
- Never commit secrets.
- Restrict CORS to the deployed frontend URL.
- Validate request parameters.
- Treat GitHub API data as external input.

Quality:

- Run typecheck before deployment.
- Run lint before deployment.
- Run build before deployment.
- Keep code comments useful and explanatory.
- Document scoring assumptions.

## Testing Strategy

Testing is a production gate, not an optional follow-up.

Required test layers:

- Unit tests for scoring, contributor normalization, area classification, and metric guardrails.
- Integration tests for Fastify API routes using `server.inject`.
- Contract tests for shared API schemas and frontend response parsing.
- Frontend feature tests for data-bound dashboard behavior.

Tooling:

- Use Vitest for `packages/impact-contract`, `backend`, and `frontend`.
- Root `npm run test` must run every workspace test.
- Root `npm run check` must run typecheck, lint, and build.

Production standard:

```text
Every scoring rule and public API contract must have at least one test.
```

CI gate:

```text
npm run check
npm run test
```

Both must pass before deploy.

## CI/CD Pipeline

GitHub Actions owns the automated quality gate.

Required workflow:

```text
.github/workflows/ci.yml
  npm ci
  npm run check
  npm run test
```

Branch protection:

- Pull requests must pass CI before merge.
- Main branch deploys should only happen after CI is green.
- Railway preview deploys can be added after backend/frontend services are configured.

## Runtime Validation

Runtime validation is required at every external boundary.

Backend:

- Validate environment variables with Zod.
- Validate API response shapes before returning them.
- Validate GitHub API responses once ingestion is implemented.
- Validate request params and bodies for any non-read endpoint.

Frontend:

- Validate backend responses in `impactApi.ts` before trusting JSON.
- Never rely on TypeScript casts for external data.

Shared contract:

```text
packages/impact-contract/
  src/impact.schema.ts
  src/index.ts
```

The shared package owns Zod schemas and inferred TypeScript types for:

- Impact dashboard response
- Engineer records
- Evidence records
- Methodology
- API error shape

Both frontend and backend import from `@repo/impact-contract`.

## API Versioning

All public API routes must be versioned.

Current route:

```http
GET /api/v1/impact/summary
```

Breaking-change policy:

- Add a new version for breaking response changes.
- Keep old versions until consumers migrate.
- Add contract tests before changing a response schema.
- Do not change field meaning without changing schema or version.

## Error Handling Standard

All API errors must use this shape:

```ts
type ApiError = {
  error: string
  code: string
  details?: unknown
}
```

Backend rules:

- Use one global Fastify error handler.
- Return 4xx for client errors.
- Return 5xx for server errors.
- Do not expose stack traces in production responses.
- Return the same shape for missing routes.

## Infra and Deployment Artifacts

Required files:

| File | Purpose |
| --- | --- |
| `backend/.env.example` | Backend env vars and required production secrets. |
| `frontend/.env.example` | Frontend public Vite env vars. |
| `railway.toml` | Railway build/deploy defaults. |
| `.github/workflows/ci.yml` | CI quality gate. |
| `.gitignore` | Prevent `.data`, `.env`, `dist`, and dependencies from being committed. |

Health endpoints:

```http
GET /health
GET /ready
```

`/health` is liveness. `/ready` reports whether required runtime dependencies are configured.

## Observability Requirements

Backend must use structured JSON logging.

Every route must log:

- Method
- Route
- Status code
- Duration in milliseconds
- Cache/source status
- Report age when available
- Whether the route exceeded the latency target

Required metrics:

- Average latency
- p95 latency
- p99 latency
- Error rate
- Last successful refresh time
- Queue depth after queue implementation

Alert threshold:

```text
Average API latency > 150ms for 5 minutes.
```

## Security Hardening

Required:

- Rate limiting on public API routes.
- Request body size limits.
- `GITHUB_TOKEN` required in production.
- `DATABASE_URL` required in production.
- CORS restricted to `WEB_ORIGIN`.
- No stack traces in production responses.
- No secrets exposed to the frontend.
- No API docs exposed in production unless intentionally configured.
- Dependabot or Renovate should be enabled for dependency updates.

## Documentation Hierarchy

`FINAL_ARCHITECTURE_PLAN.md` is the source of truth.

`ARCHITECTURE.md` is only a short pointer to the full plan and must not duplicate architectural rules.

## Agent Operating Rules

These rules apply from the start of the project to every agent, assistant, or engineer working in the repository.

### Start-of-Task Rules

Before creating or changing code, the agent must:

- Read this `FINAL_ARCHITECTURE_PLAN.md`.
- Inspect the existing folder structure.
- Search for existing components before creating a new component.
- Search for existing functions before creating a new helper.
- Identify whether the requested change belongs in `frontend/` or `backend/`.
- Confirm whether the work replaces legacy code or extends current code.

Required search behavior:

```text
Search components before adding components.
Search functions before adding functions.
Search types before adding types.
Search API routes before adding API routes.
Search scoring logic before changing scoring behavior.
```

### No Duplicate Component Rule

Duplicate components are not allowed.

An agent must not create a new component if an existing component can be reused or extended.

Before adding a component, check:

- Does a matching component already exist in `frontend/src/components/ui`?
- Does a feature-specific version already exist in `frontend/src/features/impact-dashboard/components`?
- Can the existing component accept a typed prop instead of creating another component?
- Would this new component create a second source of truth for the same UI pattern?

If a new component is truly required:

- Give it one clear responsibility.
- Place shared components in `frontend/src/components/ui`.
- Place dashboard-only components in `frontend/src/features/impact-dashboard/components`.
- Remove or merge any older component that it replaces.

### No Duplicate Function Rule

Duplicate functions are not allowed.

An agent must not create a new function if existing logic can be reused, renamed, or safely extended.

Before adding a function, check:

- Does this logic already exist in the same module?
- Does this logic already exist in a nearby feature module?
- Does this logic belong in a shared utility?
- Would this create two ways to calculate the same thing?
- Would this create two ways to call the same API?

Source-of-truth rules:

- Impact scoring must live in one backend scoring module.
- GitHub API access must live in one backend GitHub client/service.
- Contributor normalization must live in one backend contributors module.
- API calls from the frontend must live in the feature API folder.
- Formatting helpers must live in one formatter module if shared.

### Legacy Removal Rule

Legacy code must be removed when it is replaced.

Agents must not leave old components, old functions, dead files, unused types, or abandoned mock data in the repository after replacing them.

When replacing code:

- Delete the old file if it no longer has a purpose.
- Remove unused imports.
- Remove unused exports.
- Remove stale comments.
- Remove obsolete documentation.
- Update references to point to the new implementation.
- Run typecheck to prove no stale references remain.

Do not keep legacy code "just in case."

### Anti-Bloat Rule

The codebase must stay small and intentional.

Agents must avoid:

- Creating wrapper components with no real responsibility.
- Creating generic utilities before there are multiple real callers.
- Adding new dependencies without a clear need.
- Adding state management libraries before local state becomes insufficient.
- Adding abstractions only for theoretical future use.
- Creating extra folders that do not clarify ownership.
- Leaving generated or temporary files committed unless required.

Preferred approach:

- Reuse first.
- Extend second.
- Replace and remove third.
- Create new only when necessary.

### Pre-Change Checklist

Every code change should satisfy this checklist:

```text
[ ] I searched for an existing component/function/type first.
[ ] I verified this change belongs in frontend or backend.
[ ] I reused existing code where practical.
[ ] I removed legacy code that this change replaces.
[ ] I avoided adding unnecessary dependencies.
[ ] I kept one source of truth for the behavior.
[ ] I updated documentation if architecture or workflow changed.
[ ] I checked that frontend changes follow the WorkWeave design tokens and glass rules.
```

### Post-Change Checklist

Before considering work complete:

```text
[ ] No duplicate components were introduced.
[ ] No duplicate helper functions were introduced.
[ ] No dead legacy files remain.
[ ] No unused imports or exports remain.
[ ] TypeScript passes.
[ ] Lint passes.
[ ] Build passes.
[ ] The update log was updated.
[ ] Frontend UI still follows the WorkWeave-inspired visual system.
```

### Agent Update Log Requirement

Agents must update the Living Update Log when they:

- Add a new module.
- Remove legacy code.
- Change scoring logic.
- Add, remove, or redefine a metric.
- Change API contracts.
- Change deployment configuration.
- Add or remove dependencies.
- Change folder structure.

The update must include:

- Date and time
- Owner or agent
- Summary
- Files or services affected

## Commenting Standard

The codebase should include comments where they clarify architecture, ownership, data flow, or non-obvious logic.

Use comments for:

- Why a scoring rule exists
- Why a module owns a responsibility
- Why a data normalization decision was made
- Why a Railway-specific setting is required
- Any tradeoff that future maintainers may question

Avoid comments that merely repeat the code.

Bad:

```ts
// Adds one to count
count += 1
```

Good:

```ts
// Mechanical PRs are capped so generated refactors do not dominate impact rankings.
const cappedFileChangeScore = Math.min(fileChangeScore, maxMechanicalChangeCredit)
```

## Implementation Phases

### Phase 1: Architecture Setup

- Create `frontend/` and `backend/`.
- Configure strict TypeScript in both.
- Add Railway-ready scripts.
- Add environment variable parsing.
- Add initial REST API contract.

### Phase 2: Mock Dashboard

- Build the single-page dashboard UI.
- Use backend mock data that matches the final contract.
- Show top five engineers.
- Show evidence, score breakdown, and methodology.

### Phase 3: GitHub Data Ingestion

- Connect backend to GitHub API.
- Fetch all relevant PostHog PRs, commits, reviews, comments, labels, changed files, and linked metadata for the last 90 days.
- Normalize contributors.
- Classify contribution types.
- Add pagination, deduplication, checkpointing, and rate-limit handling.

### Phase 4: Impact Analysis

- Implement scoring model.
- Add evidence extraction.
- Add confidence notes.
- Store analyzed results in PostgreSQL.
- Write the latest completed compact dashboard report for fast API reads.

### Phase 4.5: Performance and Queue Hardening

- Add request-duration logging.
- Add database indexes for the read path and ingestion queries.
- Add endpoint complexity notes.
- Add a queue if refresh jobs need durable retries or batching.
- Confirm `GET /api/impact/summary` averages under 150ms.

### Phase 5: Railway Deployment

- Deploy backend service.
- Deploy frontend service.
- Add Railway PostgreSQL.
- Configure scheduled refresh job.
- Validate production URLs and CORS.

### Phase 6: Review and Refinement

- Review rankings for obvious false positives.
- Tune weights if needed.
- Improve explanations.
- Add edge-case handling for bots and mechanical changes.

## Living Update Log

Use this section to record what has been done and what changed.

Format:

```text
YYYY-MM-DD HH:MM - Owner - Update summary - Files or services affected
```

Updates:

- 2026-07-06 13:40 - Architecture - Initial requirement clarified: build a PostHog engineer-impact dashboard, not a generic React scaffold.
- 2026-07-06 13:50 - Architecture - Proposed two-folder split: `frontend/` and `backend/`.
- 2026-07-06 13:55 - Architecture - Defined frontend/backend responsibilities and REST communication over HTTPS JSON.
- 2026-07-06 14:00 - Architecture - Added Railway deployment model with frontend, backend, PostgreSQL, and optional refresh job.
- 2026-07-06 14:05 - Documentation - Created this final architecture plan with rules, standards, implementation phases, and update-log process.
- 2026-07-06 14:10 - Documentation - Added strict agent operating rules for duplicate prevention, legacy removal, anti-bloat checks, and mandatory update logging.
- 2026-07-06 14:15 - Performance - Added 150ms API latency target, complexity budgets, pagination rules, queue criteria, caching strategy, database indexes, and observability gates.
- 2026-07-06 14:20 - Frontend Design - Added WorkWeave-inspired visual rules, glass-panel treatment, color tokens, typography rules, and frontend design checklist gates.
- 2026-07-06 14:25 - Metrics - Added complete metrics catalog covering scoring, explanation, diagnostics, guardrails, anti-metrics, source mapping, storage rules, and dashboard visibility.
- 2026-07-06 14:25 - Frontend - Implemented strict TypeScript impact dashboard UI with frontend-local API types, WorkWeave glass styling, top-five selection, evidence, methodology, freshness, confidence, and PostHog-value context - `frontend/src/features/impact-dashboard`, `frontend/src/styles/global.css`, `frontend/src/components`, `frontend/src/config/env.ts`, `frontend/tsconfig.app.json`.
- 2026-07-06 14:26 - Backend Implementation - Added Fastify health/read routes, request timing, repository-backed mock impact report, expanded dashboard contract, Railway env parsing, and refresh-job placeholder notes - `backend/src/server.ts`, `backend/src/config/env.ts`, `backend/src/modules/impact/*`, `backend/src/modules/performance/requestTiming.ts`, `backend/src/jobs/refreshImpactData.ts`, `backend/package.json`, `backend/tsconfig.json`.
- 2026-07-06 14:30 - PostHog Analysis - Added repository-specific execution plan for collecting, classifying, scoring, and explaining 90-day PostHog engineering impact.
- 2026-07-06 14:35 - Database - Selected Railway PostgreSQL as the primary database, PostgreSQL-backed pg-boss for queue storage, and Redis only as an optional future cache.
- 2026-07-06 14:40 - Integration - Replaced placeholder backend seed with PostHog-derived 90-day git-history evidence, removed starter clutter, wired richer frontend context, ran full check, and smoke-tested local frontend/API - `backend/src/modules/impact/impact.data.ts`, `frontend/src/features/impact-dashboard`, `frontend/src/styles/global.css`, `package-lock.json`.
- 2026-07-06 14:45 - Data Export - Added 90-day PostHog branch and commit exporter with expected/exported count verification and manifest output - `backend/src/jobs/exportPosthogBranchesAndCommits.ts`, `backend/package.json`.
- 2026-07-06 14:50 - Data Integrity - Added attribution, bot filtering, branch reachability, code-diff edge cases, baseline-quality comparison, confidence levels, and wrong-engineer prevention gates - `FINAL_ARCHITECTURE_PLAN.md`.
- 2026-07-06 14:55 - Export Hardening - Implemented identity confidence, normalized author IDs, bot/mechanical/revert/merge flags, mainline-vs-branch-only commit categories, co-author trailer capture, branch-count stability checks, and expanded manifest integrity counters; reran export with 26,426/26,426 commits and stable 10,012 branch heads - `backend/src/jobs/exportPosthogBranchesAndCommits.ts`, `.data/posthog-90d/manifest.json`.
- 2026-07-06 15:00 - Production Hardening - Added shared Zod contract package, runtime response validation, frontend API parsing, `/api/v1` route, global API error shape, rate limiting, env examples, Railway config, GitHub Actions CI, Vitest tests, and single-doc hierarchy - `packages/impact-contract`, `backend/src/app.ts`, `backend/src/modules/http/errors.ts`, `frontend/src/features/impact-dashboard/api/impactApi.ts`, `.github/workflows/ci.yml`, `backend/.env.example`, `frontend/.env.example`, `railway.toml`, `ARCHITECTURE.md`.
- 2026-07-06 15:10 - Backend Foundations - Added PostgreSQL client/readiness helpers, initial SQL schema migration, queue abstraction, GitHub API pagination/rate-limit collection module, contributor normalization, and focused Vitest coverage for each foundation module - `backend/src/db`, `backend/src/modules/queue`, `backend/src/modules/github`, `backend/src/modules/contributors`, `backend/package.json`, `package-lock.json`, `README.md`.
- 2026-07-06 15:15 - Data Pipeline Wiring - Wired migration execution, GitHub-to-impact scoring, DB report persistence, DB-backed latest-report reads, refresh job execution, and readiness DB checks; full `npm run check && npm run test` passed - `backend/src/db/migrator.ts`, `backend/src/db/migrate.ts`, `backend/src/modules/impact/impact.ingestion.ts`, `backend/src/modules/impact/impact.repository.ts`, `backend/src/jobs/refreshImpactData.ts`, `backend/src/app.ts`, `README.md`.
- 2026-07-06 15:20 - Scoring Fidelity - Replaced direct PR/commit/review volume scoring with capped classified evidence strength, linked-issue extraction, review-quality weighting, recency decay, PR size guardrails, and team-relative dimension normalization - `backend/src/modules/impact/impact.ingestion.ts`, `backend/src/modules/github/github.service.ts`, `backend/src/modules/github/github.types.ts`, `README.md`.
- 2026-07-06 15:25 - Adoption Scoring - Added PR file collection and post-merge adoption scoring that rewards earlier work when later merged PRs by other engineers touch the same files or product areas - `backend/src/modules/github/github.service.ts`, `backend/src/modules/github/github.types.ts`, `backend/src/modules/impact/impact.ingestion.ts`, `README.md`.
- 2026-07-06 15:30 - Railway Production Readiness - Removed production mock fallback, added explicit `NO_IMPACT_REPORT` response before first refresh, added Railway monorepo build/start scripts, and documented backend/frontend/refresh/Postgres deployment flow - `backend/src/modules/impact/impact.repository.ts`, `backend/src/modules/impact/impact.routes.ts`, `package.json`, `railway.toml`, `RAILWAY_DEPLOYMENT.md`, `README.md`.
- 2026-07-06 15:45 - Live Dashboard Feed - Added one-minute frontend polling, area/confidence/dimension filters, clickable engineer bar chart, selected-engineer dimension line chart, and refresh-worker interval support with overlap protection - `frontend/src/features/impact-dashboard`, `frontend/src/styles/global.css`, `backend/src/jobs/refreshImpactData.ts`, `backend/src/config/env.ts`, `backend/.env.example`.

## Definition of Done

The project is ready when:

- The dashboard fits on a single laptop screen.
- The top five engineers are ranked by meaningful impact signals.
- Each engineer has evidence and explanation.
- Metrics are categorized by score, explanation, diagnostic, guardrail, or audit purpose.
- The backend owns scoring and GitHub data handling.
- The frontend consumes only backend API data.
- The app is deployed on Railway.
- Secrets are kept out of the frontend.
- The average dashboard API response is under 150ms.
- GitHub ingestion and scoring do not run on user-facing API request paths.
- Pagination exists for every unbounded backend list.
- Background queue or scheduled jobs handle long-running refresh work.
- Frontend styling follows the WorkWeave-inspired glass and color-token system.
- The architecture and update log are current.
