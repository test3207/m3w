/**
 * Prisma Client Instance
 * Singleton pattern for database connection
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from './logger';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

// Attempt connection on startup (non-blocking)
// If connection fails, log warning but don't exit - /ready endpoint will report status
const dbLog = createLogger();
prisma
  .$connect()
  .then(() => {
    dbLog.info({
      source: 'prisma.connect',
      col1: 'system',
      col2: 'connection',
      message: 'Connected to PostgreSQL database',
    });
  })
  .catch((error) => {
    dbLog.warn({
      source: 'prisma.connect',
      col1: 'system',
      col2: 'connection',
      raw: { error: error instanceof Error ? error.message : String(error) },
      message: 'Failed to connect to database on startup (will retry on first query)',
    });
  });
