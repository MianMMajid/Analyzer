import { describe, expect, it } from 'vitest'
import { createQueueClient, DurableQueueConnectionError } from './queue.client.js'

const refreshPayload = {
  repository: 'PostHog/posthog',
  analysisWindowDays: 90,
  requestedBy: 'manual',
} as const

describe('queue client', () => {
  it('enqueues typed refresh jobs in local memory', async () => {
    const queue = createQueueClient({ driver: 'in-memory' })
    const job = await queue.enqueue('impact.refresh', refreshPayload)

    expect(job).toMatchObject({
      name: 'impact.refresh',
      payload: refreshPayload,
      status: 'queued',
    })
    await expect(queue.listQueuedJobs()).resolves.toHaveLength(1)
  })

  it('deduplicates queued jobs by explicit key', async () => {
    const queue = createQueueClient()

    const firstJob = await queue.enqueue('impact.refresh', refreshPayload, {
      dedupeKey: 'PostHog/posthog:90',
    })
    const secondJob = await queue.enqueue('impact.refresh', refreshPayload, {
      dedupeKey: 'PostHog/posthog:90',
    })

    expect(secondJob.id).toBe(firstJob.id)
    await expect(queue.listQueuedJobs()).resolves.toHaveLength(1)
  })

  it('runs queued jobs with the in-memory worker', async () => {
    const queue = createQueueClient()
    await queue.enqueue('impact.refresh', refreshPayload)

    const processed: string[] = []
    await queue.work('impact.refresh', async (job) => {
      processed.push(job.id)
    })

    expect(processed).toHaveLength(1)
    await expect(queue.listQueuedJobs()).resolves.toMatchObject([{ status: 'completed' }])
  })

  it('fails explicitly when the durable driver has no database URL', () => {
    expect(() => createQueueClient({ driver: 'pg-boss' })).toThrow(DurableQueueConnectionError)
  })
})
