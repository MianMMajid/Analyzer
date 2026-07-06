import { backendEnvironment } from '../config/env.js'
import { buildDatabasePoolOptions, getSharedDatabasePool } from './client.js'
import { runMigrations } from './migrator.js'

if (backendEnvironment.databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required to run database migrations.')
}

const pool = getSharedDatabasePool(
  buildDatabasePoolOptions(
    {
      databaseUrl: backendEnvironment.databaseUrl,
      databaseSslMode: backendEnvironment.databaseSslMode,
    },
    'posthog-impact-migrate',
  ),
)

try {
  const result = await runMigrations(pool)
  console.log(
    `Database migrations complete. Applied: ${result.applied.join(', ') || 'none'}. Skipped: ${result.skipped.join(', ') || 'none'}.`,
  )
} finally {
  await pool.end()
}
