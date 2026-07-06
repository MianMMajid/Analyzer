import type { KnownContributor } from './contributors.types.js'

export interface ContributorsRepository {
  findById(id: string): Promise<KnownContributor | null>
  findAll(): Promise<readonly KnownContributor[]>
  upsert(contributor: KnownContributor): Promise<void>
}

export class InMemoryContributorsRepository implements ContributorsRepository {
  readonly #contributors = new Map<string, KnownContributor>()

  constructor(seed: readonly KnownContributor[] = []) {
    for (const contributor of seed) {
      this.#contributors.set(contributor.id, contributor)
    }
  }

  async findById(id: string): Promise<KnownContributor | null> {
    return this.#contributors.get(id) ?? null
  }

  async findAll(): Promise<readonly KnownContributor[]> {
    return [...this.#contributors.values()].sort((left, right) => left.id.localeCompare(right.id))
  }

  async upsert(contributor: KnownContributor): Promise<void> {
    this.#contributors.set(contributor.id, contributor)
  }
}
