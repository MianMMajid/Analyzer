import type {
  GitHubPaginatedResult,
  GitHubPaginationMetadata,
  GitHubRateLimitMetadata,
  GitHubRepositoryRef,
} from './github.types.js'

export type GitHubClientOptions = {
  token?: string
  baseUrl?: string
  apiVersion?: string
  fetch?: typeof fetch
  sleep?: (delayMs: number) => Promise<void>
  maxRetries?: number
  maxRetryDelayMs?: number
}

export type GitHubRequestQuery = Record<string, string | number | boolean | undefined>

export type GitHubPageOptions = {
  maxPages?: number
  perPage?: number
}

type GitHubJsonResponse = {
  data: unknown
  rateLimit?: GitHubRateLimitMetadata
  nextUrl?: string
}

type GitHubErrorPayload = {
  message?: string
  documentationUrl?: string
}

const defaultBaseUrl = 'https://api.github.com'
const defaultApiVersion = '2022-11-28'
const defaultMaxRetries = 3
const defaultMaxRetryDelayMs = 60_000
const retryableServerStatuses = new Set([500, 502, 503, 504])

export class GitHubApiError extends Error {
  readonly status: number
  readonly rateLimit?: GitHubRateLimitMetadata
  readonly documentationUrl?: string

  constructor(parameters: {
    message: string
    status: number
    rateLimit?: GitHubRateLimitMetadata
    documentationUrl?: string
  }) {
    super(parameters.message)
    this.name = 'GitHubApiError'
    this.status = parameters.status

    if (parameters.rateLimit !== undefined) {
      this.rateLimit = parameters.rateLimit
    }

    if (parameters.documentationUrl !== undefined) {
      this.documentationUrl = parameters.documentationUrl
    }
  }
}

export type GitHubClient = {
  getJson: (pathOrUrl: string, query?: GitHubRequestQuery) => Promise<GitHubJsonResponse>
  paginateJson: <Item>(
    path: string,
    query?: GitHubRequestQuery,
    options?: GitHubPageOptions,
  ) => Promise<GitHubPaginatedResult<Item>>
}

export function parseGitHubRepository(repository: string): GitHubRepositoryRef {
  const [owner, name] = repository.split('/')

  if (owner === undefined || owner.length === 0 || name === undefined || name.length === 0) {
    throw new Error(`Invalid GitHub repository '${repository}'. Expected owner/name.`)
  }

  return { owner, name }
}

export function createGitHubClient(options: GitHubClientOptions = {}): GitHubClient {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? defaultBaseUrl)
  const fetchImplementation = options.fetch ?? fetch
  const sleep = options.sleep ?? defaultSleep
  const maxRetries = options.maxRetries ?? defaultMaxRetries
  const maxRetryDelayMs = options.maxRetryDelayMs ?? defaultMaxRetryDelayMs
  const apiVersion = options.apiVersion ?? defaultApiVersion

  async function getJson(pathOrUrl: string, query: GitHubRequestQuery = {}): Promise<GitHubJsonResponse> {
    const url = buildUrl(baseUrl, pathOrUrl, query)

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetchImplementation(url, {
        method: 'GET',
        headers: buildHeaders(options.token, apiVersion),
      })
      const rateLimit = readRateLimitMetadata(response.headers)
      const data = await readJson(response)

      if (response.ok) {
        const jsonResponse: GitHubJsonResponse = {
          data,
        }
        const nextUrl = parseNextUrl(response.headers.get('link'))

        if (rateLimit !== undefined) {
          jsonResponse.rateLimit = rateLimit
        }

        if (nextUrl !== undefined) {
          jsonResponse.nextUrl = nextUrl
        }

        return jsonResponse
      }

      const errorPayload = readErrorPayload(data)
      const retryParameters: {
        status: number
        rateLimit?: GitHubRateLimitMetadata
        attempt: number
        maxRetryDelayMs: number
        message?: string
      } = {
        status: response.status,
        attempt,
        maxRetryDelayMs,
      }

      if (rateLimit !== undefined) {
        retryParameters.rateLimit = rateLimit
      }

      if (errorPayload.message !== undefined) {
        retryParameters.message = errorPayload.message
      }

      const retryDelayMs = getRetryDelayMs(retryParameters)

      if (retryDelayMs !== undefined && attempt < maxRetries) {
        await sleep(retryDelayMs)
        continue
      }

      const apiErrorParameters: {
        message: string
        status: number
        rateLimit?: GitHubRateLimitMetadata
        documentationUrl?: string
      } = {
        message: errorPayload.message ?? `GitHub request failed with status ${response.status}.`,
        status: response.status,
      }

      if (rateLimit !== undefined) {
        apiErrorParameters.rateLimit = rateLimit
      }

      if (errorPayload.documentationUrl !== undefined) {
        apiErrorParameters.documentationUrl = errorPayload.documentationUrl
      }

      throw new GitHubApiError(apiErrorParameters)
    }

    throw new Error('GitHub retry loop exited unexpectedly.')
  }

  async function paginateJson<Item>(
    path: string,
    query: GitHubRequestQuery = {},
    options: GitHubPageOptions = {},
  ): Promise<GitHubPaginatedResult<Item>> {
    const perPage = options.perPage ?? 100
    const maxPages = options.maxPages ?? 1_000
    const items: Item[] = []
    const pages: GitHubPaginationMetadata[] = []
    const visitedUrls = new Set<string>()
    let pathOrUrl: string | undefined = path
    let page = 1
    let latestRateLimit: GitHubRateLimitMetadata | undefined

    while (pathOrUrl !== undefined) {
      if (page > maxPages) {
        throw new Error(`GitHub pagination exceeded the configured ${maxPages} page limit.`)
      }

      const currentQuery =
        pathOrUrl === path ? { ...query, per_page: perPage, page } : undefined
      const requestUrl = buildUrl(baseUrl, pathOrUrl, currentQuery ?? {})

      if (visitedUrls.has(requestUrl)) {
        throw new Error(`GitHub pagination loop detected at ${requestUrl}.`)
      }

      visitedUrls.add(requestUrl)

      const response = await getJson(pathOrUrl, currentQuery)

      if (!Array.isArray(response.data)) {
        throw new Error(`Expected GitHub list response for ${path}.`)
      }

      const pageItems = response.data as Item[]
      const pageMetadata: GitHubPaginationMetadata = {
        page,
        perPage,
        itemCount: pageItems.length,
        hasNextPage: response.nextUrl !== undefined,
      }

      if (response.nextUrl !== undefined) {
        pageMetadata.nextUrl = response.nextUrl
      }

      pages.push(pageMetadata)
      items.push(...pageItems)
      latestRateLimit = response.rateLimit
      pathOrUrl = response.nextUrl
      page += 1
    }

    const result: GitHubPaginatedResult<Item> = {
      items,
      pages,
    }

    if (latestRateLimit !== undefined) {
      result.rateLimit = latestRateLimit
    }

    return result
  }

  return { getJson, paginateJson }
}

function buildHeaders(token: string | undefined, apiVersion: string): Headers {
  const headers = new Headers({
    accept: 'application/vnd.github+json',
    'x-github-api-version': apiVersion,
    'user-agent': 'posthog-impact-dashboard',
  })

  if (token !== undefined && token.length > 0) {
    headers.set('authorization', `Bearer ${token}`)
  }

  return headers
}

function buildUrl(baseUrl: string, pathOrUrl: string, query: GitHubRequestQuery): string {
  const url = pathOrUrl.startsWith('http')
    ? new URL(pathOrUrl)
    : new URL(`${baseUrl}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`)

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

function readRateLimitMetadata(headers: Headers): GitHubRateLimitMetadata | undefined {
  const metadata: GitHubRateLimitMetadata = {}
  setNumberHeader(metadata, 'limit', headers.get('x-ratelimit-limit'))
  setNumberHeader(metadata, 'remaining', headers.get('x-ratelimit-remaining'))
  setNumberHeader(metadata, 'used', headers.get('x-ratelimit-used'))
  setStringHeader(metadata, 'resource', headers.get('x-ratelimit-resource'))
  setStringHeader(metadata, 'requestId', headers.get('x-github-request-id'))

  const resetSeconds = parseOptionalNumber(headers.get('x-ratelimit-reset'))
  if (resetSeconds !== undefined) {
    metadata.resetAt = new Date(resetSeconds * 1000).toISOString()
  }

  const retryAfterSeconds = parseOptionalNumber(headers.get('retry-after'))
  if (retryAfterSeconds !== undefined) {
    metadata.retryAfterMs = retryAfterSeconds * 1000
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined
}

function setNumberHeader(
  metadata: GitHubRateLimitMetadata,
  key: 'limit' | 'remaining' | 'used',
  value: string | null,
): void {
  const numberValue = parseOptionalNumber(value)

  if (numberValue !== undefined) {
    metadata[key] = numberValue
  }
}

function setStringHeader(
  metadata: GitHubRateLimitMetadata,
  key: 'resource' | 'requestId',
  value: string | null,
): void {
  if (value !== null && value.length > 0) {
    metadata[key] = value
  }
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (value === null || value.length === 0) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()

  if (text.length === 0) {
    return undefined
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function readErrorPayload(data: unknown): GitHubErrorPayload {
  if (!isRecord(data)) {
    return {}
  }

  const payload: GitHubErrorPayload = {}
  const message = data['message']
  const documentationUrl = data['documentation_url']

  if (typeof message === 'string') {
    payload.message = message
  }

  if (typeof documentationUrl === 'string') {
    payload.documentationUrl = documentationUrl
  }

  return payload
}

function getRetryDelayMs(parameters: {
  status: number
  rateLimit?: GitHubRateLimitMetadata
  attempt: number
  maxRetryDelayMs: number
  message?: string
}): number | undefined {
  const retryAfterMs = parameters.rateLimit?.retryAfterMs

  if (retryAfterMs !== undefined) {
    return Math.min(retryAfterMs, parameters.maxRetryDelayMs)
  }

  if (parameters.rateLimit?.remaining === 0 && parameters.rateLimit.resetAt !== undefined) {
    return Math.min(
      Math.max(new Date(parameters.rateLimit.resetAt).getTime() - Date.now(), 0),
      parameters.maxRetryDelayMs,
    )
  }

  if (
    parameters.status === 429 ||
    retryableServerStatuses.has(parameters.status) ||
    isSecondaryRateLimit(parameters.status, parameters.message)
  ) {
    return Math.min(2 ** parameters.attempt * 500, parameters.maxRetryDelayMs)
  }

  return undefined
}

function isSecondaryRateLimit(status: number, message: string | undefined): boolean {
  if (status !== 403 || message === undefined) {
    return false
  }

  return /secondary rate limit|abuse detection/i.test(message)
}

function parseNextUrl(linkHeader: string | null): string | undefined {
  if (linkHeader === null) {
    return undefined
  }

  for (const part of linkHeader.split(',')) {
    const [rawUrl, rawRel] = part.trim().split(';')

    if (rawUrl === undefined || rawRel === undefined || !rawRel.includes('rel="next"')) {
      continue
    }

    return rawUrl.trim().replace(/^<|>$/g, '')
  }

  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function removeTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

async function defaultSleep(delayMs: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}
