import { performance } from 'node:perf_hooks'
import { Pool, type PoolConfig } from 'pg'

export type DatabaseSslMode = 'disable' | 'require'

export type DatabasePoolOptions = {
  databaseUrl: string
  applicationName?: string
  maxConnections?: number
  connectionTimeoutMillis?: number
  idleTimeoutMillis?: number
  ssl?: PoolConfig['ssl']
}

export type DatabasePoolEnvironment = {
  databaseUrl: string
  databaseSslMode: DatabaseSslMode
}

export type DatabaseReadiness = {
  ok: boolean
  latencyMs: number
  checkedAt: string
  error?: string
}

let sharedPool: Pool | undefined

export function createDatabasePool(options: DatabasePoolOptions): Pool {
  return new Pool(toPoolConfig(options))
}

export function getSharedDatabasePool(options: DatabasePoolOptions): Pool {
  sharedPool ??= createDatabasePool(options)
  return sharedPool
}

export function buildDatabasePoolOptions(
  environment: DatabasePoolEnvironment,
  applicationName: string,
): DatabasePoolOptions {
  const ssl = databaseSslForMode(environment.databaseSslMode)
  const options: DatabasePoolOptions = {
    databaseUrl: environment.databaseUrl,
    applicationName,
  }

  if (ssl !== undefined) {
    options.ssl = ssl
  }

  return options
}

export async function closeSharedDatabasePool(): Promise<void> {
  if (sharedPool === undefined) {
    return
  }

  const pool = sharedPool
  sharedPool = undefined
  await pool.end()
}

export async function checkDatabaseReadiness(pool: Pick<Pool, 'query'>): Promise<DatabaseReadiness> {
  const startedAt = performance.now()

  try {
    await pool.query('select 1 as ready')
    return {
      ok: true,
      latencyMs: elapsedMs(startedAt),
      checkedAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      ok: false,
      latencyMs: elapsedMs(startedAt),
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown database readiness error.',
    }
  }
}

export function toPoolConfig(options: DatabasePoolOptions): PoolConfig {
  const config: PoolConfig = {
    connectionString: options.databaseUrl,
    max: options.maxConnections ?? 10,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5_000,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
  }

  if (options.applicationName !== undefined) {
    config.application_name = options.applicationName
  }

  if (options.ssl !== undefined) {
    config.ssl = options.ssl
  }

  return config
}

export function databaseSslForMode(mode: DatabaseSslMode): PoolConfig['ssl'] | undefined {
  if (mode === 'require') {
    return { rejectUnauthorized: false }
  }

  return undefined
}

function elapsedMs(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100
}
