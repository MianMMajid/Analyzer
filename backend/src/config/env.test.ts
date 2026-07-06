import { describe, expect, it } from 'vitest'
import { parseBackendEnvironment } from './env.js'

describe('parseBackendEnvironment', () => {
  it('uses local-safe defaults outside production', () => {
    expect(parseBackendEnvironment({})).toMatchObject({
      port: 4000,
      webOrigin: 'http://localhost:5173',
      githubRepository: 'PostHog/posthog',
      analysisWindowDays: 90,
      apiAverageLatencyTargetMs: 150,
    })
  })

  it('requires GitHub token and database URL in production', () => {
    expect(() => parseBackendEnvironment({ NODE_ENV: 'production' })).toThrow()
  })
})
