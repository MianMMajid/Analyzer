import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImpactApiError, getImpactDashboard } from './impactApi.ts'

const validPayload = {
  repository: 'PostHog/posthog',
  generatedAt: '2026-07-06T21:30:00.000Z',
  analysisWindow: {
    label: '2026-04-07 to 2026-07-06',
    days: 90,
    startedAt: '2026-04-07T00:00:00.000Z',
    endedAt: '2026-07-06T21:30:00.000Z',
  },
  dataFreshness: {
    source: 'mock_seed',
    status: 'fresh',
    generatedAt: '2026-07-06T21:30:00.000Z',
    lastSuccessfulRefreshAt: '2026-07-06T21:30:00.000Z',
    nextScheduledRefreshAt: null,
    reportAgeMinutes: 0,
  },
  methodology: {
    summary: 'Impact model',
    dimensions: [],
    guardrails: [],
  },
  engineers: [],
}

describe('getImpactDashboard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses the backend response at the API boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(validPayload)),
    )

    await expect(getImpactDashboard()).resolves.toEqual(validPayload)
  })

  it('rejects invalid backend data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ...validPayload, generatedAt: 'not-a-date' })),
    )

    await expect(getImpactDashboard()).rejects.toMatchObject({
      name: 'ImpactApiError',
      status: 200,
      code: 'INVALID_API_RESPONSE',
      message: 'Impact API returned an invalid dashboard payload.',
    } satisfies Partial<ImpactApiError>)
  })

  it('surfaces structured backend API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            error: 'No completed impact report exists. Run the refresh job first.',
            code: 'NO_IMPACT_REPORT',
            details: { repository: 'PostHog/posthog' },
          },
          { status: 503 },
        ),
      ),
    )

    await expect(getImpactDashboard()).rejects.toMatchObject({
      name: 'ImpactApiError',
      status: 503,
      code: 'NO_IMPACT_REPORT',
      message: 'No completed impact report exists. Run the refresh job first.',
      details: { repository: 'PostHog/posthog' },
    } satisfies Partial<ImpactApiError>)
  })

  it('falls back to a status error when a failed response is not contract JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>bad gateway</html>', { status: 502 })),
    )

    await expect(getImpactDashboard()).rejects.toMatchObject({
      name: 'ImpactApiError',
      status: 502,
      code: 'HTTP_ERROR',
      message: 'Impact API failed with status 502.',
    } satisfies Partial<ImpactApiError>)
  })

  it('wraps network failures before a response is available', async () => {
    const networkError = new TypeError('fetch failed')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw networkError
      }),
    )

    await expect(getImpactDashboard()).rejects.toMatchObject({
      name: 'ImpactApiError',
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Impact API network request failed.',
      cause: networkError,
    } satisfies Partial<ImpactApiError>)
  })

  it('rejects invalid JSON from successful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not-json', { status: 200 })),
    )

    await expect(getImpactDashboard()).rejects.toMatchObject({
      name: 'ImpactApiError',
      status: 200,
      code: 'INVALID_API_RESPONSE',
      message: 'Impact API returned invalid JSON.',
    } satisfies Partial<ImpactApiError>)
  })
})

function jsonResponse(body: unknown, options: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...options,
  })
}
