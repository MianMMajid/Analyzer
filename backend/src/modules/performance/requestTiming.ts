import type { FastifyInstance, FastifyRequest } from 'fastify'

const requestStartTimes = new WeakMap<FastifyRequest, bigint>()

function durationMillisecondsSince(startTime: bigint): number {
  const durationNanoseconds = process.hrtime.bigint() - startTime

  return Math.round(Number(durationNanoseconds) / 1_000_000)
}

// Timing is registered once at the HTTP boundary so every route can be measured
// against the Railway latency target without duplicating logging in handlers.
export async function registerRequestTiming(server: FastifyInstance, averageLatencyTargetMs: number): Promise<void> {
  server.addHook('onRequest', async (request) => {
    requestStartTimes.set(request, process.hrtime.bigint())
  })

  server.addHook('onResponse', async (request, reply) => {
    const startTime = requestStartTimes.get(request)

    if (startTime === undefined) {
      return
    }

    const durationMs = durationMillisecondsSince(startTime)
    const route = request.routeOptions.url ?? request.url
    const cacheStatus = reply.getHeader('x-cache-status')
    const reportAgeMinutes = reply.getHeader('x-impact-report-age-minutes')

    request.log.info(
      {
        method: request.method,
        route,
        statusCode: reply.statusCode,
        durationMs,
        averageLatencyTargetMs,
        aboveAverageLatencyTarget: durationMs > averageLatencyTargetMs,
        cacheStatus: typeof cacheStatus === 'string' ? cacheStatus : 'unknown',
        reportAgeMinutes:
          typeof reportAgeMinutes === 'number' || typeof reportAgeMinutes === 'string'
            ? Number(reportAgeMinutes)
            : null,
      },
      'request completed',
    )
  })
}
