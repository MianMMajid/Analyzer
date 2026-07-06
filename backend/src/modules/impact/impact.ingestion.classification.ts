import type { GitHubPullRequest, GitHubPullRequestFile, GitHubPullRequestReview } from '../github/github.types.js'
import { createZeroBreakdown, recencyMultiplier } from './impact.dimensions.js'
import type { ImpactScoreBreakdown } from './impact.types.js'

export type PullRequestClassification = {
  readonly area: string
  readonly contributionType: string
  readonly reason: string
  readonly whyItMatters: string
  readonly dimensions: ImpactScoreBreakdown
  readonly innovationReach: number
}

export type PullRequestFootprint = {
  readonly paths: ReadonlySet<string>
  readonly areas: ReadonlySet<string>
}

export function classifyPullRequest(pullRequest: GitHubPullRequest): PullRequestClassification {
  const text = `${pullRequest.title} ${pullRequest.body} ${pullRequest.labels.join(' ')}`.toLowerCase()
  const area = inferArea(text)
  const dimensions = createZeroBreakdown()
  const areaReach = areaImportance(area)
  const hasLinkedIssue = pullRequest.linkedIssueNumbers.length > 0

  if (hasAny(text, ['fix', 'bug', 'revert', 'incident', 'reliability', 'security', 'perf', 'performance'])) {
    dimensions.riskReduction = 22 + (hasLinkedIssue ? 5 : 0)
    dimensions.customerValue = 8 + areaReach
    dimensions.technicalLeverage = hasAny(text, ['test', 'ci', 'infra', 'tooling']) ? 10 : 4
    dimensions.ownership = 8 + areaReach

    return {
      area,
      contributionType: 'Risk reduction',
      reason: 'Addresses a correctness, reliability, security, performance, or operational risk signal.',
      whyItMatters: 'Risk-reducing changes protect customer trust and reduce future engineering drag.',
      dimensions,
      innovationReach: areaReach,
    }
  }

  if (hasAny(text, ['test', 'ci', 'infra', 'refactor', 'migration', 'typing', 'types', 'tooling', 'architecture'])) {
    dimensions.technicalLeverage = 24
    dimensions.ownership = 12 + areaReach
    dimensions.riskReduction = 7

    return {
      area,
      contributionType: 'Technical leverage',
      reason: 'Improves shared engineering systems, architecture, quality gates, or maintainability.',
      whyItMatters: 'Leverage work compounds because it makes future product work safer or faster.',
      dimensions,
      innovationReach: areaReach,
    }
  }

  dimensions.customerValue = 20 + areaReach + (hasLinkedIssue ? 4 : 0)
  dimensions.ownership = 9 + areaReach
  dimensions.technicalLeverage = hasAny(text, ['api', 'pipeline', 'framework', 'runtime']) ? 8 : 3

  return {
    area,
    contributionType: hasAny(text, ['feat', 'feature', 'new']) ? 'Innovation and reach' : 'Customer value',
    reason: 'Ships visible product, platform capability, or workflow value.',
    whyItMatters: 'Customer-facing improvements are weighted by reach, linked problem context, and evidence quality.',
    dimensions,
    innovationReach: areaReach,
  }
}

export function buildFileFootprint(files: readonly GitHubPullRequestFile[]): PullRequestFootprint {
  const paths = new Set<string>()
  const areas = new Set<string>()

  for (const file of files) {
    paths.add(file.path)
    areas.add(inferAreaFromPath(file.path))
  }

  return { paths, areas }
}

export function countIntersection(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let count = 0
  const smaller = left.size <= right.size ? left : right
  const larger = left.size <= right.size ? right : left

  for (const value of smaller) {
    if (larger.has(value)) {
      count += 1
    }
  }

  return count
}

export function scorePullRequestEvidence(
  pullRequest: GitHubPullRequest,
  window: { readonly since: Date; readonly now: Date },
  classification: PullRequestClassification,
): number {
  const occurredAt = pullRequest.mergedAt ?? pullRequest.closedAt ?? pullRequest.updatedAt
  const baseStrength = Math.max(...Object.values(classification.dimensions))
  const issueLinkBonus = pullRequest.linkedIssueNumbers.length > 0 ? 4 : 0
  const mergeConfidence = pullRequest.mergedAt === undefined ? 0 : 4

  return Math.round(
    (baseStrength + classification.innovationReach + issueLinkBonus + mergeConfidence) *
      recencyMultiplier(new Date(occurredAt), window),
  )
}

export function scoreReviewQuality(review: GitHubPullRequestReview): number {
  const bodyLength = review.body.trim().length
  const depthBonus = bodyLength >= 240 ? 8 : bodyLength >= 80 ? 5 : bodyLength >= 20 ? 2 : 0

  if (review.state === 'CHANGES_REQUESTED') {
    return 23 + depthBonus
  }

  if (review.state === 'APPROVED') {
    return 12 + depthBonus
  }

  if (review.state === 'COMMENTED') {
    return 10 + depthBonus
  }

  return 5
}

export function hasAny(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(needle))
}

function inferArea(text: string): string {
  if (hasAny(text, ['hogql', 'query', 'insight', 'chart', 'analytics'])) return 'Analytics'
  if (hasAny(text, ['ci', 'test', 'pytest', 'flaky'])) return 'CI and testing'
  if (hasAny(text, ['billing', 'usage', 'plan'])) return 'Billing'
  if (hasAny(text, ['ingest', 'import', 'warehouse', 'batch'])) return 'Data ingestion'
  if (hasAny(text, ['frontend', 'ui', 'dashboard', 'react'])) return 'Frontend'
  if (hasAny(text, ['security', 'auth', 'permission'])) return 'Security'
  if (hasAny(text, ['agent', 'signals', 'runtime'])) return 'Signals and automation'
  return 'Repository-wide'
}

function inferAreaFromPath(path: string): string {
  const normalizedPath = path.toLowerCase()

  if (hasAny(normalizedPath, ['queries/', 'insights/', 'hogql', 'charts/', 'analytics'])) return 'Analytics'
  if (hasAny(normalizedPath, ['.github/', 'ci/', 'pytest', 'tests/', '__tests__/', 'test/'])) return 'CI and testing'
  if (hasAny(normalizedPath, ['billing', 'usage'])) return 'Billing'
  if (hasAny(normalizedPath, ['warehouse', 'ingest', 'import', 'batch'])) return 'Data ingestion'
  if (hasAny(normalizedPath, ['frontend/', 'src/scenes/', 'src/lib/', '.tsx', '.jsx'])) return 'Frontend'
  if (hasAny(normalizedPath, ['auth', 'security', 'permission'])) return 'Security'
  if (hasAny(normalizedPath, ['signals', 'agents'])) return 'Signals and automation'

  return topLevelPath(path)
}

function topLevelPath(path: string): string {
  const slashIndex = path.indexOf('/')

  return slashIndex === -1 ? path || 'Repository-wide' : path.slice(0, slashIndex)
}

function areaImportance(area: string): number {
  switch (area) {
    case 'Analytics':
    case 'Data ingestion':
    case 'Security':
      return 6
    case 'Billing':
    case 'CI and testing':
    case 'Signals and automation':
      return 4
    case 'Frontend':
      return 3
    default:
      return 1
  }
}
