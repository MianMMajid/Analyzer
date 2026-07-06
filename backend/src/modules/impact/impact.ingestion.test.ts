import { describe, expect, it, vi } from 'vitest'
import { buildImpactReportFromGitHub } from './impact.ingestion.js'
import type { GitHubCollectionService } from '../github/github.service.js'
import type { GitHubCommit, GitHubPullRequest, GitHubPullRequestReview } from '../github/github.types.js'

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
]

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
} satisfies GitHubCollectionService

describe('buildImpactReportFromGitHub', () => {
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
    expect(report.engineers[0]?.evidence[0]?.reason).toContain('Linked issue')
    expect(report.engineers.some((engineer) => engineer.githubLogin === 'grace')).toBe(true)
  })
})
