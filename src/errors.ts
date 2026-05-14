/**
 * OpenAI-compatible error handling.
 * Defines normalized error types and Express error middleware.
 */

import type { Request, Response, NextFunction } from 'express';
import type { OpenAiErrorBody } from './types/openai.js';
import { OPENAI_ERROR_TYPE } from './types/openai.js';
import type { ZodError } from 'zod';
import { logger } from './utils/logger.js';

/** Custom OpenAI-compatible error */
export class OpenAiError extends Error {
  constructor(
    message: string,
    public readonly type: string,
    public readonly param: string | null = null,
    public readonly code: string | null = null,
    public readonly status_code = 400,
  ) {
    super(message);
    this.name = 'OpenAiError';
  }

  /** Convert to OpenAI standard error response body */
  to_response(): OpenAiErrorBody {
    return {
      error: {
        message: this.message,
        type: this.type,
        param: this.param,
        code: this.code,
      },
    };
  }
}

/** Convert a ZodError to an OpenAiError (first issue only). */
export function openai_error_from_zod(error: ZodError): OpenAiError {
  const first = error.issues[0];
  const path = first.path.length > 0 ? first.path.join('.') : null;
  return new OpenAiError(first.message, OPENAI_ERROR_TYPE.INVALID_REQUEST, path, null, 400);
}

/** Express error handling middleware */
export function error_handler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof OpenAiError) {
    logger.warn('request rejected', {
      type: err.type,
      code: err.code,
      param: err.param,
      status: err.status_code,
      message: err.message,
    });
    res.status(err.status_code).json(err.to_response());
    return;
  }

  // Fallback for unexpected errors
  logger.error('unhandled error', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  const fallback = new OpenAiError(
    'An unexpected error occurred.',
    'server_error',
    null,
    null,
    500,
  );
  res.status(500).json(fallback.to_response());
}
