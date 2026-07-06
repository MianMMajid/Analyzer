import { randomUUID } from 'node:crypto'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import type { BackendEnvironment } from './config/env.js'
import { buildDatabasePoolOptions, checkDatabaseReadiness, getSharedDatabasePool } from './db/client.js'
import { registerErrorHandling } from './modules/http/errors.js'
import { registerImpactRoutes } from './modules/impact/impact.routes.js'
import { registerRequestTiming } from './modules/performance/requestTiming.js'

// buildServer keeps HTTP wiring testable without starting a listener.
export async function buildServer(environment: BackendEnvironment) {
  const server = Fastify({
    bodyLimit: 1_048_576,
    genReqId: (request) => request.headers['x-request-id']?.toString() ?? randomUUID(),
    logger: true,
    requestIdHeader: 'x-request-id',
  })

  await server.register(helmet)

  await server.register(cors, {
    origin: environment.webOrigin,
  })

  await server.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  })

  await registerErrorHandling(server)
  await registerRequestTiming(server, environment.apiAverageLatencyTargetMs)

  server.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id)
  })

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

    const pool = getSharedDatabasePool(
      buildDatabasePoolOptions(
        {
          databaseUrl: environment.databaseUrl,
          databaseSslMode: environment.databaseSslMode,
        },
        'posthog-impact-ready',
      ),
    )
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
