export type SerializedError = {
  readonly name: string
  readonly message: string
  readonly stack?: string
  readonly cause?: SerializedError
}

type ErrorWithCause = Error & {
  readonly cause?: unknown
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const serialized: {
      name: string
      message: string
      stack?: string
      cause?: SerializedError
    } = {
      name: error.name,
      message: error.message,
    }

    if (error.stack !== undefined) {
      serialized.stack = error.stack
    }

    const cause = (error as ErrorWithCause).cause

    if (cause !== undefined) {
      serialized.cause = serializeError(cause)
    }

    return serialized
  }

  return {
    name: 'NonError',
    message: String(error),
  }
}
