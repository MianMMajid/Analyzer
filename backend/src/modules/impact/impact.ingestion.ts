import { normalizeContributorIdentity } from '../contributors/contributors.normalizer.js'
import {
  createGitHubCollectionService,
  type GitHubCollectionService,
} from '../github/github.service.js'
import type {
  GitHubCommit,
  GitHubPullRequest,
  GitHubPullRequestDiscussion,
  GitHubPullRequestFile,
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
  readonly maxAdoptionPullRequests?: number
}

type DimensionKey = keyof ImpactScoreBreakdown

type DimensionSignals = {
  readonly customerValue: number[]
  readonly technicalLeverage: number[]
  readonly riskReduction: number[]
  readonly ownership: number[]
  readonly collaboration: number[]
}

type EngineerDiagnostics = {
  pullRequests: number
  mergedPullRequests: number
  commits: number
  reviews: number
}

type EngineerAggregate = {
  readonly id: string
  readonly login: string
  displayName: string
  diagnostics: EngineerDiagnostics
  signals: DimensionSignals
  areas: Set<string>
  evidence: WeightedEvidence[]
}

type WeightedEvidence = ImpactEvidence & {
  readonly weight: number
  readonly occurredAt: string
}

type PullRequestClassification = {
  readonly area: string
  readonly contributionType: string
  readonly reason: string
  readonly whyItMatters: string
  readonly dimensions: ImpactScoreBreakdown
  readonly innovationReach: number
}

const diminishingEvidenceWeights = [1, 0.7, 0.45, 0.25, 0.15] as const

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
    addPullRequestSignal(aggregates, pullRequest, { since, now })
  }

  for (const commit of commits.items) {
    addCommitSignal(aggregates, commit, { since, now })
  }

  const discussionTargets = [...pullRequests.items]
    .filter((pullRequest) => pullRequest.authorLogin !== undefined)
    .sort((left, right) => scorePullRequestEvidence(right, { since, now }) - scorePullRequestEvidence(left, { since, now }))
    .slice(0, options.maxDiscussionPullRequests ?? pullRequests.items.length)
  const adoptionTargets = [...pullRequests.items]
    .filter((pullRequest) => pullRequest.authorLogin !== undefined && pullRequest.mergedAt !== undefined)
    .sort((left, right) => scorePullRequestEvidence(right, { since, now }) - scorePullRequestEvidence(left, { since, now }))
    .slice(0, options.maxAdoptionPullRequests ?? pullRequests.items.length)
  const fileMap = await fetchFilesForPullRequests(service, adoptionTargets)

  for (const pullRequest of discussionTargets) {
    const discussion = await service.fetchPullRequestDiscussion(pullRequest.number, { perPage: 100 })
    addDiscussionSignals(aggregates, pullRequest, discussion, { since, now })
  }

  addPostMergeAdoptionSignals(aggregates, adoptionTargets, fileMap, { since, now })

  const rankedAggregates = [...aggregates.values()]
    .filter((aggregate) => aggregate.evidence.length > 0)
    .map((aggregate) => ({
      aggregate,
      breakdown: normalizeBreakdown(buildBaseBreakdown(aggregate), [...aggregates.values()].map(buildBaseBreakdown)),
    }))
    .map(({ aggregate, breakdown }) => toImpactEngineer(aggregate, breakdown))
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
    engineers: rankedAggregates,
    source: 'github_ingestion',
  }
}

function addPullRequestSignal(
  aggregates: Map<string, EngineerAggregate>,
  pullRequest: GitHubPullRequest,
  window: { readonly since: Date; readonly now: Date },
): void {
  if (pullRequest.authorLogin === undefined) {
    return
  }

  const aggregate = getAggregate(aggregates, { login: pullRequest.authorLogin })
  if (aggregate === undefined) {
    return
  }

  const classification = classifyPullRequest(pullRequest)
  const occurredAt = pullRequest.mergedAt ?? pullRequest.closedAt ?? pullRequest.updatedAt
  const recency = recencyMultiplier(new Date(occurredAt), window)
  const issueLinkBonus = pullRequest.linkedIssueNumbers.length > 0 ? 1.12 : 1
  const sizeGuardrail = sizeGuardrailMultiplier(pullRequest)
  const multiplier = recency * issueLinkBonus * sizeGuardrail

  aggregate.diagnostics.pullRequests += 1
  aggregate.diagnostics.mergedPullRequests += pullRequest.mergedAt === undefined ? 0 : 1
  aggregate.areas.add(classification.area)
  addDimensionSignals(aggregate, classification.dimensions, multiplier)
  aggregate.evidence.push({
    title: `#${pullRequest.number}: ${pullRequest.title}`,
    url: pullRequest.htmlUrl,
    reason:
      pullRequest.linkedIssueNumbers.length === 0
        ? classification.reason
        : `${classification.reason} Linked issue(s): ${pullRequest.linkedIssueNumbers.map((issue) => `#${issue}`).join(', ')}.`,
    whyItMatters: classification.whyItMatters,
    contributionType: classification.contributionType,
    area: classification.area,
    kind: 'pull_request',
    weight: scorePullRequestEvidence(pullRequest, window),
    occurredAt,
  })
}

function addCommitSignal(
  aggregates: Map<string, EngineerAggregate>,
  commit: GitHubCommit,
  window: { readonly since: Date; readonly now: Date },
): void {
  const aggregate = getAggregate(aggregates, {
    login: commit.author.login,
    email: commit.author.email,
    name: commit.author.name,
  })
  if (aggregate === undefined) {
    return
  }

  aggregate.diagnostics.commits += 1
  const message = commit.message.toLowerCase()
  const dimensions = createZeroBreakdown()

  if (hasAny(message, ['fix', 'revert', 'security', 'incident'])) {
    dimensions.riskReduction = 10
  }

  if (hasAny(message, ['test', 'ci', 'refactor', 'migration', 'types', 'tooling'])) {
    dimensions.technicalLeverage = 8
  }

  if (hasAny(message, ['feat', 'feature'])) {
    dimensions.customerValue = 8
  }

  if (Object.values(dimensions).some((value) => value > 0)) {
    addDimensionSignals(aggregate, dimensions, recencyMultiplier(new Date(commit.authoredAt), window) * 0.55)
  }
}

function addDiscussionSignals(
  aggregates: Map<string, EngineerAggregate>,
  pullRequest: GitHubPullRequest,
  discussion: GitHubPullRequestDiscussion,
  window: { readonly since: Date; readonly now: Date },
): void {
  for (const review of discussion.reviews) {
    addReviewSignal(aggregates, pullRequest, review, window)
  }
}

async function fetchFilesForPullRequests(
  service: GitHubCollectionService,
  pullRequests: readonly GitHubPullRequest[],
): Promise<ReadonlyMap<number, readonly GitHubPullRequestFile[]>> {
  const entries = await Promise.all(
    pullRequests.map(async (pullRequest) => {
      const result = await service.fetchPullRequestFiles(pullRequest.number, { perPage: 100 })
      return [pullRequest.number, result.items] as const
    }),
  )

  return new Map(entries)
}

function addPostMergeAdoptionSignals(
  aggregates: Map<string, EngineerAggregate>,
  pullRequests: readonly GitHubPullRequest[],
  fileMap: ReadonlyMap<number, readonly GitHubPullRequestFile[]>,
  window: { readonly since: Date; readonly now: Date },
): void {
  const mergedPullRequests = pullRequests
    .filter((pullRequest) => pullRequest.mergedAt !== undefined)
    .sort((left, right) => new Date(left.mergedAt ?? left.updatedAt).getTime() - new Date(right.mergedAt ?? right.updatedAt).getTime())

  for (const source of mergedPullRequests) {
    if (source.authorLogin === undefined || source.mergedAt === undefined) {
      continue
    }

    const sourceFiles = fileMap.get(source.number) ?? []
    const sourceFootprint = buildFileFootprint(sourceFiles)

    if (sourceFootprint.paths.size === 0) {
      continue
    }

    const adopters = new Set<string>()
    let exactPathOverlap = 0
    let areaOverlap = 0

    for (const later of mergedPullRequests) {
      if (later.number === source.number || later.authorLogin === undefined || later.authorLogin === source.authorLogin) {
        continue
      }

      if (new Date(later.mergedAt ?? later.updatedAt).getTime() <= new Date(source.mergedAt).getTime()) {
        continue
      }

      const laterFootprint = buildFileFootprint(fileMap.get(later.number) ?? [])
      const exactOverlap = countIntersection(sourceFootprint.paths, laterFootprint.paths)
      const sharedAreas = countIntersection(sourceFootprint.areas, laterFootprint.areas)

      if (exactOverlap > 0 || sharedAreas > 0) {
        adopters.add(later.authorLogin)
        exactPathOverlap += Math.min(exactOverlap, 3)
        areaOverlap += exactOverlap > 0 ? 0 : Math.min(sharedAreas, 2)
      }
    }

    if (adopters.size === 0) {
      continue
    }

    const aggregate = getAggregate(aggregates, { login: source.authorLogin })
    if (aggregate === undefined) {
      continue
    }

    const adoptionStrength = Math.min(34, 14 + Math.min(adopters.size, 3) * 4 + Math.min(exactPathOverlap, 8) * 2 + Math.min(areaOverlap, 4))
    const dimensions = createZeroBreakdown()
    dimensions.ownership = adoptionStrength
    dimensions.technicalLeverage = Math.round(adoptionStrength * 0.72)
    const primaryArea = [...sourceFootprint.areas][0] ?? classifyPullRequest(source).area

    aggregate.areas.add(primaryArea)
    addDimensionSignals(aggregate, dimensions, recencyMultiplier(new Date(source.mergedAt), window))
    aggregate.evidence.push({
      title: `Post-merge adoption after #${source.number}: ${source.title}`,
      url: source.htmlUrl,
      reason: `Later merged work by ${[...adopters].slice(0, 3).join(', ')} touched the same files or product area.`,
      whyItMatters: 'Post-merge adoption indicates the change created a useful foundation that other engineers built on.',
      contributionType: 'Post-merge adoption',
      area: primaryArea,
      kind: 'contribution_theme',
      weight: adoptionStrength,
      occurredAt: source.mergedAt,
    })
  }
}

function addReviewSignal(
  aggregates: Map<string, EngineerAggregate>,
  pullRequest: GitHubPullRequest,
  review: GitHubPullRequestReview,
  window: { readonly since: Date; readonly now: Date },
): void {
  if (review.authorLogin === undefined || review.authorLogin === pullRequest.authorLogin) {
    return
  }

  const aggregate = getAggregate(aggregates, { login: review.authorLogin })
  if (aggregate === undefined) {
    return
  }

  const reviewQuality = scoreReviewQuality(review)
  const pullRequestClassification = classifyPullRequest(pullRequest)
  const occurredAt = review.submittedAt ?? pullRequest.updatedAt
  const dimensions = createZeroBreakdown()
  dimensions.collaboration = reviewQuality
  dimensions.technicalLeverage = review.state === 'CHANGES_REQUESTED' ? Math.round(reviewQuality * 0.65) : Math.round(reviewQuality * 0.35)
  dimensions.riskReduction = review.state === 'CHANGES_REQUESTED' ? Math.round(reviewQuality * 0.45) : 0

  aggregate.diagnostics.reviews += 1
  aggregate.areas.add(pullRequestClassification.area)
  addDimensionSignals(aggregate, dimensions, recencyMultiplier(new Date(occurredAt), window))
  aggregate.evidence.push({
    title: `Reviewed #${pullRequest.number}: ${pullRequest.title}`,
    url: review.htmlUrl,
    reason: `Provided ${review.state.toLowerCase().replaceAll('_', ' ')} review feedback with quality-weighted scoring.`,
    whyItMatters: 'Review impact is weighted by signal quality, not by raw review count.',
    contributionType: 'Collaboration',
    area: pullRequestClassification.area,
    kind: 'review',
    weight: reviewQuality,
    occurredAt,
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
    diagnostics: {
      pullRequests: 0,
      mergedPullRequests: 0,
      commits: 0,
      reviews: 0,
    },
    signals: createDimensionSignals(),
    areas: new Set(),
    evidence: [],
  }

  aggregates.set(login, aggregate)
  return aggregate
}

function toImpactEngineer(aggregate: EngineerAggregate, breakdown: ImpactScoreBreakdown): ImpactEngineer {
  const evidence = aggregate.evidence
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 3)
    .map(({ weight: _weight, occurredAt: _occurredAt, ...item }) => item)
  const primaryArea = [...aggregate.areas][0] ?? 'Repository-wide'
  const totalScore = calculateImpactScore(breakdown)

  return {
    id: aggregate.id,
    name: toDisplayName(aggregate.displayName, aggregate.login),
    githubLogin: aggregate.login,
    rank: 1,
    totalScore,
    primaryImpactArea: primaryArea,
    primaryContributionTheme: summarizeContributionTheme(aggregate, breakdown),
    areas: [...aggregate.areas].slice(0, 5),
    breakdown,
    explanation: explainRanking(aggregate, totalScore),
    riskQualityNote: buildRiskQualityNote(breakdown),
    confidence: evidence.length >= 3 && strongestEvidenceWeight(aggregate) >= 24 ? 'high' : evidence.length >= 2 ? 'medium' : 'low',
    evidence,
  }
}

function buildBaseBreakdown(aggregate: EngineerAggregate): ImpactScoreBreakdown {
  return {
    customerValue: scoreDimension(aggregate.signals.customerValue),
    technicalLeverage: scoreDimension(aggregate.signals.technicalLeverage),
    riskReduction: scoreDimension(aggregate.signals.riskReduction),
    ownership: scoreDimension(aggregate.signals.ownership),
    collaboration: scoreDimension(aggregate.signals.collaboration),
  }
}

function normalizeBreakdown(base: ImpactScoreBreakdown, allBreakdowns: readonly ImpactScoreBreakdown[]): ImpactScoreBreakdown {
  return {
    customerValue: normalizeDimension(base.customerValue, allBreakdowns.map((breakdown) => breakdown.customerValue)),
    technicalLeverage: normalizeDimension(base.technicalLeverage, allBreakdowns.map((breakdown) => breakdown.technicalLeverage)),
    riskReduction: normalizeDimension(base.riskReduction, allBreakdowns.map((breakdown) => breakdown.riskReduction)),
    ownership: normalizeDimension(base.ownership, allBreakdowns.map((breakdown) => breakdown.ownership)),
    collaboration: normalizeDimension(base.collaboration, allBreakdowns.map((breakdown) => breakdown.collaboration)),
  }
}

function normalizeDimension(value: number, values: readonly number[]): number {
  if (value <= 0) {
    return 0
  }

  const lowerOrEqualCount = values.filter((candidate) => candidate <= value).length
  const percentile = values.length <= 1 ? 1 : (lowerOrEqualCount - 1) / (values.length - 1)

  return capScore(value * 0.75 + (45 + percentile * 45) * 0.25)
}

function scoreDimension(values: readonly number[]): number {
  if (values.length === 0) {
    return 0
  }

  const weightedEvidence = [...values]
    .sort((left, right) => right - left)
    .slice(0, diminishingEvidenceWeights.length)
    .reduce((total, value, index) => total + value * (diminishingEvidenceWeights[index] ?? 0), 0)

  return capScore(20 + weightedEvidence)
}

function addDimensionSignals(aggregate: EngineerAggregate, dimensions: ImpactScoreBreakdown, multiplier: number): void {
  for (const dimension of Object.keys(dimensions) as DimensionKey[]) {
    const value = dimensions[dimension]

    if (value > 0) {
      aggregate.signals[dimension].push(Math.min(35, Math.round(value * multiplier)))
    }
  }
}

function classifyPullRequest(pullRequest: GitHubPullRequest): PullRequestClassification {
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

function buildFileFootprint(files: readonly GitHubPullRequestFile[]): {
  readonly paths: ReadonlySet<string>
  readonly areas: ReadonlySet<string>
} {
  return {
    paths: new Set(files.map((file) => file.path)),
    areas: new Set(files.map((file) => inferAreaFromPath(file.path))),
  }
}

function countIntersection(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let count = 0

  for (const value of left) {
    if (right.has(value)) {
      count += 1
    }
  }

  return count
}

function topLevelPath(path: string): string {
  return path.split('/')[0] ?? 'Repository-wide'
}

function scorePullRequestEvidence(
  pullRequest: GitHubPullRequest,
  window: { readonly since: Date; readonly now: Date },
): number {
  const classification = classifyPullRequest(pullRequest)
  const occurredAt = pullRequest.mergedAt ?? pullRequest.closedAt ?? pullRequest.updatedAt
  const baseStrength = Math.max(...Object.values(classification.dimensions))
  const issueLinkBonus = pullRequest.linkedIssueNumbers.length > 0 ? 4 : 0
  const mergeConfidence = pullRequest.mergedAt === undefined ? 0 : 4

  return Math.round((baseStrength + classification.innovationReach + issueLinkBonus + mergeConfidence) * recencyMultiplier(new Date(occurredAt), window))
}

function scoreReviewQuality(review: GitHubPullRequestReview): number {
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

function summarizeContributionTheme(aggregate: EngineerAggregate, breakdown: ImpactScoreBreakdown): string {
  const strongestDimensions = (Object.entries(breakdown) as [DimensionKey, number][])
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([dimension]) => dimensionLabel(dimension))
    .join(' and ')

  return `Strongest evidence clusters around ${strongestDimensions || 'repository-wide impact'} across ${[...aggregate.areas].slice(0, 3).join(', ') || 'shared areas'}.`
}

function explainRanking(aggregate: EngineerAggregate, totalScore: number): string {
  return `${toDisplayName(aggregate.displayName, aggregate.login)} scored ${totalScore} from classified evidence strength, recency, linked problem context, review quality, and team-relative normalization. Activity counts are kept as diagnostics, not as direct scoring inputs.`
}

function buildRiskQualityNote(breakdown: ImpactScoreBreakdown): string {
  if (breakdown.riskReduction >= breakdown.technicalLeverage && breakdown.riskReduction >= breakdown.customerValue) {
    return 'Strongest quality signal: risk-reducing work with evidence tied to reliability, security, fixes, or operational safety.'
  }

  if (breakdown.technicalLeverage >= breakdown.customerValue) {
    return 'Strongest quality signal: leverage work that improves future engineering throughput or shared quality gates.'
  }

  return 'Strongest quality signal: customer-facing delivery weighted by reach and linked problem context.'
}

function recencyMultiplier(date: Date, window: { readonly since: Date; readonly now: Date }): number {
  const total = Math.max(1, window.now.getTime() - window.since.getTime())
  const elapsed = Math.max(0, Math.min(total, date.getTime() - window.since.getTime()))

  return 0.7 + (elapsed / total) * 0.3
}

function sizeGuardrailMultiplier(pullRequest: GitHubPullRequest): number {
  const changeSize = pullRequest.additions + pullRequest.deletions

  if (pullRequest.changedFiles > 60 || changeSize > 8_000) {
    return 0.75
  }

  if (pullRequest.changedFiles > 25 || changeSize > 2_000) {
    return 0.9
  }

  return 1
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

function strongestEvidenceWeight(aggregate: EngineerAggregate): number {
  return aggregate.evidence.reduce((max, evidence) => Math.max(max, evidence.weight), 0)
}

function createDimensionSignals(): DimensionSignals {
  return {
    customerValue: [],
    technicalLeverage: [],
    riskReduction: [],
    ownership: [],
    collaboration: [],
  }
}

function createZeroBreakdown(): ImpactScoreBreakdown {
  return {
    customerValue: 0,
    technicalLeverage: 0,
    riskReduction: 0,
    ownership: 0,
    collaboration: 0,
  }
}

function dimensionLabel(dimension: DimensionKey): string {
  const labels = {
    customerValue: 'customer value',
    technicalLeverage: 'technical leverage',
    riskReduction: 'risk reduction',
    ownership: 'ownership',
    collaboration: 'collaboration',
  } satisfies Record<DimensionKey, string>

  return labels[dimension]
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
