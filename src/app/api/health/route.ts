import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * Health check endpoint for Container Apps probes
 * Used by liveness and readiness checks
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, string> = {};
  
  try {
    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch (error) {
      checks.database = 'error';
      throw new Error('Database connection failed');
    }

    // Check Redis if configured
    if (process.env.REDIS_URL) {
      try {
        // TODO: Add Redis health check when implemented
        checks.redis = 'skipped';
      } catch (error) {
        checks.redis = 'error';
      }
    }

    // Check Storage connectivity
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      try {
        // TODO: Add storage health check if needed
        checks.storage = 'skipped';
      } catch (error) {
        checks.storage = 'error';
      }
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      checks,
      responseTime,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
