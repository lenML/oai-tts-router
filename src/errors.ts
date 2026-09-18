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

export function openai_error_from_zod(error: ZodError): OpenAiError {
  const first = error.issues[0];
  const path = first.path.length > 0 ? first.path.join('.') : null;
  return new OpenAiError(first.message, OPENAI_ERROR_TYPE.INVALID_REQUEST, path, null, 400);
}

export interface UpstreamErrorDetails {
  message?: string;
  param: string | null;
  code: string | null;
  raw: string;
}

/** Extract OpenAI-style error metadata from an upstream response body. */
export function upstream_error_details(body: Buffer | Uint8Array): UpstreamErrorDetails {
  const raw = Buffer.from(body).toString('utf-8').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { param: null, code: null, raw: raw.slice(0, 300) };
  }

  const envelope = is_record(parsed) ? parsed : {};
  const error = is_record(envelope['error']) ? envelope['error'] : envelope;
  const message = typeof error['message'] === 'string' ? error['message'].slice(0, 300) : undefined;
  const param = typeof error['param'] === 'string' ? error['param'] : null;
  const raw_code = error['code'];
  const code =
    typeof raw_code === 'string' || typeof raw_code === 'number' ? String(raw_code) : null;

  return { message, param, code, raw: raw.slice(0, 300) };
}

function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  const body_error = err as Error & { type?: string };
  if (body_error.type === 'entity.parse.failed') {
    const parse_error = new OpenAiError(
      'Invalid JSON request body.',
      OPENAI_ERROR_TYPE.INVALID_REQUEST,
      null,
      'invalid_json',
      400,
    );
    logger.warn('request rejected', {
      type: parse_error.type,
      code: parse_error.code,
      status: parse_error.status_code,
    });
    res.status(parse_error.status_code).json(parse_error.to_response());
    return;
  }

  if (body_error.type === 'entity.too.large') {
    const size_error = new OpenAiError(
      'Request body is too large.',
      OPENAI_ERROR_TYPE.INVALID_REQUEST,
      null,
      'request_too_large',
      413,
    );
    logger.warn('request rejected', {
      type: size_error.type,
      code: size_error.code,
      status: size_error.status_code,
    });
    res.status(size_error.status_code).json(size_error.to_response());
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
