import { randomUUID } from 'node:crypto'
import type {
  QueueClient,
  QueueDriver,
  QueueEnqueueOptions,
  QueuedJob,
  QueueJobName,
  QueueJobPayloadMap,
} from './queue.types.js'

export type QueueClientOptions = {
  driver?: QueueDriver
}

export class DurableQueueNotConfiguredError extends Error {
  constructor() {
    super('The pg-boss queue driver is not installed yet. Use the in-memory driver for local tests or add pg-boss before enabling durable refresh jobs.')
    this.name = 'DurableQueueNotConfiguredError'
  }
}

export function createQueueClient(options: QueueClientOptions = {}): QueueClient {
  const driver = options.driver ?? 'in-memory'

  if (driver === 'pg-boss') {
    throw new DurableQueueNotConfiguredError()
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

  async close(): Promise<void> {
    this.#jobs.clear()
    this.#dedupeIndex.clear()
  }
}

function buildQueuedJob<Name extends QueueJobName>(
  name: Name,
  payload: QueueJobPayloadMap[Name],
  options: QueueEnqueueOptions,
): QueuedJob<Name> {
  const job: QueuedJob<Name> = {
    id: randomUUID(),
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
