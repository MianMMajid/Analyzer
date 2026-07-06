import { describe, expect, it, vi } from 'vitest'

const pgMocks = vi.hoisted(() => ({
  constructedConfigs: [] as unknown[],
  end: vi.fn(),
  query: vi.fn(),
}))

vi.mock('pg', () => ({
  Pool: class MockPool {
    query = pgMocks.query
    end = pgMocks.end

    constructor(config: unknown) {
      pgMocks.constructedConfigs.push(config)
    }
  },
}))

describe('database client', () => {
  it('does not create a pool at import time', async () => {
    await import('./client.js')

    expect(pgMocks.constructedConfigs).toHaveLength(0)
    expect(pgMocks.query).not.toHaveBeenCalled()
  })

  it('creates pools lazily and does not connect until queried', async () => {
    const { createDatabasePool } = await import('./client.js')

    createDatabasePool({
      databaseUrl: 'postgres://user:pass@localhost:5432/posthog_impact',
      applicationName: 'impact-dashboard-test',
    })

    expect(pgMocks.constructedConfigs).toHaveLength(1)
    expect(pgMocks.query).not.toHaveBeenCalled()
    expect(pgMocks.constructedConfigs[0]).toMatchObject({
      connectionString: 'postgres://user:pass@localhost:5432/posthog_impact',
      application_name: 'impact-dashboard-test',
      max: 10,
    })
  })

  it('returns readiness details without throwing on query failure', async () => {
    const { checkDatabaseReadiness } = await import('./client.js')
    pgMocks.query.mockRejectedValueOnce(new Error('connection refused'))

    await expect(checkDatabaseReadiness({ query: pgMocks.query })).resolves.toMatchObject({
      ok: false,
      error: 'connection refused',
    })
  })
})
