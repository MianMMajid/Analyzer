import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ImpactDashboardResponseSchema } from '@repo/impact-contract'
import { getImpactDashboard } from './impact.service.js'

// Routes stay thin: HTTP concerns here, analysis and data ownership in the service.
export async function registerImpactRoutes(server: FastifyInstance): Promise<void> {
  async function handleSummary(_request: FastifyRequest, reply: FastifyReply) {
    const dashboard = ImpactDashboardResponseSchema.parse(await getImpactDashboard())

    reply.header('x-cache-status', dashboard.dataFreshness.source)
    reply.header('x-impact-report-age-minutes', dashboard.dataFreshness.reportAgeMinutes)

    return dashboard
  }

  server.get('/api/v1/impact/summary', handleSummary)
}
