import { describe, expect, it, vi } from 'vitest'
import type { GitHubClient } from './github.client.js'
import { createGitHubCollectionService } from './github.service.js'

describe('GitHub collection service', () => {
  it('normalizes branches and deduplicates commits across branches', async () => {
    const client = createMockClient([
      [
        { name: 'master', commit: { sha: 'a1' }, protected: true },
        { name: 'feature', commit: { sha: 'b2' }, protected: false },
      ],
      [commitFixture('same-sha', 'first branch')],
      [commitFixture('same-sha', 'second branch')],
    ])
    const service = createGitHubCollectionService({
      repository: 'PostHog/posthog',
      client,
    })

    const branches = await service.fetchBranches()
    const commits = await service.fetchCommitsSince({
      since: new Date('2026-04-07T00:00:00Z'),
      branchNames: ['master', 'feature'],
    })

    expect(branches.items).toEqual([
      { name: 'master', headSha: 'a1', protected: true },
      { name: 'feature', headSha: 'b2', protected: false },
    ])
    expect(commits.items).toHaveLength(1)
    expect(commits.items[0]?.sha).toBe('same-sha')
    expect(commits.items[0]?.branchName).toBe('master')
  })

  it('normalizes pull requests and stops once updated results are outside the window', async () => {
    const client = {
      paginateJson: createMockClient([]).paginateJson,
      getJson: async () => ({
        data: [
          pullRequestFixture(1, '2026-05-01T00:00:00Z'),
          pullRequestFixture(2, '2026-01-01T00:00:00Z'),
        ],
      }),
    } satisfies GitHubClient
    const service = createGitHubCollectionService({
      repository: 'PostHog/posthog',
      client,
    })

    const pullRequests = await service.fetchPullRequestsUpdatedSince({
      since: new Date('2026-04-07T00:00:00Z'),
    })

    expect(pullRequests.items).toHaveLength(1)
    expect(pullRequests.items[0]).toMatchObject({
      number: 1,
      authorLogin: 'engineer',
      labels: ['feature'],
      body: 'Fixes #99 and closes #101.',
      linkedIssueNumbers: [99, 101],
      baseRefName: 'master',
      headRefName: 'impact-dashboard',
    })
  })

  it('throws when pull request pagination would exceed maxPages', async () => {
    const getJson = vi.fn(async () => ({
      data: [pullRequestFixture(1, '2026-05-01T00:00:00Z')],
      nextUrl: 'https://api.github.test/repos/PostHog/posthog/pulls?page=2',
    }))
    const client = {
      paginateJson: createMockClient([]).paginateJson,
      getJson,
    } satisfies GitHubClient
    const service = createGitHubCollectionService({
      repository: 'PostHog/posthog',
      client,
    })

    await expect(service.fetchPullRequestsUpdatedSince({
      since: new Date('2026-04-07T00:00:00Z'),
      maxPages: 1,
    })).rejects.toThrow('GitHub pull request pagination exceeded the configured 1 page limit.')
    expect(getJson).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid pull request maxPages values before fetching', async () => {
    const getJson = vi.fn()
    const client = {
      paginateJson: createMockClient([]).paginateJson,
      getJson,
    } satisfies GitHubClient
    const service = createGitHubCollectionService({
      repository: 'PostHog/posthog',
      client,
    })

    await expect(service.fetchPullRequestsUpdatedSince({
      since: new Date('2026-04-07T00:00:00Z'),
      maxPages: 0,
    })).rejects.toThrow('GitHub pull request pagination maxPages must be a positive integer.')
    expect(getJson).not.toHaveBeenCalled()
  })

  it('normalizes reviews, issue comments, and review comments for a PR', async () => {
    const client = createMockClient([
      [reviewFixture()],
      [issueCommentFixture()],
      [reviewCommentFixture()],
    ])
    const service = createGitHubCollectionService({
      repository: 'PostHog/posthog',
      client,
    })

    const discussion = await service.fetchPullRequestDiscussion(42)

    expect(discussion.reviews[0]).toMatchObject({
      pullRequestNumber: 42,
      authorLogin: 'reviewer',
      state: 'APPROVED',
    })
    expect(discussion.issueComments[0]?.body).toBe('Looks good.')
    expect(discussion.reviewComments[0]).toMatchObject({
      path: 'frontend/src/App.tsx',
      commitId: 'abc123',
    })
  })

  it('normalizes changed files for a PR', async () => {
    const client = createMockClient([[fileFixture()]])
    const service = createGitHubCollectionService({
      repository: 'PostHog/posthog',
      client,
    })

    const files = await service.fetchPullRequestFiles(42)

    expect(files.items).toEqual([
      {
        path: 'frontend/src/App.tsx',
        status: 'modified',
        additions: 12,
        deletions: 4,
        changes: 16,
      },
    ])
  })
})

function createMockClient(pages: readonly (readonly unknown[])[]): GitHubClient {
  let index = 0

  return {
    getJson: async () => ({ data: pages[index++] ?? [] }),
    paginateJson: async <Item>() => {
      const items = (pages[index++] ?? []) as readonly Item[]

      return {
        items,
        pages: [
          {
            page: index,
            perPage: 100,
            itemCount: items.length,
            hasNextPage: false,
          },
        ],
      }
    },
  }
}

function commitFixture(sha: string, message: string): unknown {
  return {
    sha,
    html_url: `https://github.com/PostHog/posthog/commit/${sha}`,
    commit: {
      message,
      author: {
        name: 'Engineer',
        email: 'engineer@posthog.com',
        date: '2026-05-01T00:00:00Z',
      },
      committer: {
        name: 'Engineer',
        email: 'engineer@posthog.com',
        date: '2026-05-01T00:01:00Z',
      },
    },
    author: { login: 'engineer', id: 101 },
    committer: { login: 'engineer', id: 101 },
    parents: [{ sha: 'parent-sha' }],
  }
}

function pullRequestFixture(number: number, updatedAt: string): unknown {
  return {
    id: number * 10,
    number,
    title: 'Improve impact analysis',
    body: 'Fixes #99 and closes #101.',
    state: 'closed',
    draft: false,
    user: { login: 'engineer' },
    created_at: '2026-04-20T00:00:00Z',
    updated_at: updatedAt,
    closed_at: '2026-05-02T00:00:00Z',
    merged_at: '2026-05-02T00:00:00Z',
    merge_commit_sha: 'merge-sha',
    base: { ref: 'master' },
    head: { ref: 'impact-dashboard' },
    labels: [{ name: 'feature' }],
    additions: 120,
    deletions: 30,
    changed_files: 8,
    commits: 3,
    review_comments: 4,
    comments: 2,
    html_url: `https://github.com/PostHog/posthog/pull/${number}`,
  }
}

function reviewFixture(): unknown {
  return {
    id: 1,
    user: { login: 'reviewer' },
    state: 'APPROVED',
    submitted_at: '2026-05-02T00:00:00Z',
    body: 'Ship it.',
    commit_id: 'abc123',
    html_url: 'https://github.com/PostHog/posthog/pull/42#pullrequestreview-1',
  }
}

function issueCommentFixture(): unknown {
  return {
    id: 2,
    user: { login: 'commenter' },
    body: 'Looks good.',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    html_url: 'https://github.com/PostHog/posthog/pull/42#issuecomment-2',
  }
}

function reviewCommentFixture(): unknown {
  return {
    id: 3,
    user: { login: 'reviewer' },
    body: 'Can we simplify this?',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    path: 'frontend/src/App.tsx',
    commit_id: 'abc123',
    html_url: 'https://github.com/PostHog/posthog/pull/42#discussion_r3',
  }
}

function fileFixture(): unknown {
  return {
    filename: 'frontend/src/App.tsx',
    status: 'modified',
    additions: 12,
    deletions: 4,
    changes: 16,
  }
}
