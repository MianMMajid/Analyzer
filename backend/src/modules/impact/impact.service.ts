import { getLatestImpactReport } from './impact.repository.js'
import { impactDimensions, methodologyGuardrails } from './impact.scoring.js'
import type { ImpactDashboardResponse } from './impact.types.js'

function calculateReportAgeMinutes(generatedAt: string): number {
  const ageMilliseconds = Date.now() - new Date(generatedAt).getTime()

  return Math.max(0, Math.round(ageMilliseconds / 60_000))
}

// The service shapes API-ready data and hides storage or ingestion details from routes.
export function getImpactDashboard(): ImpactDashboardResponse {
  const report = getLatestImpactReport()
  const reportAgeMinutes = calculateReportAgeMinutes(report.generatedAt)

  return {
    repository: report.repository,
    generatedAt: report.generatedAt,
    analysisWindow: report.analysisWindow,
    dataFreshness: {
      source: report.source,
      status: 'fresh',
      generatedAt: report.generatedAt,
      lastSuccessfulRefreshAt: report.generatedAt,
      nextScheduledRefreshAt: null,
      reportAgeMinutes,
    },
    methodology: {
      summary:
        'Impact combines customer value, technical leverage, risk reduction, ownership, and collaboration. Raw activity volume is treated as supporting context, not the ranking driver.',
      dimensions: impactDimensions,
      guardrails: methodologyGuardrails,
    },
    engineers: report.engineers,
  }
}
