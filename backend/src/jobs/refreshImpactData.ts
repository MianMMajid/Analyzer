import { backendEnvironment, type BackendEnvironment } from '../config/env.js'
import { getSharedDatabasePool } from '../db/client.js'
import { runMigrations } from '../db/migrator.js'
import { buildImpactReportFromGitHub } from '../modules/impact/impact.ingestion.js'
import { saveImpactReport } from '../modules/impact/impact.repository.js'
import { serializeError } from '../modules/observability/errorSerialization.js'
import { createQueueClient } from '../modules/queue/queue.client.js'
import type { QueueEnqueueOptions, RefreshImpactJobPayload } from '../modules/queue/queue.types.js'

export type RefreshImpactDataResult = {
  readonly reportId: number
  readonly engineerCount: number
  readonly generatedAt: string
}

export async function refreshImpactData(environment: BackendEnvironment = backendEnvironment): Promise<RefreshImpactDataResult> {
  if (environment.databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required to refresh and persist impact data.')
  }

  if (environment.githubToken === undefined && environment.isProduction) {
    throw new Error('GITHUB_TOKEN is required to refresh impact data from GitHub.')
  }

  const pool = getSharedDatabasePool({
    databaseUrl: environment.databaseUrl,
    applicationName: 'posthog-impact-refresh',
  })

  await runMigrations(pool)
  const report = await buildImpactReportFromGitHub({
    repository: environment.githubRepository,
    analysisWindowDays: environment.analysisWindowDays,
    ...(environment.githubToken === undefined ? {} : { githubToken: environment.githubToken }),
  })
  const reportId = await saveImpactReport(pool, report)

  return {
    reportId,
    engineerCount: report.engineers.length,
    generatedAt: report.generatedAt,
  }
}

async function runInlineScheduledRefresh(environment: BackendEnvironment): Promise<void> {
  const intervalMs = environment.refreshIntervalMs

  if (intervalMs === undefined) {
    throw new Error('REFRESH_INTERVAL_MS is required for scheduled impact refresh.')
  }

  let isRefreshing = false

  async function tick(): Promise<void> {
    if (isRefreshing) {
      console.warn('Skipping impact refresh because the previous refresh is still running.')
      return
    }

    isRefreshing = true

    try {
      const result = await refreshImpactData(environment)
      console.log(
        `Impact refresh complete. reportId=${result.reportId} engineers=${result.engineerCount} generatedAt=${result.generatedAt}`,
      )
    } catch (error) {
      console.error(JSON.stringify({
        event: 'impact_refresh_failed',
        repository: environment.githubRepository,
        analysisWindowDays: environment.analysisWindowDays,
        error: serializeError(error),
      }))
    } finally {
      isRefreshing = false
    }
  }

  await tick()
  setInterval(() => {
    void tick()
  }, intervalMs)
}

async function runQueuedScheduledRefresh(environment: BackendEnvironment): Promise<void> {
  const intervalMs = environment.refreshIntervalMs

  if (intervalMs === undefined) {
    throw new Error('REFRESH_INTERVAL_MS is required for scheduled impact refresh.')
  }

  const queue = createQueueClient({
    driver: environment.queueDriver,
    ...(environment.databaseUrl === undefined ? {} : { databaseUrl: environment.databaseUrl }),
  })

  await queue.work(
    'impact.refresh',
    async (job) => {
      const jobEnvironment = {
        ...environment,
        githubRepository: job.payload.repository,
        analysisWindowDays: job.payload.analysisWindowDays,
      }

      try {
        console.log(JSON.stringify({
          event: 'impact_refresh_started',
          jobId: job.id,
          repository: job.payload.repository,
          analysisWindowDays: job.payload.analysisWindowDays,
          requestedBy: job.payload.requestedBy,
        }))

        const result = await refreshImpactData(jobEnvironment)

        console.log(JSON.stringify({
          event: 'impact_refresh_complete',
          jobId: job.id,
          reportId: result.reportId,
          engineers: result.engineerCount,
          generatedAt: result.generatedAt,
        }))
      } catch (error) {
        console.error(JSON.stringify({
          event: 'impact_refresh_failed',
          jobId: job.id,
          repository: job.payload.repository,
          analysisWindowDays: job.payload.analysisWindowDays,
          requestedBy: job.payload.requestedBy,
          error: serializeError(error),
        }))
        throw error
      }
    },
    { concurrency: 1 },
  )

  async function enqueue(requestedBy: RefreshImpactJobPayload['requestedBy']): Promise<void> {
    try {
      const job = await queue.enqueue(
        'impact.refresh',
        buildRefreshJobPayload(environment, requestedBy),
        buildRefreshQueueOptions(environment),
      )
      console.log(JSON.stringify({
        event: 'impact_refresh_queued',
        jobId: job.id,
        repository: environment.githubRepository,
        analysisWindowDays: environment.analysisWindowDays,
        requestedBy,
      }))
    } catch (error) {
      console.error(JSON.stringify({
        event: 'impact_refresh_enqueue_failed',
        repository: environment.githubRepository,
        analysisWindowDays: environment.analysisWindowDays,
        requestedBy,
        error: serializeError(error),
      }))
    }
  }

  await enqueue('startup')
  setInterval(() => {
    void enqueue('schedule')
  }, intervalMs)

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void queue.close().finally(() => {
        process.exit(0)
      })
    })
  }
}

function buildRefreshJobPayload(
  environment: BackendEnvironment,
  requestedBy: RefreshImpactJobPayload['requestedBy'],
): RefreshImpactJobPayload {
  return {
    repository: environment.githubRepository,
    analysisWindowDays: environment.analysisWindowDays,
    requestedBy,
  }
}

function buildRefreshQueueOptions(environment: BackendEnvironment): QueueEnqueueOptions {
  return {
    dedupeKey: `${environment.githubRepository}:${environment.analysisWindowDays}:latest`,
    retryLimit: environment.refreshRetryLimit,
    retryDelaySeconds: environment.refreshRetryDelaySeconds,
    retryDelayMaxSeconds: environment.refreshRetryDelayMaxSeconds,
    retryBackoff: true,
    expireInSeconds: environment.refreshJobExpireSeconds,
    deadLetterQueue: 'impact.refresh.dlq',
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  if (backendEnvironment.refreshIntervalMs === undefined) {
    const result = await refreshImpactData()
    console.log(
      `Impact refresh complete. reportId=${result.reportId} engineers=${result.engineerCount} generatedAt=${result.generatedAt}`,
    )
  } else if (backendEnvironment.queueDriver === 'pg-boss') {
    await runQueuedScheduledRefresh(backendEnvironment)
  } else {
    await runInlineScheduledRefresh(backendEnvironment)
  }
}
