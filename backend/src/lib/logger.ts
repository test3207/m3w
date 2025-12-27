/**
 * Backend Logger using Pino
 *
 * Provides structured logging with traceId support for Loki/Grafana.
 *
 * Usage:
 *   // In route handlers (with request context)
 *   const log = createLogger(c);
 *   log.info({
 *     source: 'songs.search',
 *     col1: 'song',
 *     col2: 'search',
 *     col3: songId,
 *     raw: { query },
 *     message: 'Song search completed'
 *   });
 *
 *   // System logging (startup, shutdown, etc.) - no Context needed
 *   const log = createLogger();
 *   log.info({
 *     source: 'index.startup',
 *     col1: 'system',
 *     col2: 'startup',
 *     message: 'Server started'
 *   });
 */

import pino, { Logger } from 'pino';
import crypto from 'crypto';
import type { Context } from 'hono';

/**
 * Generate a unique trace ID for logging correlation
 * Used when no request context is available (system logs, startup, etc.)
 */
export function generateTraceId(): string {
  return crypto.randomUUID();
}

// Service name constant
const SERVICE_NAME = 'm3w-backend';

// Region from environment (jp, sea, etc.) - use HOME_REGION for SSOT consistency
const REGION = process.env.HOME_REGION || 'default';

// Remote logging flag (for future structured log forwarding)
// Currently all logs go to stdout; this flag reserved for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ENABLE_REMOTE_LOGGING = process.env.ENABLE_REMOTE_LOGGING === 'true';

/**
 * Base Pino logger instance
 * Used for global logging (startup, shutdown, system events)
 */
export const logger: Logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // In production, output JSON directly (for Loki/Alloy)
  // In development, use pino-pretty for human-readable output
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
            // Fix character encoding for Windows PowerShell
            messageFormat: '{msg}',
            customColors: 'info:blue,warn:yellow,error:red',
          },
        }
      : undefined,
  // Add base fields for all logs
  base: {
    service: SERVICE_NAME,
    region: REGION,
  },
});

/**
 * Structured log input parameters
 */
export interface LogParams {
  /** Source location: 'filename.functionName' */
  source: string;
  /** Business category (e.g., 'auth', 'upload', 'playlist') */
  col1: string;
  /** Sub-category (e.g., 'login', 'delete', 'create') */
  col2: string;
  /** Business ID (e.g., userId, songId) */
  col3?: string;
  /** Arbitrary raw data for debugging */
  raw?: Record<string, unknown>;
  /** Human-readable message */
  message: string;
}

/**
 * Error log input parameters (extends LogParams with error info)
 */
export interface ErrorLogParams extends LogParams {
  /** Error object */
  error: Error | unknown;
}

/**
 * Request-scoped logger interface
 */
export interface RequestLogger {
  info(params: LogParams): void;
  warn(params: LogParams | ErrorLogParams): void;
  error(params: ErrorLogParams): void;
  debug(params: LogParams): void;
}

/**
 * Create a request-scoped logger with traceId and user context
 *
 * @param c - Hono Context (optional, for extracting traceId and userId)
 * @returns RequestLogger with structured logging methods
 *
 * @example
 * ```typescript
 * const log = createLogger(c);
 * log.info({
 *   source: 'auth.handleOAuthCallback',
 *   col1: 'auth',
 *   col2: 'login',
 *   col3: user.id,
 *   raw: { isNewUser, provider: 'github' },
 *   message: 'User logged in successfully'
 * });
 * ```
 */
export function createLogger(c?: Context): RequestLogger {
  // Extract context from Hono Context if available
  // If no Context, generate a new traceId for correlation
  const traceId = (c?.get('traceId') as string | undefined) || generateTraceId();
  const gateway = c?.get('gateway') as string | undefined;
  const userId = c?.get('userId') as string | undefined;

  // Build base context for all logs in this request
  const baseContext = {
    traceId, // Always present (from Context or generated)
    ...(gateway && { gateway }),
    ...(userId && { userId }),
  };

  /**
   * Internal function to format and emit log
   */
  const emitLog = (
    level: 'info' | 'warn' | 'error' | 'debug',
    params: LogParams | ErrorLogParams
  ) => {
    const { source, col1, col2, col3, raw, message } = params;

    // Build log object
    const logObj: Record<string, unknown> = {
      ...baseContext,
      source,
      col1,
      col2,
      ...(col3 && { col3 }),
      ...(raw && { raw }),
    };

    // Add error fields for error/warn level
    if ((level === 'error' || level === 'warn') && 'error' in params) {
      const err = params.error;
      if (err instanceof Error) {
        logObj.error = err.message;
        logObj.errorStack = err.stack;
      } else {
        logObj.error = String(err);
      }
    }

    // Emit log using base logger
    logger[level](logObj, message);
  };

  return {
    info: (params: LogParams) => emitLog('info', params),
    warn: (params: LogParams | ErrorLogParams) => emitLog('warn', params),
    error: (params: ErrorLogParams) => emitLog('error', params),
    debug: (params: LogParams) => emitLog('debug', params),
  };
}
