/**
 * Client-side logger wrapper
 * Logs to console and sends to backend in production
 * Features:
 * - Retry mechanism with exponential backoff
 * - IndexedDB fallback buffer for failed transmissions
 * - Automatic retry on network recovery
 */

import { db } from './db/schema';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

const LOG_FLUSH_INTERVAL = 5000;
const MAX_BATCH_SIZE = 50;
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 1 minute
const PENDING_LOG_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

let logBuffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Calculate exponential backoff delay
 */
const getRetryDelay = (retryCount: number): number => {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY);
};

/**
 * Clean up old pending logs to prevent unbounded growth
 */
const cleanupOldLogs = async () => {
  try {
    const cutoffTime = Date.now() - PENDING_LOG_MAX_AGE;
    await db.pendingLogs
      .where('createdAt')
      .below(new Date(cutoffTime))
      .delete();
  } catch (err) {
    console.error('Failed to cleanup old logs', err);
  }
};

/**
 * Save failed logs to IndexedDB for retry
 */
const saveToIndexedDB = async (logs: LogEntry[]) => {
  try {
    const now = Date.now();
    const pendingLogs = logs.map((log, index) => ({
      id: `${now}-${index}`,
      level: log.level,
      message: log.message,
      data: log.data,
      timestamp: log.timestamp,
      retryCount: 0,
      nextRetry: now + INITIAL_RETRY_DELAY,
      createdAt: new Date(),
    }));

    await db.pendingLogs.bulkAdd(pendingLogs);
    scheduleRetry();
  } catch (err) {
    console.error('Failed to save logs to IndexedDB', err);
  }
};

/**
 * Attempt to send logs to backend
 */
const sendLogsToBackend = async (logs: LogEntry[]): Promise<boolean> => {
  try {
    const response = await fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logs),
      keepalive: true,
    });

    return response.ok;
  } catch (err) {
    return false;
  }
};

/**
 * Retry sending pending logs from IndexedDB
 */
const retryPendingLogs = async () => {
  try {
    const now = Date.now();
    
    // Get logs ready for retry
    const pendingLogs = await db.pendingLogs
      .where('nextRetry')
      .belowOrEqual(now)
      .toArray();

    if (pendingLogs.length === 0) {
      return;
    }

    // Group logs for batch sending
    const logsToSend: LogEntry[] = pendingLogs.map(log => ({
      level: log.level,
      message: log.message,
      data: log.data,
      timestamp: log.timestamp,
    }));

    const success = await sendLogsToBackend(logsToSend);

    if (success) {
      // Successfully sent, delete from IndexedDB
      await db.pendingLogs.bulkDelete(pendingLogs.map(log => log.id));
      console.info(`Successfully sent ${pendingLogs.length} pending logs`);
    } else {
      // Failed to send, update retry info with exponential backoff
      const updates = pendingLogs
        .filter(log => log.retryCount < MAX_RETRY_ATTEMPTS)
        .map(log => {
          const newRetryCount = log.retryCount + 1;
          return {
            ...log,
            retryCount: newRetryCount,
            nextRetry: now + getRetryDelay(newRetryCount),
          };
        });

      if (updates.length > 0) {
        await db.pendingLogs.bulkPut(updates);
        scheduleRetry();
      }

      // Delete logs that exceeded max retry attempts
      const failedLogIds = pendingLogs
        .filter(log => log.retryCount >= MAX_RETRY_ATTEMPTS)
        .map(log => log.id);
      
      if (failedLogIds.length > 0) {
        await db.pendingLogs.bulkDelete(failedLogIds);
        console.warn(`Dropped ${failedLogIds.length} logs after max retry attempts`);
      }
    }

    // Schedule next retry if there are still pending logs
    const remainingLogs = await db.pendingLogs.count();
    if (remainingLogs > 0) {
      scheduleRetry();
    }
  } catch (err) {
    console.error('Failed to retry pending logs', err);
  }
};

/**
 * Schedule the next retry attempt
 */
const scheduleRetry = () => {
  if (retryTimer) {
    return; // Already scheduled
  }

  // Find the next log to retry
  db.pendingLogs
    .orderBy('nextRetry')
    .first()
    .then(nextLog => {
      if (!nextLog) {
        return;
      }

      const delay = Math.max(0, nextLog.nextRetry - Date.now());
      retryTimer = setTimeout(() => {
        retryTimer = null;
        retryPendingLogs();
      }, delay);
    })
    .catch(err => {
      console.error('Failed to schedule retry', err);
    });
};

const flushLogs = async () => {
  if (logBuffer.length === 0) return;

  const logsToSend = [...logBuffer];
  logBuffer = [];

  const success = await sendLogsToBackend(logsToSend);

  if (!success) {
    // Failed to send, save to IndexedDB for retry
    await saveToIndexedDB(logsToSend);
  }

  // Periodic cleanup of old logs
  await cleanupOldLogs();
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLogs();
  }, LOG_FLUSH_INTERVAL);
};

const log = (level: LogLevel, message: string, data?: unknown) => {
  if (typeof window === 'undefined') return;

  // Always log to console
  const consoleMethod = console[level] || console.log;
  const prefix = `[Client ${level.charAt(0).toUpperCase() + level.slice(1)}]`;
  
  if (level === 'debug' && !import.meta.env.DEV) {
    // Skip debug logs in production console
  } else {
    consoleMethod(`${prefix} ${message}`, data || '');
  }

  // Send to backend (skip debug logs unless needed)
  if (level !== 'debug') {
    logBuffer.push({
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    });

    if (logBuffer.length >= MAX_BATCH_SIZE) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushLogs();
    } else {
      scheduleFlush();
    }
  }
};

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushLogs();
    }
  });

  // Retry pending logs on network recovery
  window.addEventListener('online', () => {
    retryPendingLogs();
  });

  // Try to send pending logs on startup
  retryPendingLogs();
}

export const logger = {
  error: (message: string, data?: unknown) => log('error', message, data),
  warn: (message: string, data?: unknown) => log('warn', message, data),
  info: (message: string, data?: unknown) => log('info', message, data),
  debug: (message: string, data?: unknown) => log('debug', message, data),
};
