/**
 * Simple structured logger.
 *
 * Log levels: debug, info, warn, error
 * Default level is `info`; set `LOG_LEVEL=debug` for verbose output.
 *
 * Each log line is formatted as:
 *   [timestamp] LEVEL  message  { ...json }
 *
 * When `NODE_ENV=production`, only `info`+ messages are printed.
 */

// ── Level helpers ──────────────────────────────────────────

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_NUM: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const current_level: Level = (() => {
  const env = process.env.LOG_LEVEL?.toLowerCase() as Level | undefined;
  if (env && env in LEVEL_NUM) return env;
  return process.env.NODE_ENV === 'production' ? 'info' : 'info';
})();

function should_log(level: Level): boolean {
  return LEVEL_NUM[level] >= LEVEL_NUM[current_level];
}

function ts(): string {
  return new Date().toISOString();
}

function fmt(level: Level, msg: string, meta?: Record<string, unknown>): string {
  const prefix = `[${ts()}] ${level.toUpperCase().padEnd(5)} ${msg}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${prefix}  ${JSON.stringify(meta)}`;
  }
  return prefix;
}

// ── Public API ──────────────────────────────────────────────

export const logger = {
  debug(msg: string, meta?: Record<string, unknown>): void {
    if (should_log('debug')) console.debug(fmt('debug', msg, meta));
  },

  info(msg: string, meta?: Record<string, unknown>): void {
    if (should_log('info')) console.info(fmt('info', msg, meta));
  },

  warn(msg: string, meta?: Record<string, unknown>): void {
    if (should_log('warn')) console.warn(fmt('warn', msg, meta));
  },

  error(msg: string, meta?: Record<string, unknown>): void {
    // Always print errors regardless of level
    console.error(fmt('error', msg, meta));
  },
};
