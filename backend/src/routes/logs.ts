import { Hono } from 'hono';
import { z } from 'zod';
import { logger } from '../lib/logger';

const logsRoutes = new Hono();

const logEntrySchema = z.object({
  level: z.enum(['info', 'warn', 'error', 'debug']),
  message: z.string(),
  data: z.unknown().optional(),
  timestamp: z.string().optional(),
});

const logsBatchSchema = z.array(logEntrySchema);

logsRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const logs = logsBatchSchema.parse(body);

    logs.forEach((log) => {
      const { level, message, data, timestamp } = log;
      const logFn = logger[level] ? logger[level].bind(logger) : logger.info.bind(logger);
      
      logFn({
        source: 'frontend',
        data,
        clientTimestamp: timestamp,
      }, message);
    });

    return c.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to process frontend logs');
    return c.json({ success: false, error: 'Invalid log format' }, 400);
  }
});

export default logsRoutes;
