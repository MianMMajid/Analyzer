import { backendEnvironment } from '../../config/env.js'
import { calculateImpactScore } from './impact.scoring.js'
import type { ImpactEngineer } from './impact.types.js'

type SeedImpactEngineer = Omit<ImpactEngineer, 'rank' | 'totalScore'>

const reportGeneratedAt = '2026-07-06T21:30:00.000Z'
const analysisWindowStartedAt = '2026-04-07T00:00:00.000Z'

// This first report is derived from local PostHog git history for the 90-day
// window. It uses real authors and PR-numbered commit subjects while the
// production ingestion path will add reviews, comments, labels, and changed files.
const candidateEngineers = [
  {
    id: 'paul-dambra',
    name: "Paul D'Ambra",
    githubLogin: 'pauldambra',
    primaryImpactArea: 'Frontend reliability and engineering leverage',
    primaryContributionTheme:
      'Reduced expensive UI test patterns, stabilized live product surfaces, and added reusable frontend infrastructure.',
    areas: ['Frontend', 'CI', 'Logs', 'Dashboard UI'],
    breakdown: {
      customerValue: 88,
      technicalLeverage: 97,
      riskReduction: 91,
      ownership: 94,
      collaboration: 82,
    },
    explanation:
      'Paul ranks highest because the history shows a rare mix of user-facing fixes, CI/test leverage, performance cleanup, and reusable frontend infrastructure rather than isolated activity volume.',
    riskQualityNote:
      'Strongest quality signal: repeated removal of frontend test and runtime failure modes that would otherwise slow every contributor or degrade live operational views.',
    confidence: 'medium',
    evidence: [
      {
        title: 'fix(frontend): clear the ByRole name-query backlog, flip semgrep rule to blocking (#68740)',
        url: 'https://github.com/PostHog/posthog/pull/68740',
        reason: 'Turns a recurring frontend test reliability problem into an enforceable guardrail.',
        whyItMatters: 'Faster, more reliable tests compound across the whole PostHog frontend team.',
        contributionType: 'Technical leverage',
        area: 'Frontend',
        kind: 'pull_request',
      },
      {
        title: 'fix(logs): stop cloning every log per live-tail tick (#68547)',
        url: 'https://github.com/PostHog/posthog/pull/68547',
        reason: 'Targets runtime waste in a live operational workflow rather than producing cosmetic churn.',
        whyItMatters: 'Live-tail responsiveness affects customers debugging production behavior in PostHog.',
        contributionType: 'Risk reduction',
        area: 'Logs',
        kind: 'pull_request',
      },
      {
        title: 'feat(lib): add reconcileById identity-preserving list reconciliation (#68526)',
        url: 'https://github.com/PostHog/posthog/pull/68526',
        reason: 'Creates a reusable primitive that prevents repeated UI state bugs.',
        whyItMatters: 'Shared reconciliation logic reduces future regressions across dynamic lists and panels.',
        contributionType: 'Technical leverage',
        area: 'Frontend platform',
        kind: 'pull_request',
      },
    ],
  },
  {
    id: 'sam-pennington',
    name: 'Sam Pennington',
    githubLogin: 'sampennington',
    primaryImpactArea: 'Analytics and charting quality',
    primaryContributionTheme:
      'Sustained ownership of refreshed insights and chart rendering, where correctness directly affects customer trust.',
    areas: ['Analytics', 'Quill charts', 'Insights', 'MCP analytics'],
    breakdown: {
      customerValue: 96,
      technicalLeverage: 84,
      riskReduction: 82,
      ownership: 93,
      collaboration: 76,
    },
    explanation:
      'Sam shows sustained ownership of analytics and charting, with a concentration of feature and fix work in high-visibility customer workflows.',
    riskQualityNote:
      'Strongest quality signal: chart correctness and controlled feature-flag rollout for refreshed analytics surfaces.',
    confidence: 'medium',
    evidence: [
      {
        title: 'fix(quill-charts): right y-axis rendering and per-axis, per-edge axis config (#68736)',
        url: 'https://github.com/PostHog/posthog/pull/68736',
        reason: 'Fixes chart rendering correctness in a surface customers use to interpret product data.',
        whyItMatters: 'A misleading axis can invalidate customer analysis even when the underlying data is correct.',
        contributionType: 'Customer value',
        area: 'Analytics charts',
        kind: 'pull_request',
      },
      {
        title: 'feat(mcp-analytics): adopt the insights refreshed chart config (#68403)',
        url: 'https://github.com/PostHog/posthog/pull/68403',
        reason: 'Moves analytics surfaces toward a unified chart configuration.',
        whyItMatters:
          'Consistency across insights lowers maintenance cost and gives customers a more predictable reporting experience.',
        contributionType: 'Technical leverage',
        area: 'Insights',
        kind: 'pull_request',
      },
      {
        title: 'feat(insights): enable refreshed quill chart styling behind a feature flag (#67779)',
        url: 'https://github.com/PostHog/posthog/pull/67779',
        reason: 'Ships visible UX improvement through a controlled rollout path.',
        whyItMatters: 'Feature-flagged rollout balances customer value with safety for a central analytics workflow.',
        contributionType: 'Risk reduction',
        area: 'Insights',
        kind: 'pull_request',
      },
    ],
  },
  {
    id: 'raul-negron-otero',
    name: 'Raúl Negrón-Otero',
    githubLogin: 'rnegron',
    primaryImpactArea: 'CI, HogQL, and engineering systems',
    primaryContributionTheme:
      'Improved CI freshness, preflight checks, and telemetry that reduce hidden drag for the whole engineering team.',
    areas: ['CI', 'HogQL', 'Engineering analytics', 'Developer tooling'],
    breakdown: {
      customerValue: 74,
      technicalLeverage: 98,
      riskReduction: 93,
      ownership: 88,
      collaboration: 84,
    },
    explanation:
      'Raúl ranks highly because the work is less flashy but highly compounding: CI freshness, preflight checks, telemetry, and query-adjacent reliability reduce hidden drag across the team.',
    riskQualityNote:
      'Strongest quality signal: making trunk health and test telemetry more trustworthy before failures reach customers.',
    confidence: 'medium',
    evidence: [
      {
        title: 'fix(ci): verify runs-index freshness in master alerter (#68664)',
        url: 'https://github.com/PostHog/posthog/pull/68664',
        reason: 'Improves confidence in trunk health signals.',
        whyItMatters:
          'Bad CI freshness can cause engineers to trust the wrong signal when deciding whether PostHog is safe to ship.',
        contributionType: 'Risk reduction',
        area: 'CI',
        kind: 'pull_request',
      },
      {
        title: 'feat(hogli): add ci:preflight pre-push hook, checks, and telemetry (#65581)',
        url: 'https://github.com/PostHog/posthog/pull/65581',
        reason: 'Moves quality feedback earlier in the workflow and instruments the system.',
        whyItMatters: 'Earlier feedback prevents wasted review cycles and helps the team improve CI with evidence.',
        contributionType: 'Technical leverage',
        area: 'Developer tooling',
        kind: 'pull_request',
      },
      {
        title: 'fix(ci): capture pytest reruns in CI test telemetry (#67904)',
        url: 'https://github.com/PostHog/posthog/pull/67904',
        reason: 'Makes flaky or retry-heavy test behavior visible.',
        whyItMatters: 'Reliable telemetry is a prerequisite for reducing engineering drag from test instability.',
        contributionType: 'Technical leverage',
        area: 'Testing',
        kind: 'pull_request',
      },
    ],
  },
  {
    id: 'eli-reisman',
    name: 'Eli Reisman',
    githubLogin: 'elireisman',
    primaryImpactArea: 'Batch import and data ingestion reliability',
    primaryContributionTheme:
      'Repeatedly removed edge-case failure modes from import processing, improving correctness and bounded resource usage.',
    areas: ['Batch import', 'Data warehouse', 'Ingestion', 'Operational reliability'],
    breakdown: {
      customerValue: 83,
      technicalLeverage: 87,
      riskReduction: 98,
      ownership: 91,
      collaboration: 70,
    },
    explanation:
      'Eli stands out for concentrated reliability ownership in batch import workflows, repeatedly removing edge-case failure modes rather than adding visible product surface area.',
    riskQualityNote:
      'Strongest quality signal: bounded disk and stream behavior in background import paths where silent failures can affect customer data availability.',
    confidence: 'medium',
    evidence: [
      {
        title: 'fix(batch-import-worker): detect still-compressed import data with disambiguated errors (#68741)',
        url: 'https://github.com/PostHog/posthog/pull/68741',
        reason: 'Turns ambiguous import breakage into actionable errors.',
        whyItMatters: 'Clear ingestion failures shorten support and recovery loops when customers import data.',
        contributionType: 'Risk reduction',
        area: 'Batch import',
        kind: 'pull_request',
      },
      {
        title: 'fix(batch-import-worker): stop infinite 1-byte crawl when part is consumed at EOF (#68356)',
        url: 'https://github.com/PostHog/posthog/pull/68356',
        reason: 'Removes a resource-exhaustion edge case in background processing.',
        whyItMatters: 'A stuck worker can delay customer data availability and consume operational capacity.',
        contributionType: 'Risk reduction',
        area: 'Ingestion',
        kind: 'pull_request',
      },
      {
        title: 'fix(batch-import-worker): stream decompression to bound staging disk (#67149)',
        url: 'https://github.com/PostHog/posthog/pull/67149',
        reason: 'Bounds disk usage during import processing.',
        whyItMatters: 'Bounded resource use prevents one import path from creating wider operational instability.',
        contributionType: 'Technical leverage',
        area: 'Data warehouse',
        kind: 'pull_request',
      },
    ],
  },
  {
    id: 'joshua-snyder',
    name: 'Joshua Snyder',
    githubLogin: 'joshua-snyder',
    primaryImpactArea: 'Signals, agents, and billing-adjacent workflows',
    primaryContributionTheme:
      'Advanced newer Signals capability while fixing usage and billing surfaces that affect customer trust.',
    areas: ['Signals', 'Agents', 'Inbox', 'Billing'],
    breakdown: {
      customerValue: 89,
      technicalLeverage: 79,
      riskReduction: 80,
      ownership: 87,
      collaboration: 72,
    },
    explanation:
      'Joshua ranks in the top five because the work combines new Signals capability with practical fixes around usage and billing surfaces, indicating ownership of an emerging product area.',
    riskQualityNote:
      'Strongest quality signal: making usage and billing status clearer while advancing a newer automation pipeline.',
    confidence: 'medium',
    evidence: [
      {
        title: 'feat(signals): add codex runtime support to the pipeline (#68750)',
        url: 'https://github.com/PostHog/posthog/pull/68750',
        reason: 'Expands the Signals pipeline to support an important runtime.',
        whyItMatters: 'Runtime support increases product capability in an emerging PostHog automation area.',
        contributionType: 'Customer value',
        area: 'Signals',
        kind: 'pull_request',
      },
      {
        title: 'feat(inbox): show actual spend in the usage section (#67365)',
        url: 'https://github.com/PostHog/posthog/pull/67365',
        reason: 'Improves customer visibility into spend.',
        whyItMatters: 'Spend clarity affects trust and usage decisions for customers evaluating product value.',
        contributionType: 'Customer value',
        area: 'Inbox',
        kind: 'pull_request',
      },
      {
        title: 'fix(billing): show product name in usage limit approaching banner (#66314)',
        url: 'https://github.com/PostHog/posthog/pull/66314',
        reason: 'Clarifies billing-limit warnings.',
        whyItMatters: 'Customers can act on usage-limit warnings only when the affected product is obvious.',
        contributionType: 'Risk reduction',
        area: 'Billing',
        kind: 'pull_request',
      },
    ],
  },
] satisfies readonly SeedImpactEngineer[]

// Ranking happens after scoring so future GitHub-generated data can reuse this same path.
export const seedImpactEngineers = candidateEngineers
  .map((engineer) => ({
    ...engineer,
    totalScore: calculateImpactScore(engineer.breakdown),
  }))
  .sort((left, right) => right.totalScore - left.totalScore)
  .map((engineer, index) => ({
    ...engineer,
    rank: index + 1,
  })) satisfies readonly ImpactEngineer[]

export const seedReportGeneratedAt = reportGeneratedAt

// The backend owns analysis-window semantics because refresh execution time
// determines the eventual GitHub query bounds.
export const seedAnalysisWindow = {
  label: `${analysisWindowStartedAt.slice(0, 10)} to ${reportGeneratedAt.slice(0, 10)}`,
  days: backendEnvironment.analysisWindowDays,
  startedAt: analysisWindowStartedAt,
  endedAt: reportGeneratedAt,
} as const
