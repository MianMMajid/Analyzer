export type GitHubRepositoryRef = {
  owner: string
  name: string
}

export type GitHubRateLimitMetadata = {
  limit?: number
  remaining?: number
  resetAt?: string
  used?: number
  resource?: string
  retryAfterMs?: number
  requestId?: string
}

export type GitHubPaginationMetadata = {
  page: number
  perPage: number
  itemCount: number
  hasNextPage: boolean
  nextUrl?: string
}

export type GitHubPaginatedResult<Item> = {
  items: readonly Item[]
  pages: readonly GitHubPaginationMetadata[]
  rateLimit?: GitHubRateLimitMetadata
}

export type GitHubBranch = {
  name: string
  headSha: string
  protected: boolean
}

export type GitHubCommitAuthorIdentity = {
  name: string
  email: string
  date: string
  login?: string
  githubUserId?: number
}

export type GitHubCommit = {
  sha: string
  message: string
  authoredAt: string
  committedAt: string
  author: GitHubCommitAuthorIdentity
  committer: GitHubCommitAuthorIdentity
  parentShas: readonly string[]
  htmlUrl: string
  branchName?: string
}

export type GitHubPullRequestState = 'open' | 'closed'

export type GitHubPullRequest = {
  id: number
  number: number
  title: string
  body: string
  state: GitHubPullRequestState
  isDraft: boolean
  authorLogin?: string
  createdAt: string
  updatedAt: string
  closedAt?: string
  mergedAt?: string
  mergeCommitSha?: string
  baseRefName: string
  headRefName: string
  labels: readonly string[]
  additions: number
  deletions: number
  changedFiles: number
  commits: number
  reviewCommentCount: number
  issueCommentCount: number
  linkedIssueNumbers: readonly number[]
  htmlUrl: string
}

export type GitHubReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING' | 'UNKNOWN'

export type GitHubPullRequestReview = {
  id: number
  pullRequestNumber: number
  authorLogin?: string
  state: GitHubReviewState
  submittedAt?: string
  body: string
  commitId?: string
  htmlUrl: string
}

export type GitHubPullRequestIssueComment = {
  id: number
  pullRequestNumber: number
  authorLogin?: string
  body: string
  createdAt: string
  updatedAt: string
  htmlUrl: string
}

export type GitHubPullRequestReviewComment = {
  id: number
  pullRequestNumber: number
  authorLogin?: string
  body: string
  createdAt: string
  updatedAt: string
  path: string
  commitId: string
  htmlUrl: string
}

export type GitHubPullRequestFile = {
  path: string
  status: string
  additions: number
  deletions: number
  changes: number
}

export type GitHubPullRequestDiscussion = {
  reviews: readonly GitHubPullRequestReview[]
  issueComments: readonly GitHubPullRequestIssueComment[]
  reviewComments: readonly GitHubPullRequestReviewComment[]
}

export type GitHubCollectionWindow = {
  since: Date
  until?: Date
}
