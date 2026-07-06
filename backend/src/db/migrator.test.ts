import { describe, expect, it, vi } from 'vitest'
import { runMigrations, type SqlMigration } from './migrator.js'

describe('runMigrations', () => {
  it('creates the migration table and records newly applied migrations', async () => {
    const poolQuery = vi.fn(async (sql: string) => {
      if (sql.startsWith('select version')) {
        return { rowCount: 0, rows: [] }
      }

      return { rowCount: 1, rows: [] }
    })
    const client = {
      query: vi.fn(async () => ({ rowCount: 1, rows: [] })),
      release: vi.fn(),
    }
    const pool = {
      query: poolQuery,
      connect: vi.fn(async () => client),
    }
    const migrations: readonly SqlMigration[] = [
      {
        version: 'test',
        name: 'test_migration',
        fileUrl: new URL('./migrations/001_initial_impact_schema.sql', import.meta.url),
      },
    ]

    await expect(runMigrations(pool, migrations)).resolves.toEqual({
      applied: ['test'],
      skipped: [],
    })
    expect(poolQuery).not.toHaveBeenCalledWith('begin')
    expect(client.query).toHaveBeenCalledWith('begin')
    expect(client.query).toHaveBeenCalledWith('commit')
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('skips already-applied migrations without opening a transaction', async () => {
    const pool = {
      query: vi.fn(async (sql: string) => ({
        rowCount: sql.startsWith('select version') ? 1 : 0,
        rows: [],
      })),
      connect: vi.fn(),
    }
    const migrations: readonly SqlMigration[] = [
      {
        version: 'test',
        name: 'test_migration',
        fileUrl: new URL('./migrations/001_initial_impact_schema.sql', import.meta.url),
      },
    ]

    await expect(runMigrations(pool, migrations)).resolves.toEqual({
      applied: [],
      skipped: ['test'],
    })
    expect(pool.connect).not.toHaveBeenCalled()
  })
})
