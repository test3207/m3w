/**
 * Health Check Routes Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock dependencies before importing the module
vi.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../../lib/minio-client', () => ({
  getMinioClient: vi.fn(() => ({
    listBuckets: vi.fn(),
  })),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import healthRoutes from '../../routes/health';
import { prisma } from '../../lib/prisma';
import { getMinioClient } from '../../lib/minio-client';

// Type for health check response
interface HealthResponse {
  status: string;
  timestamp: string;
  uptime?: number;
  checks?: {
    database: { status: string; latency?: number; error?: string };
    storage: { status: string; latency?: number; error?: string };
  };
}

// Helper to create mock MinIO client
function createMockMinioClient(listBucketsImpl: () => Promise<unknown>) {
  return {
    listBuckets: vi.fn().mockImplementation(listBucketsImpl),
  } as unknown as ReturnType<typeof getMinioClient>;
}

describe('Health Check Routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/', healthRoutes);
  });

  describe('GET /health (liveness)', () => {
    it('should return 200 with status ok', async () => {
      const res = await app.request('/health');
      
      expect(res.status).toBe(200);
      const body = await res.json() as HealthResponse;
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeTypeOf('number');
    });
  });

  describe('GET /ready (readiness)', () => {
    it('should return 200 when all dependencies are healthy', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }]);
      vi.mocked(getMinioClient).mockReturnValue(
        createMockMinioClient(() => Promise.resolve([]))
      );

      const res = await app.request('/ready');
      
      expect(res.status).toBe(200);
      const body = await res.json() as HealthResponse;
      expect(body.status).toBe('ready');
      expect(body.checks!.database.status).toBe('ok');
      expect(body.checks!.database.latency).toBeTypeOf('number');
      expect(body.checks!.storage.status).toBe('ok');
      expect(body.checks!.storage.latency).toBeTypeOf('number');
    });

    it('should return 503 when PostgreSQL fails', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection refused'));
      vi.mocked(getMinioClient).mockReturnValue(
        createMockMinioClient(() => Promise.resolve([]))
      );

      const res = await app.request('/ready');
      
      expect(res.status).toBe(503);
      const body = await res.json() as HealthResponse;
      expect(body.status).toBe('not_ready');
      expect(body.checks!.database.status).toBe('error');
      expect(body.checks!.database.error).toBeDefined();
      expect(body.checks!.storage.status).toBe('ok');
    });

    it('should return 503 when MinIO fails', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }]);
      vi.mocked(getMinioClient).mockReturnValue(
        createMockMinioClient(() => Promise.reject(new Error('Service unavailable')))
      );

      const res = await app.request('/ready');
      
      expect(res.status).toBe(503);
      const body = await res.json() as HealthResponse;
      expect(body.status).toBe('not_ready');
      expect(body.checks!.database.status).toBe('ok');
      expect(body.checks!.storage.status).toBe('error');
      expect(body.checks!.storage.error).toBeDefined();
    });

    it('should return 503 when multiple dependencies fail', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection refused'));
      vi.mocked(getMinioClient).mockReturnValue(
        createMockMinioClient(() => Promise.reject(new Error('Service unavailable')))
      );

      const res = await app.request('/ready');
      
      expect(res.status).toBe(503);
      const body = await res.json() as HealthResponse;
      expect(body.status).toBe('not_ready');
      expect(body.checks!.database.status).toBe('error');
      expect(body.checks!.storage.status).toBe('error');
    });

    it('should include latency measurements in successful checks', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }]);
      vi.mocked(getMinioClient).mockReturnValue(
        createMockMinioClient(() => Promise.resolve([]))
      );

      const res = await app.request('/ready');
      
      expect(res.status).toBe(200);
      const body = await res.json() as HealthResponse;
      expect(body.checks!.database.latency).toBeGreaterThanOrEqual(0);
      expect(body.checks!.storage.latency).toBeGreaterThanOrEqual(0);
    });
  });
});
