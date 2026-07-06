import { normalizeContributorIdentity } from '../contributors/contributors.normalizer.js'
import {
  createGitHubCollectionService,
  type GitHubCollectionService,
} from '../github/github.service.js'
import type {
  GitHubCommit,
  GitHubPullRequest,
  GitHubPullRequestDiscussion,
  GitHubPullRequestReview,
} from '../github/github.types.js'
import { calculateImpactScore } from './impact.scoring.js'
import type { ImpactEngineer, ImpactEvidence, ImpactScoreBreakdown } from './impact.types.js'
import type { ImpactReportRecord } from './impact.repository.js'

export type BuildImpactReportOptions = {
  readonly repository: string
  readonly analysisWindowDays: number
  readonly githubToken?: string
  readonly now?: Date
  readonly service?: GitHubCollectionService
  readonly maxDiscussionPullRequests?: number
}

type EngineerAggregate = {
  readonly id: string
  readonly login: string
  displayName: string
  pullRequests: number
  mergedPullRequests: number
  commits: number
  reviewsGiven: number
  reviewComments: number
  issueComments: number
  customerSignals: number
  leverageSignals: number
  riskSignals: number
  areas: Set<string>
  evidence: WeightedEvidence[]
}

type WeightedEvidence = ImpactEvidence & {
  readonly weight: number
}

export async function buildImpactReportFromGitHub(options: BuildImpactReportOptions): Promise<ImpactReportRecord> {
  const now = options.now ?? new Date()
  const since = new Date(now.getTime() - options.analysisWindowDays * 24 * 60 * 60 * 1_000)
  const service =
    options.service ??
    createGitHubCollectionService({
      repository: options.repository,
      ...(options.githubToken === undefined ? {} : { token: options.githubToken }),
    })
  const [pullRequests, commits] = await Promise.all([
    service.fetchPullRequestsUpdatedSince({ since, until: now, perPage: 100 }),
    service.fetchCommitsSince({ since, until: now, perPage: 100 }),
  ])
  const aggregates = new Map<string, EngineerAggregate>()

  for (const pullRequest of pullRequests.items) {
    addPullRequestSignal(aggregates, pullRequest)
  }

  for (const commit of commits.items) {
    addCommitSignal(aggregates, commit)
  }

  const discussionTargets = [...pullRequests.items]
    .filter((pullRequest) => pullRequest.authorLogin !== undefined)
    .sort((left, right) => scorePullRequestEvidence(right) - scorePullRequestEvidence(left))
    .slice(0, options.maxDiscussionPullRequests ?? 20)

  for (const pullRequest of discussionTargets) {
    const discussion = await service.fetchPullRequestDiscussion(pullRequest.number, { perPage: 100 })
    addDiscussionSignals(aggregates, pullRequest, discussion)
  }

  const engineers = [...aggregates.values()]
    .filter((aggregate) => aggregate.pullRequests > 0 || aggregate.commits > 0 || aggregate.reviewsGiven > 0)
    .map(toImpactEngineer)
    .sort((left, right) => right.totalScore - left.totalScore)
    .slice(0, 5)
    .map((engineer, index) => ({
      ...engineer,
      rank: index + 1,
    })) satisfies readonly ImpactEngineer[]

  return {
    repository: options.repository,
    generatedAt: now.toISOString(),
    analysisWindow: {
      label: `${since.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)}`,
      days: options.analysisWindowDays,
      startedAt: since.toISOString(),
      endedAt: now.toISOString(),
    },
    engineers,
    source: 'github_ingestion',
  }
}

function addPullRequestSignal(aggregates: Map<string, EngineerAggregate>, pullRequest: GitHubPullRequest): void {
  if (pullRequest.authorLogin === undefined) {
    return
  }

  const aggregate = getAggregate(aggregates, { login: pullRequest.authorLogin })
  if (aggregate === undefined) {
    return
  }
  const classification = classifyPullRequest(pullRequest)

  aggregate.pullRequests += 1
  aggregate.mergedPullRequests += pullRequest.mergedAt === undefined ? 0 : 1
  aggregate.reviewComments += pullRequest.reviewCommentCount
  aggregate.issueComments += pullRequest.issueCommentCount
  aggregate.customerSignals += classification.customer
  aggregate.leverageSignals += classification.leverage
  aggregate.riskSignals += classification.risk
  aggregate.areas.add(classification.area)
  aggregate.evidence.push({
    title: `#${pullRequest.number}: ${pullRequest.title}`,
    url: pullRequest.htmlUrl,
    reason: classification.reason,
    whyItMatters: classification.whyItMatters,
    contributionType: classification.contributionType,
    area: classification.area,
    kind: 'pull_request',
    weight: scorePullRequestEvidence(pullRequest),
  })
}

function addCommitSignal(aggregates: Map<string, EngineerAggregate>, commit: GitHubCommit): void {
  const aggregate = getAggregate(aggregates, {
    login: commit.author.login,
    email: commit.author.email,
    name: commit.author.name,
  })
  if (aggregate === undefined) {
    return
  }

  aggregate.commits += 1
  const message = commit.message.toLowerCase()

  if (message.includes('fix') || message.includes('revert')) {
    aggregate.riskSignals += 1
  }

  if (message.includes('test') || message.includes('ci') || message.includes('refactor')) {
    aggregate.leverageSignals += 1
  }
}

function addDiscussionSignals(
  aggregates: Map<string, EngineerAggregate>,
  pullRequest: GitHubPullRequest,
  discussion: GitHubPullRequestDiscussion,
): void {
  for (const review of discussion.reviews) {
    addReviewSignal(aggregates, pullRequest, review)
  }
}

function addReviewSignal(
  aggregates: Map<string, EngineerAggregate>,
  pullRequest: GitHubPullRequest,
  review: GitHubPullRequestReview,
): void {
  if (review.authorLogin === undefined || review.authorLogin === pullRequest.authorLogin) {
    return
  }

  const aggregate = getAggregate(aggregates, { login: review.authorLogin })
  if (aggregate === undefined) {
    return
  }

  aggregate.reviewsGiven += review.state === 'APPROVED' ? 2 : 1
  aggregate.leverageSignals += review.state === 'CHANGES_REQUESTED' ? 1 : 0
  aggregate.evidence.push({
    title: `Reviewed #${pullRequest.number}: ${pullRequest.title}`,
    url: review.htmlUrl,
    reason: `Provided ${review.state.toLowerCase().replaceAll('_', ' ')} review feedback.`,
    whyItMatters: 'Meaningful review work reduces regressions and spreads context across the engineering team.',
    contributionType: 'Collaboration',
    area: classifyPullRequest(pullRequest).area,
    kind: 'review',
    weight: review.state === 'CHANGES_REQUESTED' ? 7 : 5,
  })
}

function getAggregate(
  aggregates: Map<string, EngineerAggregate>,
  identity: { readonly login?: string | undefined; readonly email?: string | undefined; readonly name?: string | undefined },
): EngineerAggregate | undefined {
  const normalized = normalizeContributorIdentity({
    ...(identity.login === undefined ? {} : { login: identity.login }),
    ...(identity.email === undefined ? {} : { email: identity.email }),
    ...(identity.name === undefined ? {} : { name: identity.name }),
  })

  if (normalized.isBot || normalized.confidence === 'ambiguous' || normalized.confidence === 'excluded') {
    return undefined
  }

  const login = normalized.normalizedLogin ?? normalized.inferredLogin ?? normalized.normalizedEmail ?? normalized.id
  const existing = aggregates.get(login)

  if (existing !== undefined) {
    return existing
  }

  const aggregate: EngineerAggregate = {
    id: login.replaceAll(/[^a-z0-9-]/gu, '-'),
    login,
    displayName: normalized.displayName,
    pullRequests: 0,
    mergedPullRequests: 0,
    commits: 0,
    reviewsGiven: 0,
    reviewComments: 0,
    issueComments: 0,
    customerSignals: 0,
    leverageSignals: 0,
    riskSignals: 0,
    areas: new Set(),
    evidence: [],
  }

  aggregates.set(login, aggregate)
  return aggregate
}

function toImpactEngineer(aggregate: EngineerAggregate): ImpactEngineer {
  const breakdown = buildBreakdown(aggregate)
  const evidence = aggregate.evidence
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 3)
    .map(({ weight: _weight, ...item }) => item)
  const primaryArea = [...aggregate.areas][0] ?? 'Repository-wide'
  const totalScore = calculateImpactScore(breakdown)

  return {
    id: aggregate.id,
    name: toDisplayName(aggregate.displayName, aggregate.login),
    githubLogin: aggregate.login,
    rank: 1,
    totalScore,
    primaryImpactArea: primaryArea,
    primaryContributionTheme: summarizeContributionTheme(aggregate),
    areas: [...aggregate.areas].slice(0, 5),
    breakdown,
    explanation: explainRanking(aggregate, totalScore),
    riskQualityNote: buildRiskQualityNote(aggregate),
    confidence: evidence.length >= 3 && aggregate.mergedPullRequests >= 2 ? 'high' : evidence.length >= 2 ? 'medium' : 'low',
    evidence,
  }
}

function buildBreakdown(aggregate: EngineerAggregate): ImpactScoreBreakdown {
  return {
    customerValue: capScore(35 + aggregate.customerSignals * 8 + aggregate.mergedPullRequests * 4),
    technicalLeverage: capScore(30 + aggregate.leverageSignals * 8 + aggregate.reviewsGiven * 3),
    riskReduction: capScore(30 + aggregate.riskSignals * 9 + aggregate.reviewComments),
    ownership: capScore(25 + aggregate.pullRequests * 5 + aggregate.areas.size * 8 + aggregate.commits),
    collaboration: capScore(25 + aggregate.reviewsGiven * 8 + aggregate.issueComments + Math.min(aggregate.reviewComments, 20)),
  }
}

function classifyPullRequest(pullRequest: GitHubPullRequest): {
  readonly area: string
  readonly customer: number
  readonly leverage: number
  readonly risk: number
  readonly contributionType: string
  readonly reason: string
  readonly whyItMatters: string
} {
  const text = `${pullRequest.title} ${pullRequest.labels.join(' ')}`.toLowerCase()

  if (hasAny(text, ['fix', 'bug', 'revert', 'incident', 'reliability', 'security'])) {
    return {
      area: inferArea(text),
      customer: 1,
      leverage: hasAny(text, ['test', 'ci', 'infra']) ? 1 : 0,
      risk: 3,
      contributionType: 'Risk reduction',
      reason: 'Addresses a correctness, reliability, or operational risk signal.',
      whyItMatters: 'Risk-reducing changes protect customer trust and reduce future engineering drag.',
    }
  }

  if (hasAny(text, ['test', 'ci', 'infra', 'refactor', 'migration', 'typing', 'types', 'tooling'])) {
    return {
      area: inferArea(text),
      customer: 0,
      leverage: 3,
      risk: 1,
      contributionType: 'Technical leverage',
      reason: 'Improves shared engineering systems, quality gates, or maintainability.',
      whyItMatters: 'Leverage work compounds because it makes future product work safer or faster.',
    }
  }

  return {
    area: inferArea(text),
    customer: hasAny(text, ['feat', 'feature', 'ui', 'dashboard', 'insight']) ? 3 : 2,
    leverage: 1,
    risk: 0,
    contributionType: 'Customer value',
    reason: 'Ships visible product or workflow value.',
    whyItMatters: 'Customer-facing improvements are weighted when they land in meaningful product surfaces.',
  }
}

function inferArea(text: string): string {
  if (hasAny(text, ['hogql', 'query', 'insight', 'chart', 'analytics'])) return 'Analytics'
  if (hasAny(text, ['ci', 'test', 'pytest', 'flaky'])) return 'CI and testing'
  if (hasAny(text, ['billing', 'usage', 'plan'])) return 'Billing'
  if (hasAny(text, ['ingest', 'import', 'warehouse', 'batch'])) return 'Data ingestion'
  if (hasAny(text, ['frontend', 'ui', 'dashboard', 'react'])) return 'Frontend'
  if (hasAny(text, ['security', 'auth', 'permission'])) return 'Security'
  return 'Repository-wide'
}

function scorePullRequestEvidence(pullRequest: GitHubPullRequest): number {
  const classification = classifyPullRequest(pullRequest)
  return (
    classification.customer * 4 +
    classification.leverage * 4 +
    classification.risk * 4 +
    (pullRequest.mergedAt === undefined ? 0 : 6) +
    Math.min(pullRequest.reviewCommentCount + pullRequest.issueCommentCount, 10)
  )
}

function summarizeContributionTheme(aggregate: EngineerAggregate): string {
  return `Combined ${aggregate.mergedPullRequests} merged PRs, ${aggregate.commits} commits, and ${aggregate.reviewsGiven} review signals across ${aggregate.areas.size || 1} area(s).`
}

function explainRanking(aggregate: EngineerAggregate, totalScore: number): string {
  return `${toDisplayName(aggregate.displayName, aggregate.login)} scored ${totalScore} through a blend of shipped work, risk reduction, technical leverage, ownership breadth, and review participation.`
}

function buildRiskQualityNote(aggregate: EngineerAggregate): string {
  if (aggregate.riskSignals > aggregate.customerSignals && aggregate.riskSignals > aggregate.leverageSignals) {
    return 'Strongest quality signal: concentrated fixes and reliability-oriented work in the analysis window.'
  }

  if (aggregate.leverageSignals >= aggregate.customerSignals) {
    return 'Strongest quality signal: reusable technical leverage and review activity that improves future engineering throughput.'
  }

  return 'Strongest quality signal: customer-facing work with supporting review and maintenance signals.'
}

function toDisplayName(displayName: string, login: string): string {
  return displayName === login ? login.replaceAll('-', ' ').replaceAll(/\b\w/gu, (letter) => letter.toUpperCase()) : displayName
}

function hasAny(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(needle))
}

function capScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}
