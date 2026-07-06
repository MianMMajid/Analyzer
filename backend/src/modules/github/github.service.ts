import type { GitHubClient } from './github.client.js'
import {
  createGitHubClient,
  parseGitHubRepository,
  type GitHubPageOptions,
  type GitHubRequestQuery,
} from './github.client.js'
import type {
  GitHubBranch,
  GitHubCollectionWindow,
  GitHubCommit,
  GitHubCommitAuthorIdentity,
  GitHubPaginatedResult,
  GitHubPullRequest,
  GitHubPullRequestDiscussion,
  GitHubPullRequestIssueComment,
  GitHubPullRequestReview,
  GitHubPullRequestReviewComment,
  GitHubRepositoryRef,
  GitHubReviewState,
} from './github.types.js'

export type GitHubCollectionServiceOptions = {
  repository: string | GitHubRepositoryRef
  token?: string
  client?: GitHubClient
}

export type FetchCommitOptions = GitHubCollectionWindow &
  GitHubPageOptions & {
    branchNames?: readonly string[]
  }

export type FetchPullRequestOptions = GitHubCollectionWindow & GitHubPageOptions

export type GitHubCollectionService = {
  fetchBranches: (options?: GitHubPageOptions) => Promise<GitHubPaginatedResult<GitHubBranch>>
  fetchCommitsSince: (options: FetchCommitOptions) => Promise<GitHubPaginatedResult<GitHubCommit>>
  fetchPullRequestsUpdatedSince: (
    options: FetchPullRequestOptions,
  ) => Promise<GitHubPaginatedResult<GitHubPullRequest>>
  fetchPullRequestDiscussion: (
    pullRequestNumber: number,
    options?: GitHubPageOptions,
  ) => Promise<GitHubPullRequestDiscussion>
}

type UnknownRecord = Record<string, unknown>

const validReviewStates = new Set<GitHubReviewState>([
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
  'DISMISSED',
  'PENDING',
])

export function createGitHubCollectionService(
  options: GitHubCollectionServiceOptions,
): GitHubCollectionService {
  const repository =
    typeof options.repository === 'string'
      ? parseGitHubRepository(options.repository)
      : options.repository
  const clientOptions = options.token === undefined ? {} : { token: options.token }
  const client = options.client ?? createGitHubClient(clientOptions)

  function repositoryPath(path: string): string {
    return `/repos/${repository.owner}/${repository.name}${path}`
  }

  async function fetchBranches(
    options: GitHubPageOptions = {},
  ): Promise<GitHubPaginatedResult<GitHubBranch>> {
    const response = await client.paginateJson<unknown>(
      repositoryPath('/branches'),
      {},
      options,
    )

    return mapPaginatedResult(response, normalizeBranch)
  }

  async function fetchCommitsSince(
    options: FetchCommitOptions,
  ): Promise<GitHubPaginatedResult<GitHubCommit>> {
    const branchNames = options.branchNames ?? [undefined]
    const seenCommitShas = new Set<string>()
    const commits: GitHubCommit[] = []
    const pages = []

    for (const branchName of branchNames) {
      const query: GitHubRequestQuery = {
        since: options.since.toISOString(),
        until: options.until?.toISOString(),
        sha: branchName,
      }
      const response = await client.paginateJson<unknown>(
        repositoryPath('/commits'),
        query,
        options,
      )
      pages.push(...response.pages)

      for (const item of response.items) {
        const commit = normalizeCommit(item, branchName)

        // A commit can appear on multiple active branches. Scoring should count the
        // accepted commit once while preserving branch context on the first sighting.
        if (!seenCommitShas.has(commit.sha)) {
          seenCommitShas.add(commit.sha)
          commits.push(commit)
        }
      }
    }

    return {
      items: commits,
      pages,
    }
  }

  async function fetchPullRequestsUpdatedSince(
    options: FetchPullRequestOptions,
  ): Promise<GitHubPaginatedResult<GitHubPullRequest>> {
    const pullRequests: GitHubPullRequest[] = []
    const pages = []
    let page = 1
    let shouldContinue = true

    while (shouldContinue && page <= (options.maxPages ?? 1_000)) {
      const response = await client.getJson(repositoryPath('/pulls'), {
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: options.perPage ?? 100,
        page,
      })

      if (!Array.isArray(response.data)) {
        throw new Error('Expected GitHub pull request list response.')
      }

      const normalizedPage = response.data.map(normalizePullRequest)
      const relevantPullRequests = normalizedPage.filter(
        (pullRequest) => new Date(pullRequest.updatedAt).getTime() >= options.since.getTime(),
      )

      pullRequests.push(...relevantPullRequests)
      pages.push({
        page,
        perPage: options.perPage ?? 100,
        itemCount: normalizedPage.length,
        hasNextPage: response.nextUrl !== undefined,
        ...(response.nextUrl !== undefined ? { nextUrl: response.nextUrl } : {}),
      })

      // GitHub does not provide an updated-since filter for PR listing. We request
      // newest-updated first and stop once the full page is older than the window.
      shouldContinue =
        response.nextUrl !== undefined &&
        normalizedPage.some(
          (pullRequest) => new Date(pullRequest.updatedAt).getTime() >= options.since.getTime(),
        )
      page += 1
    }

    return { items: pullRequests, pages }
  }

  async function fetchPullRequestDiscussion(
    pullRequestNumber: number,
    options: GitHubPageOptions = {},
  ): Promise<GitHubPullRequestDiscussion> {
    const [reviews, issueComments, reviewComments] = await Promise.all([
      client.paginateJson<unknown>(
        repositoryPath(`/pulls/${pullRequestNumber}/reviews`),
        {},
        options,
      ),
      client.paginateJson<unknown>(
        repositoryPath(`/issues/${pullRequestNumber}/comments`),
        {},
        options,
      ),
      client.paginateJson<unknown>(
        repositoryPath(`/pulls/${pullRequestNumber}/comments`),
        {},
        options,
      ),
    ])

    return {
      reviews: reviews.items.map((item) => normalizeReview(item, pullRequestNumber)),
      issueComments: issueComments.items.map((item) =>
        normalizeIssueComment(item, pullRequestNumber),
      ),
      reviewComments: reviewComments.items.map((item) =>
        normalizeReviewComment(item, pullRequestNumber),
      ),
    }
  }

  return {
    fetchBranches,
    fetchCommitsSince,
    fetchPullRequestsUpdatedSince,
    fetchPullRequestDiscussion,
  }
}

function mapPaginatedResult<Input, Output>(
  result: GitHubPaginatedResult<Input>,
  mapper: (item: Input) => Output,
): GitHubPaginatedResult<Output> {
  const mapped: GitHubPaginatedResult<Output> = {
    items: result.items.map(mapper),
    pages: result.pages,
  }

  if (result.rateLimit !== undefined) {
    mapped.rateLimit = result.rateLimit
  }

  return mapped
}

function normalizeBranch(value: unknown): GitHubBranch {
  const record = requireRecord(value, 'branch')
  const commit = requireRecord(record['commit'], 'branch.commit')

  return {
    name: requireString(record, 'name', 'branch.name'),
    headSha: requireString(commit, 'sha', 'branch.commit.sha'),
    protected: requireBoolean(record, 'protected', 'branch.protected'),
  }
}

function normalizeCommit(value: unknown, branchName: string | undefined): GitHubCommit {
  const record = requireRecord(value, 'commit')
  const commit = requireRecord(record['commit'], 'commit.commit')
  const author = requireRecord(commit['author'], 'commit.commit.author')
  const committer = requireRecord(commit['committer'], 'commit.commit.committer')
  const normalized: GitHubCommit = {
    sha: requireString(record, 'sha', 'commit.sha'),
    message: requireString(commit, 'message', 'commit.commit.message'),
    authoredAt: requireString(author, 'date', 'commit.commit.author.date'),
    committedAt: requireString(committer, 'date', 'commit.commit.committer.date'),
    author: normalizeCommitIdentity(author, optionalRecord(record['author'])),
    committer: normalizeCommitIdentity(committer, optionalRecord(record['committer'])),
    parentShas: readParentShas(record),
    htmlUrl: requireString(record, 'html_url', 'commit.html_url'),
  }

  if (branchName !== undefined) {
    normalized.branchName = branchName
  }

  return normalized
}

function normalizeCommitIdentity(
  gitIdentity: UnknownRecord,
  userIdentity: UnknownRecord | undefined,
): GitHubCommitAuthorIdentity {
  const identity: GitHubCommitAuthorIdentity = {
    name: requireString(gitIdentity, 'name', 'commit.identity.name'),
    email: requireString(gitIdentity, 'email', 'commit.identity.email'),
    date: requireString(gitIdentity, 'date', 'commit.identity.date'),
  }

  if (userIdentity !== undefined) {
    identity.login = requireString(userIdentity, 'login', 'commit.identity.user.login')
    identity.githubUserId = requireNumber(userIdentity, 'id', 'commit.identity.user.id')
  }

  return identity
}

function normalizePullRequest(value: unknown): GitHubPullRequest {
  const record = requireRecord(value, 'pull request')
  const base = requireRecord(record['base'], 'pull_request.base')
  const head = requireRecord(record['head'], 'pull_request.head')
  const user = optionalRecord(record['user'])
  const pullRequest: GitHubPullRequest = {
    id: requireNumber(record, 'id', 'pull_request.id'),
    number: requireNumber(record, 'number', 'pull_request.number'),
    title: requireString(record, 'title', 'pull_request.title'),
    state: normalizePullRequestState(requireString(record, 'state', 'pull_request.state')),
    isDraft: requireBoolean(record, 'draft', 'pull_request.draft'),
    createdAt: requireString(record, 'created_at', 'pull_request.created_at'),
    updatedAt: requireString(record, 'updated_at', 'pull_request.updated_at'),
    baseRefName: requireString(base, 'ref', 'pull_request.base.ref'),
    headRefName: requireString(head, 'ref', 'pull_request.head.ref'),
    labels: normalizeLabels(record['labels']),
    additions: readNumber(record, 'additions') ?? 0,
    deletions: readNumber(record, 'deletions') ?? 0,
    changedFiles: readNumber(record, 'changed_files') ?? 0,
    commits: readNumber(record, 'commits') ?? 0,
    reviewCommentCount: readNumber(record, 'review_comments') ?? 0,
    issueCommentCount: readNumber(record, 'comments') ?? 0,
    htmlUrl: requireString(record, 'html_url', 'pull_request.html_url'),
  }

  const authorLogin = user?.['login']
  if (typeof authorLogin === 'string') {
    pullRequest.authorLogin = authorLogin
  }

  setOptionalString(pullRequest, 'closedAt', record['closed_at'])
  setOptionalString(pullRequest, 'mergedAt', record['merged_at'])
  setOptionalString(pullRequest, 'mergeCommitSha', record['merge_commit_sha'])

  return pullRequest
}

function normalizeReview(value: unknown, pullRequestNumber: number): GitHubPullRequestReview {
  const record = requireRecord(value, 'pull request review')
  const user = optionalRecord(record['user'])
  const review: GitHubPullRequestReview = {
    id: requireNumber(record, 'id', 'pull_request_review.id'),
    pullRequestNumber,
    state: normalizeReviewState(requireString(record, 'state', 'pull_request_review.state')),
    body: readString(record, 'body') ?? '',
    htmlUrl: requireString(record, 'html_url', 'pull_request_review.html_url'),
  }

  const authorLogin = user?.['login']
  if (typeof authorLogin === 'string') {
    review.authorLogin = authorLogin
  }

  setOptionalString(review, 'submittedAt', record['submitted_at'])
  setOptionalString(review, 'commitId', record['commit_id'])

  return review
}

function normalizeIssueComment(
  value: unknown,
  pullRequestNumber: number,
): GitHubPullRequestIssueComment {
  const record = requireRecord(value, 'pull request issue comment')
  const user = optionalRecord(record['user'])
  const comment: GitHubPullRequestIssueComment = {
    id: requireNumber(record, 'id', 'pull_request_issue_comment.id'),
    pullRequestNumber,
    body: readString(record, 'body') ?? '',
    createdAt: requireString(record, 'created_at', 'pull_request_issue_comment.created_at'),
    updatedAt: requireString(record, 'updated_at', 'pull_request_issue_comment.updated_at'),
    htmlUrl: requireString(record, 'html_url', 'pull_request_issue_comment.html_url'),
  }

  const authorLogin = user?.['login']
  if (typeof authorLogin === 'string') {
    comment.authorLogin = authorLogin
  }

  return comment
}

function normalizeReviewComment(
  value: unknown,
  pullRequestNumber: number,
): GitHubPullRequestReviewComment {
  const record = requireRecord(value, 'pull request review comment')
  const user = optionalRecord(record['user'])
  const comment: GitHubPullRequestReviewComment = {
    id: requireNumber(record, 'id', 'pull_request_review_comment.id'),
    pullRequestNumber,
    body: readString(record, 'body') ?? '',
    createdAt: requireString(record, 'created_at', 'pull_request_review_comment.created_at'),
    updatedAt: requireString(record, 'updated_at', 'pull_request_review_comment.updated_at'),
    path: requireString(record, 'path', 'pull_request_review_comment.path'),
    commitId: requireString(record, 'commit_id', 'pull_request_review_comment.commit_id'),
    htmlUrl: requireString(record, 'html_url', 'pull_request_review_comment.html_url'),
  }

  const authorLogin = user?.['login']
  if (typeof authorLogin === 'string') {
    comment.authorLogin = authorLogin
  }

  return comment
}

function normalizeLabels(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    const record = optionalRecord(item)
    const labelName = record?.['name']
    return typeof labelName === 'string' ? [labelName] : []
  })
}

function readParentShas(record: UnknownRecord): readonly string[] {
  const parents = record['parents']

  if (!Array.isArray(parents)) {
    return []
  }

  return parents.flatMap((parent) => {
    const parentRecord = optionalRecord(parent)
    const sha = parentRecord?.['sha']
    return typeof sha === 'string' ? [sha] : []
  })
}

function normalizePullRequestState(value: string): 'open' | 'closed' {
  if (value === 'open' || value === 'closed') {
    return value
  }

  throw new Error(`Unsupported pull request state '${value}'.`)
}

function normalizeReviewState(value: string): GitHubReviewState {
  return validReviewStates.has(value as GitHubReviewState) ? (value as GitHubReviewState) : 'UNKNOWN'
}

function requireRecord(value: unknown, field: string): UnknownRecord {
  const record = optionalRecord(value)

  if (record === undefined) {
    throw new Error(`Expected object for ${field}.`)
  }

  return record
}

function optionalRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined
}

function requireString(record: UnknownRecord, key: string, field: string): string {
  const value = readString(record, key)

  if (value === undefined) {
    throw new Error(`Expected string for ${field}.`)
  }

  return value
}

function readString(record: UnknownRecord, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function requireNumber(record: UnknownRecord, key: string, field: string): number {
  const value = readNumber(record, key)

  if (value === undefined) {
    throw new Error(`Expected number for ${field}.`)
  }

  return value
}

function readNumber(record: UnknownRecord, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' ? value : undefined
}

function requireBoolean(record: UnknownRecord, key: string, field: string): boolean {
  const value = record[key]

  if (typeof value !== 'boolean') {
    throw new Error(`Expected boolean for ${field}.`)
  }

  return value
}

function setOptionalString<Target extends object, Key extends keyof Target>(
  target: Target,
  key: Key,
  value: unknown,
): void {
  if (typeof value === 'string' && value.length > 0) {
    target[key] = value as Target[Key]
  }
}
