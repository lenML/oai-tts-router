/**
 * Request logging middleware.
 *
 * Logs method, path, status code, duration, and content-length
 * for every request that passes through.
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function request_logger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration_ms = Date.now() - start;
    const status = res.statusCode;

    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    logger[level]('request', {
      method: req.method,
      path: req.path,
      status,
      duration_ms,
      content_length: res.getHeader('content-length') ?? undefined,
    });
  });

  next();
}
