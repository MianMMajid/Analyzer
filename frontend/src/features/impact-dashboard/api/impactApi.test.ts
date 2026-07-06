import { afterEach, describe, expect, it, vi } from 'vitest'
import { getImpactDashboard } from './impactApi.ts'

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
      vi.fn(async () => ({
        ok: true,
        json: async () => validPayload,
      })),
    )

    await expect(getImpactDashboard()).resolves.toEqual(validPayload)
  })

  it('rejects invalid backend data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ...validPayload, generatedAt: 'not-a-date' }),
      })),
    )

    await expect(getImpactDashboard()).rejects.toThrow()
  })
})
