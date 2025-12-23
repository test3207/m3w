/**
 * Logs Route
 *
 * Receives logs from frontend and outputs to stdout for collection by Alloy.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { logger } from '../lib/logger';

const app = new Hono();

/**
 * Schema for a single frontend log entry
 */
const FrontendLogSchema = z.object({
  // Required fields
  level: z.enum(['error', 'warn', 'info']).default('info'),
  source: z.string().min(1).max(200),
  col1: z.string().min(1).max(50),
  col2: z.string().min(1).max(50),
  message: z.string().min(1).max(1000),

  // Optional fields
  col3: z.string().max(200).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(2000).optional(),
  errorStack: z.string().max(5000).optional(),

  // Context fields (auto-injected by frontend)
  timestamp: z.string().optional(),
  sessionId: z.string().max(50).optional(),
  page: z.string().max(500).optional(),
  traceId: z.string().max(100).optional(),
  userId: z.string().max(100).optional(),
  
  // Client context (collected by frontend)
  language: z.string().max(20).optional(),
  timezone: z.string().max(100).optional(),
  screen: z.string().max(50).optional(),
  pixelRatio: z.number().optional(),
  networkType: z.string().max(20).optional(),
  isOnline: z.boolean().optional(),
  referrer: z.string().max(500).optional(),
});

/**
 * Schema for batch log submission
 */
const LogBatchSchema = z.array(FrontendLogSchema).min(1).max(100);

/**
 * POST /api/logs
 *
 * Receives logs from frontend and outputs to stdout.
 * Alloy collects these logs and sends to Loki.
 */
app.post('/', zValidator('json', LogBatchSchema), async (c) => {
  const logs = c.req.valid('json');

  // Get traceId from this request (for correlation)
  const requestTraceId = c.get('traceId') as string | undefined;
  
  // Extract IP and UA from headers (backend context)
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0].trim() 
    || c.req.header('x-real-ip') 
    || 'unknown';
  const userAgent = c.req.header('user-agent') || 'unknown';

  for (const log of logs) {
    const {
      level,
      source,
      col1,
      col2,
      col3,
      message,
      raw,
      error,
      errorStack,
      timestamp,
      sessionId,
      page,
      traceId,
      userId,
      // Client context
      language,
      timezone,
      screen,
      pixelRatio,
      networkType,
      isOnline,
      referrer,
    } = log;

    // Build log object
    const logObj: Record<string, unknown> = {
      service: 'm3w-frontend', // Override to ensure correct service
      source,
      col1,
      col2,
      ...(col3 && { col3 }),
      ...(raw && { raw }),
      ...(error && { error }),
      ...(errorStack && { errorStack }),
      // Context fields
      ...(timestamp && { clientTimestamp: timestamp }),
      ...(sessionId && { sessionId }),
      ...(page && { page }),
      // Prefer client's traceId (from last API call), fallback to this request's traceId
      traceId: traceId || requestTraceId,
      ...(userId && { userId }),
      // Client context (frontend-collected)
      ...(language && { language }),
      ...(timezone && { timezone }),
      ...(screen && { screen }),
      ...(pixelRatio && { pixelRatio }),
      ...(networkType && { networkType }),
      ...(isOnline !== undefined && { isOnline }),
      ...(referrer && { referrer }),
      // Backend context (server-collected)
      clientIp,
      userAgent,
    };

    // Emit log at appropriate level
    switch (level) {
      case 'error':
        logger.error(logObj, message);
        break;
      case 'warn':
        logger.warn(logObj, message);
        break;
      case 'info':
      default:
        logger.info(logObj, message);
        break;
    }
  }

  return c.json({ success: true, count: logs.length });
});

export default app;
