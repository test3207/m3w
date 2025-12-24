/**
 * Trace Middleware
 *
 * Extracts or generates traceId for request tracing.
 * - Reads X-Trace-Id from gateway (if present)
 * - Generates new UUID if not present
 * - Sets traceId in context and response header
 */

import { Context, Next } from 'hono';
import { randomUUID } from 'crypto';

/**
 * Extend Hono's ContextVariableMap to include trace variables
 */
declare module 'hono' {
  interface ContextVariableMap {
    traceId: string;
    gateway?: string;
  }
}

/**
 * Middleware that handles request tracing
 */
export function traceMiddleware() {
  return async (c: Context, next: Next) => {
    // Get traceId from frontend/gateway or generate new one
    const traceId = c.req.header('x-trace-id') || randomUUID();

    // Get gateway identifier (which gateway handled this request)
    const gateway = c.req.header('x-gateway');

    // Store in context for use by logger
    c.set('traceId', traceId);
    if (gateway) {
      c.set('gateway', gateway);
    }

    await next();
  };
}
