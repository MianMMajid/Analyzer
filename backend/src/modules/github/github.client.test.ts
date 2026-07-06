import { describe, expect, it, vi } from 'vitest'
import { GitHubApiError, createGitHubClient } from './github.client.js'

describe('GitHub client', () => {
  it('sends versioned authenticated requests and follows pagination links safely', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse([{ id: 1 }], {
          link: '<https://api.github.test/repos/PostHog/posthog/branches?page=2>; rel="next"',
          'x-ratelimit-remaining': '4999',
        }),
      )
      .mockResolvedValueOnce(jsonResponse([{ id: 2 }]))

    const client = createGitHubClient({
      token: 'token-123',
      baseUrl: 'https://api.github.test',
      fetch: fetchMock,
    })

    const result = await client.paginateJson<{ id: number }>(
      '/repos/PostHog/posthog/branches',
      {},
      { perPage: 1 },
    )

    expect(result.items).toEqual([{ id: 1 }, { id: 2 }])
    expect(result.pages).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstRequestInit = fetchMock.mock.calls[0]?.[1]
    expect(firstRequestInit?.headers).toBeInstanceOf(Headers)
    const headers = firstRequestInit?.headers as Headers
    expect(headers.get('authorization')).toBe('Bearer token-123')
    expect(headers.get('x-github-api-version')).toBe('2022-11-28')
  })

  it('backs off and retries rate-limited responses', async () => {
    const sleep = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          { message: 'You have exceeded a secondary rate limit.' },
          { status: 429, 'retry-after': '2' },
        ),
      )
      .mockResolvedValueOnce(jsonResponse([{ id: 1 }]))

    const client = createGitHubClient({
      baseUrl: 'https://api.github.test',
      fetch: fetchMock,
      sleep,
    })

    const result = await client.paginateJson<{ id: number }>('/repos/PostHog/posthog/branches')

    expect(result.items).toEqual([{ id: 1 }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(2_000)
  })

  it('throws typed API errors after retry budget is exhausted', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        jsonResponse({ message: 'Service unavailable.' }, { status: 503 }),
      )
    const client = createGitHubClient({
      baseUrl: 'https://api.github.test',
      fetch: fetchMock,
      sleep: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      maxRetries: 1,
    })

    await expect(client.getJson('/repos/PostHog/posthog/branches')).rejects.toMatchObject({
      name: 'GitHubApiError',
      status: 503,
      message: 'Service unavailable.',
    } satisfies Partial<GitHubApiError>)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

function jsonResponse(
  body: unknown,
  options: Record<string, string | number> = {},
): Response {
  const { status = 200, ...rawHeaders } = options
  const headers = new Headers()

  for (const [key, value] of Object.entries(rawHeaders)) {
    headers.set(key, String(value))
  }

  return new Response(JSON.stringify(body), {
    status: Number(status),
    headers,
  })
}
