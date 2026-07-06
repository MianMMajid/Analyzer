import { z } from 'zod'

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
    GITHUB_REPOSITORY: z.string().min(1).default('PostHog/posthog'),
    ANALYSIS_WINDOW_DAYS: z.coerce.number().int().positive().default(90),
    API_AVERAGE_LATENCY_TARGET_MS: z.coerce.number().int().positive().default(150),
    REFRESH_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    QUEUE_DRIVER: z.enum(['in-memory', 'pg-boss']).default('in-memory'),
    REFRESH_RETRY_LIMIT: z.coerce.number().int().nonnegative().default(6),
    REFRESH_RETRY_DELAY_SECONDS: z.coerce.number().int().positive().default(60),
    REFRESH_RETRY_DELAY_MAX_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_JOB_EXPIRE_SECONDS: z.coerce.number().int().positive().default(3600),
    GITHUB_TOKEN: z.string().min(1).optional(),
    DATABASE_URL: z.string().min(1).optional(),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV !== 'production') {
      return
    }

    if (environment.GITHUB_TOKEN === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'GITHUB_TOKEN is required in production.',
        path: ['GITHUB_TOKEN'],
      })
    }

    if (environment.DATABASE_URL === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'DATABASE_URL is required in production.',
        path: ['DATABASE_URL'],
      })
    }
  })

export type BackendEnvironment = {
  nodeEnv: 'development' | 'test' | 'production'
  port: number
  webOrigin: string
  githubRepository: string
  analysisWindowDays: number
  apiAverageLatencyTargetMs: number
  refreshIntervalMs?: number
  queueDriver: 'in-memory' | 'pg-boss'
  refreshRetryLimit: number
  refreshRetryDelaySeconds: number
  refreshRetryDelayMaxSeconds: number
  refreshJobExpireSeconds: number
  githubToken?: string
  databaseUrl?: string
  isProduction: boolean
}

// Environment parsing is centralized so Railway configuration fails before the server accepts traffic.
export function parseBackendEnvironment(
  source: NodeJS.ProcessEnv,
): BackendEnvironment {
  const parsed = EnvironmentSchema.parse(source)
  const environment: BackendEnvironment = {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    webOrigin: parsed.WEB_ORIGIN,
    githubRepository: parsed.GITHUB_REPOSITORY,
    analysisWindowDays: parsed.ANALYSIS_WINDOW_DAYS,
    apiAverageLatencyTargetMs: parsed.API_AVERAGE_LATENCY_TARGET_MS,
    queueDriver: parsed.QUEUE_DRIVER,
    refreshRetryLimit: parsed.REFRESH_RETRY_LIMIT,
    refreshRetryDelaySeconds: parsed.REFRESH_RETRY_DELAY_SECONDS,
    refreshRetryDelayMaxSeconds: parsed.REFRESH_RETRY_DELAY_MAX_SECONDS,
    refreshJobExpireSeconds: parsed.REFRESH_JOB_EXPIRE_SECONDS,
    isProduction: parsed.NODE_ENV === 'production',
  }

  if (parsed.REFRESH_INTERVAL_MS !== undefined) {
    environment.refreshIntervalMs = parsed.REFRESH_INTERVAL_MS
  }

  if (parsed.GITHUB_TOKEN !== undefined) {
    environment.githubToken = parsed.GITHUB_TOKEN
  }

  if (parsed.DATABASE_URL !== undefined) {
    environment.databaseUrl = parsed.DATABASE_URL
  }

  return environment
}

export const backendEnvironment = parseBackendEnvironment(process.env)
