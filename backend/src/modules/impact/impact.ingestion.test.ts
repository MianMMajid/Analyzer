import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildImpactReportFromGitHub } from './impact.ingestion.js'
import type { GitHubCollectionService } from '../github/github.service.js'
import type {
  GitHubCommit,
  GitHubPullRequest,
  GitHubPullRequestFile,
  GitHubPullRequestReview,
} from '../github/github.types.js'

const commits: readonly GitHubCommit[] = [
  {
    sha: 'abc',
    message: 'fix(ci): reduce flaky tests',
    authoredAt: '2026-07-01T00:00:00.000Z',
    committedAt: '2026-07-01T00:00:00.000Z',
    author: {
      name: 'Ada Lovelace',
      email: '1+ada@users.noreply.github.com',
      date: '2026-07-01T00:00:00.000Z',
      login: 'ada',
    },
    committer: {
      name: 'Ada Lovelace',
      email: '1+ada@users.noreply.github.com',
      date: '2026-07-01T00:00:00.000Z',
      login: 'ada',
    },
    parentShas: [],
    htmlUrl: 'https://github.com/PostHog/posthog/commit/abc',
  },
]

const pullRequests: readonly GitHubPullRequest[] = [
  {
    id: 1,
    number: 123,
    title: 'fix(ci): make test telemetry reliable',
    body: 'Fixes #456 by making CI telemetry reliable.',
    state: 'closed',
    isDraft: false,
    authorLogin: 'ada',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
    mergedAt: '2026-07-02T00:00:00.000Z',
    baseRefName: 'master',
    headRefName: 'fix-ci',
    labels: ['ci'],
    additions: 10,
    deletions: 2,
    changedFiles: 2,
    commits: 1,
    reviewCommentCount: 3,
    issueCommentCount: 1,
    linkedIssueNumbers: [456],
    htmlUrl: 'https://github.com/PostHog/posthog/pull/123',
  },
  {
    id: 2,
    number: 124,
    title: 'feat(ci): build on telemetry dashboard',
    body: 'Uses the new telemetry surface from #123.',
    state: 'closed',
    isDraft: false,
    authorLogin: 'grace',
    createdAt: '2026-07-03T00:00:00.000Z',
    updatedAt: '2026-07-04T00:00:00.000Z',
    mergedAt: '2026-07-04T00:00:00.000Z',
    baseRefName: 'master',
    headRefName: 'ci-follow-up',
    labels: ['ci'],
    additions: 8,
    deletions: 1,
    changedFiles: 1,
    commits: 1,
    reviewCommentCount: 0,
    issueCommentCount: 0,
    linkedIssueNumbers: [],
    htmlUrl: 'https://github.com/PostHog/posthog/pull/124',
  },
]

const fileMap = new Map<number, readonly GitHubPullRequestFile[]>([
  [
    123,
    [
      {
        path: '.github/workflows/ci.yml',
        status: 'modified',
        additions: 10,
        deletions: 2,
        changes: 12,
      },
    ],
  ],
  [
    124,
    [
      {
        path: '.github/workflows/ci.yml',
        status: 'modified',
        additions: 8,
        deletions: 1,
        changes: 9,
      },
    ],
  ],
])

const reviews: readonly GitHubPullRequestReview[] = [
  {
    id: 9,
    pullRequestNumber: 123,
    authorLogin: 'grace',
    state: 'CHANGES_REQUESTED',
    submittedAt: '2026-07-02T00:00:00.000Z',
    body: 'Please tighten this.',
    htmlUrl: 'https://github.com/PostHog/posthog/pull/123#review-9',
  },
]

const service = {
  fetchBranches: vi.fn(),
  fetchCommitsSince: vi.fn(async () => ({
    items: commits,
    pages: [],
  })),
  fetchPullRequestsUpdatedSince: vi.fn(async () => ({
    items: pullRequests,
    pages: [],
  })),
  fetchPullRequestDiscussion: vi.fn(async () => ({
    reviews,
    issueComments: [],
    reviewComments: [],
  })),
  fetchPullRequestFiles: vi.fn(async (pullRequestNumber: number) => ({
    items: fileMap.get(pullRequestNumber) ?? [],
    pages: [],
  })),
} satisfies GitHubCollectionService

describe('buildImpactReportFromGitHub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds a contract-ready top engineer report from GitHub signals', async () => {
    const report = await buildImpactReportFromGitHub({
      repository: 'PostHog/posthog',
      analysisWindowDays: 90,
      now: new Date('2026-07-06T00:00:00.000Z'),
      service,
      maxDiscussionPullRequests: 1,
    })

    expect(report.source).toBe('github_ingestion')
    expect(report.engineers[0]).toMatchObject({
      githubLogin: 'ada',
      primaryImpactArea: 'CI and testing',
    })
    expect(report.engineers[0]?.explanation).toContain('Activity counts are kept as diagnostics')
    expect(report.engineers[0]?.evidence.some((evidence) => evidence.contributionType === 'Post-merge adoption')).toBe(
      true,
    )
    expect(report.engineers.some((engineer) => engineer.githubLogin === 'grace')).toBe(true)
  })

  it('enriches every eligible pull request in the analysis window by default', async () => {
    await buildImpactReportFromGitHub({
      repository: 'PostHog/posthog',
      analysisWindowDays: 90,
      now: new Date('2026-07-06T00:00:00.000Z'),
      service,
    })

    expect(service.fetchPullRequestDiscussion).toHaveBeenCalledTimes(2)
    expect(service.fetchPullRequestDiscussion).toHaveBeenCalledWith(123, { perPage: 100 })
    expect(service.fetchPullRequestDiscussion).toHaveBeenCalledWith(124, { perPage: 100 })
    expect(service.fetchPullRequestFiles).toHaveBeenCalledTimes(2)
    expect(service.fetchPullRequestFiles).toHaveBeenCalledWith(123, { perPage: 100 })
    expect(service.fetchPullRequestFiles).toHaveBeenCalledWith(124, { perPage: 100 })
  })

  it('bounds GitHub enrichment concurrency', async () => {
    let activeRequests = 0
    let maxActiveRequests = 0
    const trackedService = createTrackedService(async () => {
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
      await new Promise((resolve) => setTimeout(resolve, 1))
      activeRequests -= 1
    })

    await buildImpactReportFromGitHub({
      repository: 'PostHog/posthog',
      analysisWindowDays: 90,
      now: new Date('2026-07-06T00:00:00.000Z'),
      service: trackedService,
      githubRequestConcurrency: 1,
    })

    expect(maxActiveRequests).toBe(1)
    expect(trackedService.fetchPullRequestDiscussion).toHaveBeenCalledTimes(3)
    expect(trackedService.fetchPullRequestFiles).toHaveBeenCalledTimes(3)
  })

  it('allows zero enrichment limits without fetching discussion or file details', async () => {
    const limitedService = createTrackedService(async () => {})

    const report = await buildImpactReportFromGitHub({
      repository: 'PostHog/posthog',
      analysisWindowDays: 90,
      now: new Date('2026-07-06T00:00:00.000Z'),
      service: limitedService,
      maxDiscussionPullRequests: 0,
      maxAdoptionPullRequests: 0,
    })

    expect(report.engineers.length).toBeGreaterThan(0)
    expect(limitedService.fetchPullRequestDiscussion).not.toHaveBeenCalled()
    expect(limitedService.fetchPullRequestFiles).not.toHaveBeenCalled()
  })

  it('rejects invalid enrichment limits before doing unnecessary work', async () => {
    await expect(
      buildImpactReportFromGitHub({
        repository: 'PostHog/posthog',
        analysisWindowDays: 90,
        now: new Date('2026-07-06T00:00:00.000Z'),
        service,
        githubRequestConcurrency: 0,
      }),
    ).rejects.toThrow('githubRequestConcurrency must be a positive integer.')

    await expect(
      buildImpactReportFromGitHub({
        repository: 'PostHog/posthog',
        analysisWindowDays: 90,
        now: new Date('2026-07-06T00:00:00.000Z'),
        service,
        maxDiscussionPullRequests: -1,
      }),
    ).rejects.toThrow('maxDiscussionPullRequests must be a non-negative integer.')

    await expect(
      buildImpactReportFromGitHub({
        repository: 'PostHog/posthog',
        analysisWindowDays: 90,
        now: new Date('2026-07-06T00:00:00.000Z'),
        service,
        maxAdoptionPullRequests: 1.5,
      }),
    ).rejects.toThrow('maxAdoptionPullRequests must be a non-negative integer.')
  })
})

function createTrackedService(beforeEnrichmentResponse: () => Promise<void>): GitHubCollectionService {
  const trackedPullRequests = [
    ...pullRequests,
    {
      ...pullRequests[1]!,
      id: 3,
      number: 125,
      title: 'feat(ci): extend telemetry dashboard adoption',
      authorLogin: 'alan',
      updatedAt: '2026-07-05T00:00:00.000Z',
      mergedAt: '2026-07-05T00:00:00.000Z',
      htmlUrl: 'https://github.com/PostHog/posthog/pull/125',
    },
  ] satisfies readonly GitHubPullRequest[]

  return {
    fetchBranches: vi.fn(),
    fetchCommitsSince: vi.fn(async () => ({
      items: commits,
      pages: [],
    })),
    fetchPullRequestsUpdatedSince: vi.fn(async () => ({
      items: trackedPullRequests,
      pages: [],
    })),
    fetchPullRequestDiscussion: vi.fn(async () => {
      await beforeEnrichmentResponse()

      return {
        reviews,
        issueComments: [],
        reviewComments: [],
      }
    }),
    fetchPullRequestFiles: vi.fn(async (pullRequestNumber: number) => {
      await beforeEnrichmentResponse()

      return {
        items: fileMap.get(pullRequestNumber) ?? fileMap.get(124) ?? [],
        pages: [],
      }
    }),
  } satisfies GitHubCollectionService
}
