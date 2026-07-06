import { describe, expect, it } from 'vitest'
import { buildServer } from '../../app.js'
import { parseBackendEnvironment } from '../../config/env.js'

describe('impact routes', () => {
  it('serves a versioned impact summary that matches the contract', async () => {
    const server = await buildServer(parseBackendEnvironment({ NODE_ENV: 'test' }))

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/impact/summary',
    })

    await server.close()

    expect(response.statusCode).toBe(200)
    expect(response.headers['x-cache-status']).toBe('mock_seed')
    expect(response.json().engineers).toHaveLength(5)
  })

  it('returns a stable API error shape for missing routes', async () => {
    const server = await buildServer(parseBackendEnvironment({ NODE_ENV: 'test' }))

    const response = await server.inject({
      method: 'GET',
      url: '/api/missing',
    })

    await server.close()

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: 'Route not found.',
      code: 'NOT_FOUND',
    })
  })
})
