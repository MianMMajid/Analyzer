import { describe, expect, it, vi } from 'vitest'
import { runMigrations, type SqlMigration } from './migrator.js'

describe('runMigrations', () => {
  it('creates the migration table and records newly applied migrations', async () => {
    const queries: readonly unknown[][] = []
    const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
      ;(queries as unknown[][]).push([sql, params])
      if (sql.startsWith('select version')) {
        return { rowCount: 0, rows: [] }
      }

      return { rowCount: 1, rows: [] }
    })
    const migrations: readonly SqlMigration[] = [
      {
        version: 'test',
        name: 'test_migration',
        fileUrl: new URL('./migrations/001_initial_impact_schema.sql', import.meta.url),
      },
    ]

    await expect(runMigrations({ query }, migrations)).resolves.toEqual({
      applied: ['test'],
      skipped: [],
    })
    expect(query).toHaveBeenCalledWith('begin')
    expect(query).toHaveBeenCalledWith('commit')
  })
})
