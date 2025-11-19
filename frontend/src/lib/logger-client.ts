/**
 * Client-side logger wrapper
 * Currently logs to console, future migration to centralized logging API
 */

export const logger = {
  error: (message: string, data?: unknown) => {
    if (typeof window !== 'undefined') {
      console.error(`[Client Error] ${message}`, data);
      // TODO: Send to centralized logging API in production
    }
  },

  warn: (message: string, data?: unknown) => {
    if (typeof window !== 'undefined') {
      console.warn(`[Client Warning] ${message}`, data);
    }
  },

  info: (message: string, data?: unknown) => {
    if (typeof window !== 'undefined') {
      console.info(`[Client Info] ${message}`, data);
    }
  },

  debug: (message: string, data?: unknown) => {
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      console.debug(`[Client Debug] ${message}`, data);
    }
  },
};
