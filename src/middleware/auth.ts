/**
 * API key authentication and playground basic auth middleware.
 *
 * Auth modes:
 *  - API_KEY not set / empty → no auth (all requests pass through)
 *  - API_KEY set → validate `Authorization: Bearer <key>` on API routes
 *                  and `Authorization: Basic <base64>` on playground
 *
 * Multiple keys: separate with commas in the API_KEY env var.
 */

import type { Request, Response, NextFunction } from 'express';
import { OpenAiError } from '../errors.js';
import { logger } from '../utils/logger.js';

// ── Shared state ───────────────────────────────────────────

let valid_keys: string[] | null = null;

// ── Initialization ──────────────────────────────────────────

/** Initialize auth state from the API_KEY env value. */
export function init_auth(api_key_spec: string | undefined): void {
  if (!api_key_spec || api_key_spec.trim() === '') {
    logger.info('auth disabled — no API_KEY set');
    valid_keys = null;
    return;
  }
  const keys = api_key_spec
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);
  valid_keys = keys.length > 0 ? keys : null;
  logger.info('auth enabled', { key_count: valid_keys?.length ?? 0 });
}

// ── Bearer token middleware (API routes) ─────────────────────

/** Express middleware: validates Bearer token against configured API keys. */
export function bearer_auth(req: Request, _res: Response, next: NextFunction): void {
  if (valid_keys === null) {
    return next();
  }

  const auth_header = req.headers.authorization;
  if (!auth_header) {
    return next(
      new OpenAiError(
        'No API key provided. Set the Authorization header.',
        'authentication_error',
        null,
        null,
        401,
      ),
    );
  }

  const match = auth_header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return next(
      new OpenAiError(
        'Invalid Authorization header format. Use: Bearer <key>',
        'authentication_error',
        null,
        null,
        401,
      ),
    );
  }

  if (!valid_keys.includes(match[1])) {
    return next(new OpenAiError('Invalid API key.', 'authentication_error', null, null, 401));
  }

  next();
}

// ── Basic auth middleware (playground) ───────────────────────

/** Express middleware: validates Basic auth password against configured API keys. */
export function basic_auth(req: Request, res: Response, next: NextFunction): void {
  if (valid_keys === null) return next();

  const auth_header = req.headers.authorization;
  if (!auth_header || !auth_header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="TTS Playground", charset="UTF-8"');
    res.status(401).send('Authentication required');
    return;
  }

  // Decode base64 credentials
  const base64 = auth_header.slice(6);
  let decoded: string;
  try {
    decoded = Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    res.setHeader('WWW-Authenticate', 'Basic realm="TTS Playground", charset="UTF-8"');
    res.status(401).send('Invalid credentials');
    return;
  }

  const colon_idx = decoded.indexOf(':');
  if (colon_idx === -1) {
    res.setHeader('WWW-Authenticate', 'Basic realm="TTS Playground", charset="UTF-8"');
    res.status(401).send('Invalid credentials');
    return;
  }

  // Username is ignored; only the password (API key) is checked
  const password = decoded.slice(colon_idx + 1);
  if (!valid_keys.includes(password)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="TTS Playground", charset="UTF-8"');
    res.status(401).send('Invalid credentials');
    return;
  }

  next();
}
