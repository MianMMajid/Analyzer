import { describe, expect, it } from 'vitest'
import type { GitHubPullRequest, GitHubPullRequestReview } from '../github/github.types.js'
import {
  buildFileFootprint,
  classifyPullRequest,
  countIntersection,
  scorePullRequestEvidence,
  scoreReviewQuality,
} from './impact.ingestion.classification.js'

const basePullRequest = {
  id: 1,
  number: 10,
  title: 'feat: add product analytics insight',
  body: '',
  state: 'closed',
  isDraft: false,
  authorLogin: 'ada',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  closedAt: '2026-07-02T00:00:00.000Z',
  mergedAt: '2026-07-02T00:00:00.000Z',
  baseRefName: 'master',
  headRefName: 'feature',
  labels: [],
  additions: 10,
  deletions: 2,
  changedFiles: 2,
  commits: 1,
  reviewCommentCount: 0,
  issueCommentCount: 0,
  linkedIssueNumbers: [],
  htmlUrl: 'https://github.com/PostHog/posthog/pull/10',
} satisfies GitHubPullRequest

describe('impact ingestion classification', () => {
  it('classifies risk, leverage, and customer-value pull requests without raw volume scoring', () => {
    const risk = classifyPullRequest({
      ...basePullRequest,
      title: 'fix(security): repair permission regression',
      linkedIssueNumbers: [123],
    })
    const leverage = classifyPullRequest({
      ...basePullRequest,
      title: 'refactor(ci): improve test runner architecture',
      labels: ['tooling'],
    })
    const customerValue = classifyPullRequest(basePullRequest)

    expect(risk).toMatchObject({
      area: 'Security',
      contributionType: 'Risk reduction',
    })
    expect(risk.dimensions.riskReduction).toBeGreaterThan(risk.dimensions.customerValue)
    expect(leverage.contributionType).toBe('Technical leverage')
    expect(leverage.dimensions.technicalLeverage).toBeGreaterThan(leverage.dimensions.customerValue)
    expect(customerValue.contributionType).toBe('Innovation and reach')
    expect(customerValue.area).toBe('Analytics')
  })

  it('builds compact file footprints and counts intersections using the smaller set', () => {
    const footprint = buildFileFootprint([
      {
        path: 'frontend/src/lib/components/Button.tsx',
        status: 'modified',
        additions: 8,
        deletions: 2,
        changes: 10,
      },
      {
        path: '.github/workflows/ci.yml',
        status: 'modified',
        additions: 2,
        deletions: 1,
        changes: 3,
      },
    ])

    expect([...footprint.areas]).toEqual(['Frontend', 'CI and testing'])
    expect(countIntersection(footprint.areas, new Set(['CI and testing', 'Security']))).toBe(1)
  })

  it('weights PR evidence by merge confidence, issue linkage, and recency', () => {
    const classification = classifyPullRequest({
      ...basePullRequest,
      title: 'fix: improve analytics reliability',
      linkedIssueNumbers: [456],
    })
    const window = {
      since: new Date('2026-06-01T00:00:00.000Z'),
      now: new Date('2026-07-06T00:00:00.000Z'),
    }
    const olderScore = scorePullRequestEvidence(
      {
        ...basePullRequest,
        title: 'fix: improve analytics reliability',
        mergedAt: '2026-06-02T00:00:00.000Z',
        linkedIssueNumbers: [],
      },
      window,
      classification,
    )
    const recentLinkedScore = scorePullRequestEvidence(
      {
        ...basePullRequest,
        title: 'fix: improve analytics reliability',
        mergedAt: '2026-07-05T00:00:00.000Z',
        linkedIssueNumbers: [456],
      },
      window,
      classification,
    )

    expect(recentLinkedScore).toBeGreaterThan(olderScore)
  })

  it('scores review quality from state and body depth', () => {
    const review = {
      id: 1,
      pullRequestNumber: 10,
      authorLogin: 'grace',
      state: 'CHANGES_REQUESTED',
      submittedAt: '2026-07-02T00:00:00.000Z',
      body: 'Please add regression coverage and explain the rollback behavior for this reliability fix.',
      htmlUrl: 'https://github.com/PostHog/posthog/pull/10#review-1',
    } satisfies GitHubPullRequestReview

    expect(scoreReviewQuality(review)).toBeGreaterThan(scoreReviewQuality({ ...review, state: 'APPROVED', body: '' }))
  })
})
