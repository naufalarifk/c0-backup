// @ts-check

export function unknownErrorToPlain(error: unknown): unknown {
  if (error instanceof Error) {
    return errorToPlain(error);
  }
  if (typeof error === 'string') {
    return {
      message: error,
    };
  }
  if (typeof error === 'object' && error !== null) {
    return error;
  }
  if (typeof error === 'undefined') {
    return undefined;
  }
  return {
    message: `Unhandled Type Error: ${error}`,
  };
}

export function unknownErrorToString(error: unknown): string {
  return JSON.stringify(unknownErrorToPlain(error), null, 2);
}

function errorToPlain(error: Error): unknown {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause instanceof Error ? unknownErrorToPlain(error.cause) : error.cause,
  };
}
