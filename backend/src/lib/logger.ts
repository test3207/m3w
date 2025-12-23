/**
 * Backend Logger using Pino
 *
 * Provides structured logging with traceId support for Loki/Grafana.
 *
 * Usage:
 *   // In route handlers (with request context)
 *   const log = createLogger(c);
 *   log.info('auth.login', 'auth', 'login', userId, { email }, 'User logged in');
 *
 *   // Global logging (startup, shutdown, etc.)
 *   logger.info({ ... }, 'message');
 */

import pino, { Logger } from 'pino';
import type { Context } from 'hono';

// Service name constant
const SERVICE_NAME = 'm3w-backend';

// Region from environment (jp, sea, etc.)
const REGION = process.env.REGION || 'unknown';

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
  warn(params: LogParams): void;
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
  const traceId = c?.get('traceId') as string | undefined;
  const gateway = c?.get('gateway') as string | undefined;
  const userId = c?.get('userId') as string | undefined;

  // Build base context for all logs in this request
  const baseContext = {
    ...(traceId && { traceId }),
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

    // Add error fields for error level
    if (level === 'error' && 'error' in params) {
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
    warn: (params: LogParams) => emitLog('warn', params),
    error: (params: ErrorLogParams) => emitLog('error', params),
    debug: (params: LogParams) => emitLog('debug', params),
  };
}

/**
 * Simple logging functions for backward compatibility
 * Use createLogger(c) in route handlers for full tracing support
 */
export const log = {
  info: (message: string, data?: Record<string, unknown>) => {
    logger.info(data || {}, message);
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    logger.warn(data || {}, message);
  },
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
    const logData: Record<string, unknown> = { ...data };
    if (error instanceof Error) {
      logData.error = error.message;
      logData.errorStack = error.stack;
    } else if (error) {
      logData.error = String(error);
    }
    logger.error(logData, message);
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    logger.debug(data || {}, message);
  },
};
