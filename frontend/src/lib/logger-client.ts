/**
 * Client-side logger wrapper
 * Logs to console and sends to backend in production
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

const LOG_FLUSH_INTERVAL = 5000;
const MAX_BATCH_SIZE = 50;
let logBuffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const flushLogs = async () => {
  if (logBuffer.length === 0) return;

  const logsToSend = [...logBuffer];
  logBuffer = [];

  try {
    // Use fetch with keepalive for reliability during unload
    await fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logsToSend),
      keepalive: true,
    });
  } catch (err) {
    // Fallback to console if sending fails
    console.error('Failed to send logs to backend', err);
  }
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
}

export const logger = {
  error: (message: string, data?: unknown) => log('error', message, data),
  warn: (message: string, data?: unknown) => log('warn', message, data),
  info: (message: string, data?: unknown) => log('info', message, data),
  debug: (message: string, data?: unknown) => log('debug', message, data),
};
