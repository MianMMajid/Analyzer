import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { registerErrorHandling } from './errors.js'

describe('HTTP error handling', () => {
  it('masks internal server errors behind the API error contract', async () => {
    const server = Fastify({ logger: false })
    await registerErrorHandling(server)
    server.get('/boom', async () => {
      throw new Error('database password leaked')
    })

    const response = await server.inject({ method: 'GET', url: '/boom' })
    await server.close()

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'Internal server error.',
      code: 'INTERNAL_SERVER_ERROR',
    })
  })

  it('preserves client-facing messages for valid 4xx errors', async () => {
    const server = Fastify({ logger: false })
    await registerErrorHandling(server)
    server.get('/bad-request', async () => {
      const error = new Error('Invalid filter.')
      Object.assign(error, { statusCode: 400 })
      throw error
    })

    const response = await server.inject({ method: 'GET', url: '/bad-request' })
    await server.close()

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'Invalid filter.',
      code: 'CLIENT_ERROR',
    })
  })

  it('normalizes invalid error status codes to 500', async () => {
    const server = Fastify({ logger: false })
    await registerErrorHandling(server)
    server.get('/bad-status', async () => {
      const error = new Error('Invalid status.')
      Object.assign(error, { statusCode: 200 })
      throw error
    })

    const response = await server.inject({ method: 'GET', url: '/bad-status' })
    await server.close()

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'Internal server error.',
      code: 'INTERNAL_SERVER_ERROR',
    })
  })
})
