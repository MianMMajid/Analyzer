import { backendEnvironment } from '../config/env.js'
import { getSharedDatabasePool } from './client.js'
import { runMigrations } from './migrator.js'

if (backendEnvironment.databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required to run database migrations.')
}

const pool = getSharedDatabasePool({
  databaseUrl: backendEnvironment.databaseUrl,
  applicationName: 'posthog-impact-migrate',
})

try {
  const result = await runMigrations(pool)
  console.log(`Database migrations complete. Applied: ${result.applied.join(', ') || 'none'}. Skipped: ${result.skipped.join(', ') || 'none'}.`)
} finally {
  await pool.end()
}
