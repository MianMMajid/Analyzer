import { describe, expect, it, vi } from 'vitest'
import { seedAnalysisWindow, seedImpactEngineers, seedReportGeneratedAt } from './impact.data.js'
import {
  getLatestPersistedImpactReport,
  NoImpactReportError,
  saveImpactReport,
  type ImpactReportRecord,
} from './impact.repository.js'

const report = {
  repository: 'PostHog/posthog',
  generatedAt: seedReportGeneratedAt,
  analysisWindow: seedAnalysisWindow,
  engineers: seedImpactEngineers.slice(0, 1),
  source: 'github_ingestion',
} satisfies ImpactReportRecord

describe('impact repository persistence', () => {
  it('reads the latest completed persisted report', async () => {
    const query = vi.fn(async () => ({
      rowCount: 1,
      rows: [{ summary_json: report }],
    }))

    await expect(getLatestPersistedImpactReport({ query }, 'PostHog/posthog', 90)).resolves.toEqual(report)
    expect(query).toHaveBeenCalledWith(expect.stringContaining('from impact_reports'), ['PostHog/posthog', 90])
  })

  it('uses an explicit error when production has no completed DB report', () => {
    expect(new NoImpactReportError('PostHog/posthog', 90)).toMatchObject({
      statusCode: 503,
      message: expect.stringContaining('Run the refresh job'),
    })
  })

  it('persists report, engineer, and evidence rows in one transaction', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('insert into impact_reports')) {
          return { rowCount: 1, rows: [{ id: 101 }] }
        }

        if (sql.includes('insert into engineers')) {
          return { rowCount: 1, rows: [{ id: 202 }] }
        }

        return { rowCount: 1, rows: [] }
      }),
      release: vi.fn(),
    }
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => client),
    }

    await expect(saveImpactReport(pool, report)).resolves.toBe(101)
    expect(client.query).toHaveBeenCalledWith('begin')
    expect(client.query).toHaveBeenCalledWith('commit')
    expect(client.release).toHaveBeenCalled()
  })
})
