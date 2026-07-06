import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import type { BackendEnvironment } from './config/env.js'
import { checkDatabaseReadiness, getSharedDatabasePool } from './db/client.js'
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

  server.get('/ready', async (_request, reply) => {
    if (environment.databaseUrl === undefined) {
      return {
        status: 'ok',
        database: 'not_configured',
        repository: environment.githubRepository,
      }
    }

    const pool = getSharedDatabasePool({
      databaseUrl: environment.databaseUrl,
      applicationName: 'posthog-impact-ready',
    })
    const readiness = await checkDatabaseReadiness(pool)

    if (!readiness.ok) {
      reply.code(503)
    }

    return {
      status: readiness.ok ? 'ok' : 'degraded',
      database: readiness,
      repository: environment.githubRepository,
    }
  })

  await registerImpactRoutes(server)

  return server
}
