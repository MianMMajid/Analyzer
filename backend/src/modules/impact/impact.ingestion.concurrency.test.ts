import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from './impact.ingestion.concurrency.js'

describe('mapWithConcurrency', () => {
  it('preserves result order while limiting active work', async () => {
    let active = 0
    let maxActive = 0

    const result = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, value === 1 ? 4 : 1))
      active -= 1

      return value * 10
    })

    expect(result).toEqual([10, 20, 30, 40])
    expect(maxActive).toBeLessThanOrEqual(2)
  })

  it('returns immediately for empty input', async () => {
    await expect(mapWithConcurrency([], 3, async () => 'unused')).resolves.toEqual([])
  })
})
