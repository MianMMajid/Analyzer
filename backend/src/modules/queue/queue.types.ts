export type QueueDriver = 'in-memory' | 'pg-boss'

export type QueueJobName = 'impact.refresh' | 'impact.refresh.dlq'

export type RefreshImpactJobPayload = {
  repository: string
  analysisWindowDays: number
  requestedBy: 'manual' | 'schedule' | 'startup'
}

export type QueueJobPayloadMap = {
  'impact.refresh': RefreshImpactJobPayload
  'impact.refresh.dlq': RefreshImpactJobPayload
}

export type QueueJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export type QueueEnqueueOptions = {
  dedupeKey?: string
  runAt?: Date
  retryLimit?: number
  retryDelaySeconds?: number
  retryDelayMaxSeconds?: number
  retryBackoff?: boolean
  expireInSeconds?: number
  deadLetterQueue?: QueueJobName
}

export type QueueWorkOptions = {
  concurrency?: number
}

export type QueuedJob<Name extends QueueJobName = QueueJobName> = {
  id: string
  name: Name
  payload: QueueJobPayloadMap[Name]
  status: QueueJobStatus
  dedupeKey?: string
  runAt?: Date
  enqueuedAt: Date
}

export type QueueClient = {
  readonly driver: QueueDriver
  readonly isDurable: boolean
  enqueue<Name extends QueueJobName>(
    name: Name,
    payload: QueueJobPayloadMap[Name],
    options?: QueueEnqueueOptions,
  ): Promise<QueuedJob<Name>>
  work<Name extends QueueJobName>(
    name: Name,
    handler: (job: QueuedJob<Name>) => Promise<void>,
    options?: QueueWorkOptions,
  ): Promise<void>
  listQueuedJobs(): Promise<readonly QueuedJob[]>
  close(): Promise<void>
}
