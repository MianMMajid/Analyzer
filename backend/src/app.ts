import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import type { BackendEnvironment } from './config/env.js'
import { registerErrorHandling } from './modules/http/errors.js'
import { registerImpactRoutes } from './modules/impact/impact.routes.js'
import { registerRequestTiming } from './modules/performance/requestTiming.js'

// buildServer keeps HTTP wiring testable without starting a listener.
export async function buildServer(environment: BackendEnvironment) {
  const server = Fastify({
    bodyLimit: 1_048_576,
    logger: true,
  })

  await server.register(cors, {
    origin: environment.webOrigin,
  })

  await server.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  })

  await registerErrorHandling(server)
  await registerRequestTiming(server, environment.apiAverageLatencyTargetMs)

  server.get('/health', async () => ({
    status: 'ok',
    repository: environment.githubRepository,
    uptimeSeconds: Math.round(process.uptime()),
  }))

  server.get('/ready', async () => ({
    status: 'ok',
    database: environment.databaseUrl === undefined ? 'not_configured' : 'configured',
    repository: environment.githubRepository,
  }))

  await registerImpactRoutes(server)

  return server
}
