import { randomUUID } from 'node:crypto'
import { PgBoss } from 'pg-boss'
import type { SendOptions } from 'pg-boss'
import { databaseSslForMode, type DatabaseSslMode } from '../../db/client.js'
import type {
  QueueClient,
  QueueDriver,
  QueueEnqueueOptions,
  QueueWorkOptions,
  QueuedJob,
  QueueJobName,
  QueueJobPayloadMap,
} from './queue.types.js'

export type QueueClientOptions = {
  driver?: QueueDriver
  databaseUrl?: string
  databaseSslMode?: DatabaseSslMode
  logger?: Pick<Console, 'error' | 'warn'>
}

export class DurableQueueConnectionError extends Error {
  constructor() {
    super('DATABASE_URL is required when QUEUE_DRIVER=pg-boss.')
    this.name = 'DurableQueueConnectionError'
  }
}

export function createQueueClient(options: QueueClientOptions = {}): QueueClient {
  const driver = options.driver ?? 'in-memory'

  if (driver === 'pg-boss') {
    if (options.databaseUrl === undefined) {
      throw new DurableQueueConnectionError()
    }

    return new PgBossQueueClient(options.databaseUrl, options.databaseSslMode ?? 'disable', options.logger ?? console)
  }

  return new InMemoryQueueClient()
}

export class InMemoryQueueClient implements QueueClient {
  readonly driver = 'in-memory'
  readonly isDurable = false

  readonly #jobs = new Map<string, QueuedJob>()
  readonly #dedupeIndex = new Map<string, string>()

  async enqueue<Name extends QueueJobName>(
    name: Name,
    payload: QueueJobPayloadMap[Name],
    options: QueueEnqueueOptions = {},
  ): Promise<QueuedJob<Name>> {
    if (options.dedupeKey !== undefined) {
      const existingId = this.#dedupeIndex.get(options.dedupeKey)
      const existingJob = existingId === undefined ? undefined : this.#jobs.get(existingId)

      if (existingJob !== undefined) {
        return existingJob as QueuedJob<Name>
      }
    }

    const job = buildQueuedJob(name, payload, options)
    this.#jobs.set(job.id, job)

    if (job.dedupeKey !== undefined) {
      this.#dedupeIndex.set(job.dedupeKey, job.id)
    }

    return job
  }

  async listQueuedJobs(): Promise<readonly QueuedJob[]> {
    return [...this.#jobs.values()]
  }

  async work<Name extends QueueJobName>(
    name: Name,
    handler: (job: QueuedJob<Name>) => Promise<void>,
    options: QueueWorkOptions = {},
  ): Promise<void> {
    const concurrency = options.concurrency ?? 1
    const drains: Array<Promise<void>> = []

    for (let workerIndex = 0; workerIndex < concurrency; workerIndex += 1) {
      drains.push(this.#drain(name, handler))
    }

    await Promise.all(drains)
  }

  async close(): Promise<void> {
    this.#jobs.clear()
    this.#dedupeIndex.clear()
  }

  async #drain<Name extends QueueJobName>(name: Name, handler: (job: QueuedJob<Name>) => Promise<void>): Promise<void> {
    const jobs = [...this.#jobs.values()]
      .filter((job): job is QueuedJob<Name> => job.name === name && job.status === 'queued')
      .filter((job) => job.runAt === undefined || job.runAt.getTime() <= Date.now())

    for (const job of jobs) {
      job.status = 'running'
      try {
        await handler(job)
        job.status = 'completed'
      } catch (error) {
        job.status = 'failed'
        throw error
      }
    }
  }
}

export class PgBossQueueClient implements QueueClient {
  readonly driver = 'pg-boss'
  readonly isDurable = true

  readonly #boss: PgBoss
  readonly #logger: Pick<Console, 'error' | 'warn'>
  #started: Promise<void> | undefined

  constructor(
    databaseUrl: string,
    databaseSslMode: DatabaseSslMode = 'disable',
    logger: Pick<Console, 'error' | 'warn'> = console,
  ) {
    const ssl = databaseSslForMode(databaseSslMode)
    this.#boss = new PgBoss({
      connectionString: databaseUrl,
      ...(ssl === undefined ? {} : { ssl }),
    })
    this.#logger = logger
    this.#boss.on('error', (error) => {
      this.#logger.error(
        JSON.stringify({
          event: 'queue_error',
          driver: this.driver,
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    })
    this.#boss.on('warning', (warning) => {
      this.#logger.warn(
        JSON.stringify({
          event: 'queue_warning',
          driver: this.driver,
          warning,
        }),
      )
    })
  }

  async enqueue<Name extends QueueJobName>(
    name: Name,
    payload: QueueJobPayloadMap[Name],
    options: QueueEnqueueOptions = {},
  ): Promise<QueuedJob<Name>> {
    await this.#ensureStarted()
    const id = await this.#boss.send(name, payload, toPgBossSendOptions(options))

    if (id === null) {
      throw new Error(`pg-boss did not return a job id for ${name}.`)
    }

    return buildQueuedJob(name, payload, {
      ...options,
      id,
    })
  }

  async work<Name extends QueueJobName>(
    name: Name,
    handler: (job: QueuedJob<Name>) => Promise<void>,
    options: QueueWorkOptions = {},
  ): Promise<void> {
    await this.#ensureStarted()
    await this.#boss.work<QueueJobPayloadMap[Name]>(
      name,
      {
        batchSize: 1,
        localConcurrency: options.concurrency ?? 1,
        pollingIntervalSeconds: 1,
      },
      async ([job]) => {
        if (job === undefined) {
          return
        }

        await handler({
          id: job.id,
          name,
          payload: job.data,
          status: 'running',
          enqueuedAt: new Date(),
        })
      },
    )
  }

  async listQueuedJobs(): Promise<readonly QueuedJob[]> {
    await this.#ensureStarted()
    const jobs = await this.#boss.findJobs<QueueJobPayloadMap[QueueJobName]>('impact.refresh', {
      queued: true,
    })

    return jobs.map((job) => ({
      id: job.id,
      name: job.name as QueueJobName,
      payload: job.data,
      status: job.state === 'active' ? 'running' : job.state === 'failed' ? 'failed' : 'queued',
      enqueuedAt: job.createdOn,
    }))
  }

  async close(): Promise<void> {
    if (this.#started !== undefined) {
      await this.#boss.stop({ graceful: true, close: true })
    }
  }

  async #ensureStarted(): Promise<void> {
    this.#started ??= this.#start()
    await this.#started
  }

  async #start(): Promise<void> {
    await this.#boss.start()
    await this.#boss.createQueue('impact.refresh.dlq', {
      policy: 'standard',
      retentionSeconds: 1_209_600,
      deleteAfterSeconds: 604_800,
    })
    await this.#boss.createQueue('impact.refresh', {
      policy: 'singleton',
      retryLimit: 6,
      retryDelay: 60,
      retryBackoff: true,
      retryDelayMax: 900,
      expireInSeconds: 3_600,
      retentionSeconds: 1_209_600,
      deleteAfterSeconds: 604_800,
      deadLetter: 'impact.refresh.dlq',
    })
  }
}

function buildQueuedJob<Name extends QueueJobName>(
  name: Name,
  payload: QueueJobPayloadMap[Name],
  options: QueueEnqueueOptions & { id?: string },
): QueuedJob<Name> {
  const job: QueuedJob<Name> = {
    id: options.id ?? randomUUID(),
    name,
    payload,
    status: 'queued',
    enqueuedAt: new Date(),
  }

  if (options.dedupeKey !== undefined) {
    job.dedupeKey = options.dedupeKey
  }

  if (options.runAt !== undefined) {
    job.runAt = options.runAt
  }

  return job
}

function toPgBossSendOptions(options: QueueEnqueueOptions): SendOptions {
  const sendOptions: SendOptions = {}

  if (options.runAt !== undefined) {
    sendOptions.startAfter = options.runAt
  }

  if (options.dedupeKey !== undefined) {
    sendOptions.singletonKey = options.dedupeKey
    sendOptions.singletonSeconds = 60
  }

  if (options.retryLimit !== undefined) {
    sendOptions.retryLimit = options.retryLimit
  }

  if (options.retryDelaySeconds !== undefined) {
    sendOptions.retryDelay = options.retryDelaySeconds
  }

  if (options.retryDelayMaxSeconds !== undefined) {
    sendOptions.retryDelayMax = options.retryDelayMaxSeconds
  }

  if (options.retryBackoff !== undefined) {
    sendOptions.retryBackoff = options.retryBackoff
  }

  if (options.expireInSeconds !== undefined) {
    sendOptions.expireInSeconds = options.expireInSeconds
  }

  if (options.deadLetterQueue !== undefined) {
    sendOptions.deadLetter = options.deadLetterQueue
  }

  return sendOptions
}
