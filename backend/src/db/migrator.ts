import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export type SqlMigration = {
  readonly version: string
  readonly name: string
  readonly fileUrl: URL
}

export type MigrationResult = {
  readonly applied: readonly string[]
  readonly skipped: readonly string[]
}

export type MigrationDatabase = {
  query(sql: string, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
}

export const sqlMigrations = [
  {
    version: '001',
    name: 'initial_impact_schema',
    fileUrl: new URL('./migrations/001_initial_impact_schema.sql', import.meta.url),
  },
] satisfies readonly SqlMigration[]

export async function runMigrations(
  pool: MigrationDatabase,
  migrations: readonly SqlMigration[] = sqlMigrations,
): Promise<MigrationResult> {
  const applied: string[] = []
  const skipped: string[] = []

  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      name text not null,
      applied_at timestamptz not null default now()
    )
  `)

  for (const migration of migrations) {
    const existing = await pool.query('select version from schema_migrations where version = $1', [migration.version])

    if (existing.rowCount !== null && existing.rowCount > 0) {
      skipped.push(migration.version)
      continue
    }

    const sql = await readFile(fileURLToPath(migration.fileUrl), 'utf8')
    await pool.query('begin')

    try {
      await pool.query(sql)
      await pool.query('insert into schema_migrations (version, name) values ($1, $2)', [migration.version, migration.name])
      await pool.query('commit')
      applied.push(migration.version)
    } catch (error) {
      await pool.query('rollback')
      throw error
    }
  }

  return { applied, skipped }
}
