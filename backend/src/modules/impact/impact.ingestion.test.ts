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
    expect(report.engineers[0]?.evidence.some((evidence) => evidence.contributionType === 'Post-merge adoption')).toBe(true)
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
})
