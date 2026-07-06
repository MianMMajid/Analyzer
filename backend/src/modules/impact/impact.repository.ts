import { backendEnvironment } from '../../config/env.js'
import { seedAnalysisWindow, seedImpactEngineers, seedReportGeneratedAt } from './impact.data.js'
import type { ImpactDashboardResponse, ImpactEngineer } from './impact.types.js'

type ImpactReportRecord = {
  repository: string
  generatedAt: string
  analysisWindow: ImpactDashboardResponse['analysisWindow']
  engineers: readonly ImpactEngineer[]
  source: 'mock_seed'
}

const latestImpactReport = {
  repository: backendEnvironment.githubRepository,
  generatedAt: seedReportGeneratedAt,
  analysisWindow: seedAnalysisWindow,
  engineers: seedImpactEngineers,
  source: 'mock_seed',
} satisfies ImpactReportRecord

// This repository is the future PostgreSQL read boundary. The API read path
// should remain O(1): fetch the latest completed compact report, never GitHub.
export function getLatestImpactReport(): ImpactReportRecord {
  return latestImpactReport
}
