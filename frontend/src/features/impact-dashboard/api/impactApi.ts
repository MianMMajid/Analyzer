import { appEnvironment } from '@/config/env.ts'
import { ApiErrorSchema, ImpactDashboardResponseSchema, type ApiError } from '@repo/impact-contract'
import type { ImpactDashboardResponse } from '@/features/impact-dashboard/types.ts'

export class ImpactApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(parameters: { status: number; apiError: ApiError; cause?: unknown }) {
    super(parameters.apiError.error, parameters.cause === undefined ? undefined : { cause: parameters.cause })
    this.name = 'ImpactApiError'
    this.status = parameters.status
    this.code = parameters.apiError.code

    if (parameters.apiError.details !== undefined) {
      this.details = parameters.apiError.details
    }
  }
}

type ResponseBody = {
  readonly data: unknown
  readonly parseError?: unknown
}

// The frontend communicates with the backend over HTTPS JSON in production.
export async function getImpactDashboard(): Promise<ImpactDashboardResponse> {
  let response: Response

  try {
    response = await fetch(`${appEnvironment.apiBaseUrl}/api/v1/impact/summary`)
  } catch (error) {
    throw createImpactApiError(0, 'Impact API network request failed.', 'NETWORK_ERROR', undefined, error)
  }

  const body = await readResponseBody(response)

  if (!response.ok) {
    throw buildHttpError(response.status, body)
  }

  if (body.parseError !== undefined) {
    throw createImpactApiError(
      response.status,
      'Impact API returned invalid JSON.',
      'INVALID_API_RESPONSE',
      undefined,
      body.parseError,
    )
  }

  const parsedDashboard = ImpactDashboardResponseSchema.safeParse(body.data)

  if (!parsedDashboard.success) {
    throw createImpactApiError(
      response.status,
      'Impact API returned an invalid dashboard payload.',
      'INVALID_API_RESPONSE',
      parsedDashboard.error.flatten(),
      parsedDashboard.error,
    )
  }

  return parsedDashboard.data
}

async function readResponseBody(response: Response): Promise<ResponseBody> {
  const text = await response.text()

  if (text.length === 0) {
    return { data: undefined }
  }

  try {
    return { data: JSON.parse(text) as unknown }
  } catch (error) {
    return { data: undefined, parseError: error }
  }
}

function buildHttpError(status: number, body: ResponseBody): ImpactApiError {
  if (body.parseError === undefined) {
    const parsedApiError = ApiErrorSchema.safeParse(body.data)

    if (parsedApiError.success) {
      return new ImpactApiError({ status, apiError: parsedApiError.data })
    }
  }

  return createImpactApiError(status, `Impact API failed with status ${status}.`, 'HTTP_ERROR')
}

function createImpactApiError(
  status: number,
  error: string,
  code: string,
  details?: unknown,
  cause?: unknown,
): ImpactApiError {
  const apiError: ApiError = details === undefined ? { error, code } : { error, code, details }

  return new ImpactApiError({
    status,
    apiError,
    ...(cause === undefined ? {} : { cause }),
  })
}
