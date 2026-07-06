export const databaseTables = {
  impactReports: 'impact_reports',
  engineers: 'engineers',
  evidence: 'evidence',
  ingestionRuns: 'ingestion_runs',
} as const

export type ImpactReportStatus = 'running' | 'completed' | 'failed'
export type IngestionRunStatus = 'running' | 'completed' | 'failed'

export const impactReportStatuses = ['running', 'completed', 'failed'] as const satisfies readonly ImpactReportStatus[]
export const ingestionRunStatuses = ['running', 'completed', 'failed'] as const satisfies readonly IngestionRunStatus[]

export type ImpactReportRow = {
  id: number
  repository: string
  analysis_window_days: number
  window_started_at: Date
  window_ended_at: Date
  generated_at: Date
  status: ImpactReportStatus
  summary_json: unknown
  data_version: string
  created_at: Date
}

export type EngineerRow = {
  id: number
  repository: string
  canonical_login: string
  display_name: string
  primary_email_hash: string | null
  github_user_id: number | null
  aliases_json: unknown
  is_bot: boolean
  created_at: Date
  updated_at: Date
}

export type EvidenceRow = {
  id: number
  report_id: number
  engineer_id: number
  source_type: string
  source_id: string
  impact_dimension: string
  occurred_at: Date
  title: string
  url: string | null
  weight: string
  payload_json: unknown
  created_at: Date
}

export type IngestionRunRow = {
  id: number
  repository: string
  source: string
  status: IngestionRunStatus
  since_at: Date
  until_at: Date
  started_at: Date
  finished_at: Date | null
  cursor_json: unknown
  stats_json: unknown
  error_code: string | null
  error_message: string | null
  created_at: Date
}
