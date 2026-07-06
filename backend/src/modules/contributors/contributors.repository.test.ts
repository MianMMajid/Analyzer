import { describe, expect, it } from 'vitest'
import { InMemoryContributorsRepository } from './contributors.repository.js'

describe('InMemoryContributorsRepository', () => {
  it('stores and returns contributors in deterministic order', async () => {
    const repository = new InMemoryContributorsRepository()

    await repository.upsert({ id: 'engineer:z', displayName: 'Zed', aliases: [] })
    await repository.upsert({ id: 'engineer:a', displayName: 'Ada', aliases: [] })

    await expect(repository.findById('engineer:a')).resolves.toMatchObject({ displayName: 'Ada' })
    await expect(repository.findAll()).resolves.toEqual([
      { id: 'engineer:a', displayName: 'Ada', aliases: [] },
      { id: 'engineer:z', displayName: 'Zed', aliases: [] },
    ])
  })
})
