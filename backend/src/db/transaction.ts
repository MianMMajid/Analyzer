export type QueryResult = {
  rows: Record<string, unknown>[]
  rowCount: number | null
}

export type Queryable = {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>
}

export type TransactionClient = Queryable & {
  release(): void
}

export type TransactionPool = {
  connect(): Promise<TransactionClient>
}

export async function withTransaction<Result>(
  pool: TransactionPool,
  operation: (client: TransactionClient) => Promise<Result>,
): Promise<Result> {
  const client = await pool.connect()
  let transactionStarted = false

  try {
    await client.query('begin')
    transactionStarted = true

    const result = await operation(client)

    await client.query('commit')
    transactionStarted = false

    return result
  } catch (error) {
    if (transactionStarted) {
      await rollbackOrThrowAggregate(client, error)
    }

    throw error
  } finally {
    client.release()
  }
}

async function rollbackOrThrowAggregate(client: Queryable, originalError: unknown): Promise<void> {
  try {
    await client.query('rollback')
  } catch (rollbackError) {
    throw new AggregateError([originalError, rollbackError], 'Transaction failed and rollback also failed.')
  }
}
