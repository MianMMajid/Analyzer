import { backendEnvironment, type BackendEnvironment } from '../config/env.js'
import { getSharedDatabasePool } from '../db/client.js'
import { runMigrations } from '../db/migrator.js'
import { buildImpactReportFromGitHub } from '../modules/impact/impact.ingestion.js'
import { saveImpactReport } from '../modules/impact/impact.repository.js'

export type RefreshImpactDataResult = {
  readonly reportId: number
  readonly engineerCount: number
  readonly generatedAt: string
}

export async function refreshImpactData(environment: BackendEnvironment = backendEnvironment): Promise<RefreshImpactDataResult> {
  if (environment.databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required to refresh and persist impact data.')
  }

  if (environment.githubToken === undefined) {
    throw new Error('GITHUB_TOKEN is required to refresh impact data from GitHub.')
  }

  const pool = getSharedDatabasePool({
    databaseUrl: environment.databaseUrl,
    applicationName: 'posthog-impact-refresh',
  })

  await runMigrations(pool)
  const report = await buildImpactReportFromGitHub({
    repository: environment.githubRepository,
    analysisWindowDays: environment.analysisWindowDays,
    githubToken: environment.githubToken,
  })
  const reportId = await saveImpactReport(pool, report)

  return {
    reportId,
    engineerCount: report.engineers.length,
    generatedAt: report.generatedAt,
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  const result = await refreshImpactData()
  console.log(
    `Impact refresh complete. reportId=${result.reportId} engineers=${result.engineerCount} generatedAt=${result.generatedAt}`,
  )
}
