/**
 * HTTP Request Logger Middleware
 *
 * Provides structured JSON logging for HTTP requests using Pino.
 * Replaces Hono's default text logger for production compatibility.
 *
 * Output format:
 *   {"level":"info","time":1735368000,"service":"m3w-backend","region":"jp",
 *    "source":"http.request","col1":"http","col2":"GET","method":"GET",
 *    "path":"/api/health","status":200,"duration":12,"msg":"GET /api/health 200 12ms"}
 */

import type { Context, Next } from 'hono';
import { logger } from './logger';

/**
 * HTTP logger middleware using Pino
 *
 * Logs incoming requests and outgoing responses with:
 * - Method, path, status code
 * - Response duration in milliseconds
 * - Structured fields for Loki/Grafana filtering
 *
 * @returns Hono middleware function
 */
export function httpLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;

    // Get traceId from context (set by traceMiddleware)
    const traceId = c.get('traceId') as string | undefined;

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    // Build log entry with structured fields
    const logEntry = {
      source: 'http.request',
      col1: 'http',
      col2: method,
      method,
      path,
      status,
      duration,
      ...(traceId && { traceId }),
    };

    // Log at appropriate level based on status code
    const message = `${method} ${path} ${status} ${duration}ms`;

    if (status >= 500) {
      logger.error(logEntry, message);
    } else if (status >= 400) {
      logger.warn(logEntry, message);
    } else {
      logger.info(logEntry, message);
    }
  };
}
