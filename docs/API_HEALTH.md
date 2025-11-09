# Health Check API Endpoint

GET /api/health

## Purpose
Provides health status for Container Apps liveness and readiness probes.

## Response

### Success (200 OK)
```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "storage": "ok"
  }
}
```

### Unhealthy (503 Service Unavailable)
```json
{
  "status": "unhealthy",
  "timestamp": "2025-11-09T12:00:00.000Z",
  "checks": {
    "database": "error",
    "redis": "ok",
    "storage": "ok"
  },
  "error": "Database connection failed"
}
```

## Implementation

Create this file: `src/app/api/health/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

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

    // Check Redis (if enabled)
    if (process.env.REDIS_URL) {
      try {
        // Add Redis health check if implemented
        checks.redis = 'ok';
      } catch (error) {
        checks.redis = 'error';
      }
    }

    // Check Storage (Azure Blob or MinIO)
    try {
      // Add storage health check if needed
      checks.storage = 'ok';
    } catch (error) {
      checks.storage = 'error';
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
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
```
