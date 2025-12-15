/**
 * Prisma Client Instance
 * Singleton pattern for database connection
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

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
prisma
  .$connect()
  .then(() => {
    logger.info('Connected to PostgreSQL database');
  })
  .catch((error) => {
    logger.warn(error, 'Failed to connect to database on startup (will retry on first query)');
  });
