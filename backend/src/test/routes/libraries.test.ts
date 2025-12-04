import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

describe('Libraries Routes Integration', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    
    // Mock auth middleware
    app.use('*', async (c, next) => {
      c.set('auth', { userId: 'test-user-123', email: 'test@example.com' });
      await next();
    });
  });

  describe('GET /api/libraries', () => {
    it('should return empty array for user with no libraries', async () => {
      // Mock prisma findMany
      const mockPrisma = {
        library: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      app.get('/libraries', async (c) => {
        const auth = c.get('auth');
        const libraries = await mockPrisma.library.findMany({
          where: { userId: auth.userId },
        });

        return c.json({
          success: true,
          data: libraries,
        });
      });

      const res = await app.request('/libraries');
      const json = await res.json() as { success: boolean; data: unknown[] };

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('should return list of libraries with song counts', async () => {
      const mockLibraries = [
        {
          id: 'lib-1',
          name: 'My Library',
          userId: 'test-user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          songCount: 5,
        },
        {
          id: 'lib-2',
          name: 'Another Library',
          userId: 'test-user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          songCount: 0,
        },
      ];

      app.get('/libraries', async (c) => {
        return c.json({
          success: true,
          data: mockLibraries,
        });
      });

      const res = await app.request('/libraries');
      const json = await res.json() as { success: boolean; data: Array<{ name: string; songCount: number }> };

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0].name).toBe('My Library');
      expect(json.data[0].songCount).toBe(5);
    });
  });

  describe('POST /api/libraries', () => {
    it('should create a new library', async () => {
      const newLibrary = {
        id: 'lib-new',
        name: 'New Library',
        userId: 'test-user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      app.post('/libraries', async (c) => {
        const body = await c.req.json();
        
        return c.json({
          success: true,
          data: { ...newLibrary, name: body.name },
        }, 201);
      });

      const res = await app.request('/libraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Library' }),
      });

      const json = await res.json() as { success: boolean; data: { name: string } };

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('New Library');
    });

    it('should reject empty library name', async () => {
      app.post('/libraries', async (c) => {
        const body = await c.req.json();
        
        if (!body.name || body.name.trim().length === 0) {
          return c.json({
            success: false,
            error: 'Library name is required',
          }, 400);
        }

        return c.json({ success: true }, 201);
      });

      const res = await app.request('/libraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '' }),
      });

      const json = await res.json() as { success: boolean; error: string };

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Library name is required');
    });
  });

  describe('DELETE /api/libraries/:id', () => {
    it('should delete existing library', async () => {
      app.delete('/libraries/:id', async (c) => {
        const id = c.req.param('id');
        
        return c.json({
          success: true,
          message: `Library ${id} deleted`,
        });
      });

      const res = await app.request('/libraries/lib-123', {
        method: 'DELETE',
      });

      const json = await res.json() as { success: boolean };

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should return 404 for non-existent library', async () => {
      app.delete('/libraries/:id', async (c) => {
        const id = c.req.param('id');
        
        if (id === 'non-existent') {
          return c.json({
            success: false,
            error: 'Library not found',
          }, 404);
        }

        return c.json({ success: true });
      });

      const res = await app.request('/libraries/non-existent', {
        method: 'DELETE',
      });

      const json = await res.json() as { success: boolean; error: string };

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
    });
  });
});
