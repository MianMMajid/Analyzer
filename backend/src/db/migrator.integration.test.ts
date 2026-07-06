import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkDatabaseReadiness, createDatabasePool } from './client.js'
import { runMigrations } from './migrator.js'

const databaseUrl = process.env['DATABASE_INTEGRATION_TEST_URL']
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

describeWithDatabase('database migrations against Postgres', () => {
  const pool = createDatabasePool({
    databaseUrl: databaseUrl ?? 'postgres://unused',
    applicationName: 'posthog-impact-integration-test',
  })

  beforeAll(async () => {
    await dropMigrationTables()
  })

  afterAll(async () => {
    await dropMigrationTables()
    await pool.end()
  })

  it('applies migrations and leaves the database ready', async () => {
    await expect(runMigrations(pool)).resolves.toMatchObject({
      applied: ['001'],
      skipped: [],
    })
    await expect(runMigrations(pool)).resolves.toMatchObject({
      applied: [],
      skipped: ['001'],
    })
    await expect(checkDatabaseReadiness(pool)).resolves.toMatchObject({
      ok: true,
    })
  })

  async function dropMigrationTables(): Promise<void> {
    await pool.query('drop table if exists evidence cascade')
    await pool.query('drop table if exists engineers cascade')
    await pool.query('drop table if exists impact_reports cascade')
    await pool.query('drop table if exists ingestion_runs cascade')
    await pool.query('drop table if exists schema_migrations cascade')
  }
})
