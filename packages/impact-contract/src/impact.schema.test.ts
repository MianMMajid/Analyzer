import { describe, expect, it } from 'vitest'
import { ApiErrorSchema, ImpactDashboardResponseSchema } from './impact.schema.js'

describe('impact contract schemas', () => {
  it('accepts the public API error shape', () => {
    expect(ApiErrorSchema.parse({ error: 'Bad request', code: 'BAD_REQUEST' })).toEqual({
      error: 'Bad request',
      code: 'BAD_REQUEST',
    })
  })

  it('rejects invalid impact scores', () => {
    expect(() =>
      ImpactDashboardResponseSchema.parse({
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
          summary: 'test',
          dimensions: [],
          guardrails: [],
        },
        engineers: [
          {
            id: 'bad',
            name: 'Bad Score',
            githubLogin: 'bad',
            rank: 1,
            totalScore: 101,
            primaryImpactArea: 'Testing',
            primaryContributionTheme: 'Invalid',
            areas: ['Testing'],
            breakdown: {
              customerValue: 0,
              technicalLeverage: 0,
              riskReduction: 0,
              ownership: 0,
              collaboration: 0,
            },
            explanation: 'Invalid score should fail',
            riskQualityNote: 'Invalid score should fail',
            confidence: 'high',
            evidence: [],
          },
        ],
      }),
    ).toThrow()
  })
})
