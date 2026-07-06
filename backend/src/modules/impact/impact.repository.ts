import { z } from 'zod'
import { ImpactEngineerSchema } from '@repo/impact-contract'
import { backendEnvironment, type BackendEnvironment } from '../../config/env.js'
import { getSharedDatabasePool } from '../../db/client.js'
import { databaseTables } from '../../db/schema.js'
import { type Queryable, type TransactionPool, withTransaction } from '../../db/transaction.js'
import { seedAnalysisWindow, seedImpactEngineers, seedReportGeneratedAt } from './impact.data.js'
import type { ImpactDashboardResponse, ImpactEngineer } from './impact.types.js'

export type ImpactReportSource = 'mock_seed' | 'github_ingestion'

export type ImpactReportRecord = {
  repository: string
  generatedAt: string
  analysisWindow: ImpactDashboardResponse['analysisWindow']
  engineers: readonly ImpactEngineer[]
  source: ImpactReportSource
}

const ImpactReportRecordSchema = z.object({
  repository: z.string().min(1),
  generatedAt: z.iso.datetime(),
  analysisWindow: z.object({
    label: z.string().min(1),
    days: z.number().int().positive(),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime(),
  }),
  engineers: z.array(ImpactEngineerSchema).readonly(),
  source: z.enum(['mock_seed', 'github_ingestion']),
})

const seedImpactReport = {
  repository: backendEnvironment.githubRepository,
  generatedAt: seedReportGeneratedAt,
  analysisWindow: seedAnalysisWindow,
  engineers: seedImpactEngineers,
  source: 'mock_seed',
} satisfies ImpactReportRecord

export class NoImpactReportError extends Error {
  readonly statusCode = 503

  constructor(repository: string, analysisWindowDays: number) {
    super(`No completed impact report exists for ${repository} over ${analysisWindowDays} days. Run the refresh job before serving production traffic.`)
    this.name = 'NoImpactReportError'
  }
}

export async function getLatestImpactReport(
  environment: BackendEnvironment = backendEnvironment,
): Promise<ImpactReportRecord> {
  if (environment.databaseUrl === undefined) {
    return seedImpactReport
  }

  const pool = getSharedDatabasePool({
    databaseUrl: environment.databaseUrl,
    applicationName: 'posthog-impact-api',
  })
  const report = await getLatestPersistedImpactReport(pool, environment.githubRepository, environment.analysisWindowDays)

  if (report !== null) {
    return report
  }

  if (!environment.isProduction) {
    return seedImpactReport
  }

  throw new NoImpactReportError(environment.githubRepository, environment.analysisWindowDays)
}

export async function getLatestPersistedImpactReport(
  database: Queryable,
  repository: string,
  analysisWindowDays: number,
): Promise<ImpactReportRecord | null> {
  const result = await database.query(
    `
      select summary_json
      from ${databaseTables.impactReports}
      where repository = $1
        and analysis_window_days = $2
        and status = 'completed'
      order by generated_at desc
      limit 1
    `,
    [repository, analysisWindowDays],
  )
  const row = result.rows[0]

  if (row === undefined) {
    return null
  }

  return ImpactReportRecordSchema.parse(row['summary_json'])
}

export async function saveImpactReport(database: TransactionPool, report: ImpactReportRecord): Promise<number> {
  const parsedReport = ImpactReportRecordSchema.parse(report)

  return withTransaction(database, async (client) => {
    const reportResult = await client.query(
      `
        insert into ${databaseTables.impactReports}
          (repository, analysis_window_days, window_started_at, window_ended_at, generated_at, status, summary_json, data_version)
        values ($1, $2, $3, $4, $5, 'completed', $6::jsonb, 'v1')
        returning id
      `,
      [
        parsedReport.repository,
        parsedReport.analysisWindow.days,
        parsedReport.analysisWindow.startedAt,
        parsedReport.analysisWindow.endedAt,
        parsedReport.generatedAt,
        JSON.stringify(parsedReport),
      ],
    )
    const reportId = readId(reportResult.rows[0])

    if (reportId === undefined) {
      throw new Error('Impact report insert did not return an id.')
    }

    for (const engineer of parsedReport.engineers) {
      const engineerId = await upsertEngineer(client, parsedReport.repository, engineer)
      await insertEvidence(client, reportId, parsedReport.generatedAt, engineerId, engineer)
    }

    return reportId
  })
}

async function upsertEngineer(database: Queryable, repository: string, engineer: ImpactEngineer): Promise<number> {
  const result = await database.query(
    `
      insert into ${databaseTables.engineers}
        (repository, canonical_login, display_name, aliases_json, is_bot, updated_at)
      values ($1, $2, $3, $4::jsonb, false, now())
      on conflict (repository, canonical_login)
      do update set
        display_name = excluded.display_name,
        aliases_json = excluded.aliases_json,
        updated_at = now()
      returning id
    `,
    [
      repository,
      engineer.githubLogin.toLowerCase(),
      engineer.name,
      JSON.stringify([{ login: engineer.githubLogin, name: engineer.name }]),
    ],
  )
  const id = readId(result.rows[0])

  if (id === undefined) {
    throw new Error(`Engineer upsert did not return an id for ${engineer.githubLogin}.`)
  }

  return id
}

function readId(row: Record<string, unknown> | undefined): number | undefined {
  const value = row?.['id']

  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseInt(value, 10)
    return Number.isSafeInteger(parsedValue) ? parsedValue : undefined
  }

  return undefined
}

async function insertEvidence(
  database: Queryable,
  reportId: number,
  generatedAt: string,
  engineerId: number,
  engineer: ImpactEngineer,
): Promise<void> {
  for (const evidence of engineer.evidence) {
    await database.query(
      `
        insert into ${databaseTables.evidence}
          (report_id, engineer_id, source_type, source_id, impact_dimension, occurred_at, title, url, weight, payload_json)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        on conflict (report_id, engineer_id, source_type, source_id, impact_dimension)
        do nothing
      `,
      [
        reportId,
        engineerId,
        evidence.kind,
        evidence.url,
        evidence.contributionType,
        generatedAt,
        evidence.title,
        evidence.url,
        engineer.totalScore / 100,
        JSON.stringify({ reason: evidence.reason, whyItMatters: evidence.whyItMatters, area: evidence.area }),
      ],
    )
  }
}
