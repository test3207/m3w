/**
 * Backend Logger using Pino
 */

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
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
});
