import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ApiErrorSchema } from '@repo/impact-contract'

type HttpError = Error & {
  statusCode?: number
}

function statusCodeFor(error: HttpError): number {
  return error.statusCode ?? 500
}

function codeFor(statusCode: number): string {
  if (statusCode === 404) {
    return 'NOT_FOUND'
  }

  if (statusCode >= 400 && statusCode < 500) {
    return 'CLIENT_ERROR'
  }

  return 'INTERNAL_SERVER_ERROR'
}

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  error: string,
  code: string,
  details?: unknown,
): void {
  reply.status(statusCode).send(ApiErrorSchema.parse({ error, code, details }))
}

// A single error handler prevents stack traces from leaking in production responses.
export async function registerErrorHandling(server: FastifyInstance): Promise<void> {
  server.setNotFoundHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
    sendApiError(reply, 404, 'Route not found.', 'NOT_FOUND')
  })

  server.setErrorHandler((error: HttpError, _request, reply) => {
    const statusCode = statusCodeFor(error)

    sendApiError(reply, statusCode, statusCode >= 500 ? 'Internal server error.' : error.message, codeFor(statusCode))
  })
}
