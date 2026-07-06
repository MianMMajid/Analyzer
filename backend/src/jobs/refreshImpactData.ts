import { backendEnvironment } from '../config/env.js'

// Railway can run this as a scheduled job once GitHub ingestion is implemented.
// The production path should enqueue a pg-boss job keyed by repository/window,
// paginate GitHub activity, normalize contributors, score aggregates, and only
// publish a completed impact report after all evidence is durable.
console.log(
  `Refresh job placeholder for ${backendEnvironment.githubRepository} over ${backendEnvironment.analysisWindowDays} days. Future implementation should use pg-boss with Railway PostgreSQL.`,
)
