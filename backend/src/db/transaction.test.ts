import { describe, expect, it, vi } from 'vitest'
import { withTransaction, type TransactionClient } from './transaction.js'

describe('withTransaction', () => {
  it('commits successful work and releases the client', async () => {
    const client = createTransactionClient()
    const pool = { connect: vi.fn(async () => client) }

    await expect(withTransaction(pool, async () => 42)).resolves.toBe(42)

    expect(client.query).toHaveBeenCalledWith('begin')
    expect(client.query).toHaveBeenCalledWith('commit')
    expect(client.query).not.toHaveBeenCalledWith('rollback')
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('rolls back operation failures and preserves the original error', async () => {
    const client = createTransactionClient()
    const pool = { connect: vi.fn(async () => client) }
    const originalError = new Error('insert failed')

    await expect(withTransaction(pool, async () => {
      throw originalError
    })).rejects.toBe(originalError)

    expect(client.query).toHaveBeenCalledWith('rollback')
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('throws both errors when rollback also fails', async () => {
    const originalError = new Error('insert failed')
    const rollbackError = new Error('rollback failed')
    const client = createTransactionClient(async (sql) => {
      if (sql === 'rollback') {
        throw rollbackError
      }

      return { rowCount: 1, rows: [] }
    })
    const pool = { connect: vi.fn(async () => client) }

    await expect(withTransaction(pool, async () => {
      throw originalError
    })).rejects.toMatchObject({
      name: 'AggregateError',
      message: 'Transaction failed and rollback also failed.',
      errors: [originalError, rollbackError],
    })
    expect(client.release).toHaveBeenCalledTimes(1)
  })
})

function createTransactionClient(
  queryImplementation: (sql: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> = async () => ({
    rowCount: 1,
    rows: [],
  }),
): TransactionClient {
  return {
    query: vi.fn(queryImplementation),
    release: vi.fn(),
  }
}
