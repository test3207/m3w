import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';

describe('Auth Middleware Integration', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe('Protected routes', () => {
    it('should reject requests without auth token', async () => {
      app.get('/protected', async (c) => {
        const auth = c.get('auth');
        
        if (!auth) {
          return c.json({
            success: false,
            error: 'Unauthorized',
          }, 401);
        }

        return c.json({ success: true, data: 'Protected content' });
      });

      const res = await app.request('/protected');
      const json = await res.json() as { success: boolean; error: string };

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('should allow requests with valid auth', async () => {
      // Mock auth middleware
      app.use('*', async (c, next) => {
        c.set('auth', { userId: 'user-123', email: 'test@example.com' });
        await next();
      });

      app.get('/protected', async (c) => {
        const auth = c.get('auth');
        
        return c.json({ 
          success: true, 
          data: 'Protected content',
          userId: auth.userId 
        });
      });

      const res = await app.request('/protected');
      const json = await res.json() as { success: boolean; userId: string };

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.userId).toBe('user-123');
    });
  });

  describe('Token validation', () => {
    it('should reject invalid JWT format', async () => {
      app.use('*', async (c, next) => {
        const authHeader = c.req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return c.json({
            success: false,
            error: 'Invalid authorization header',
          }, 401);
        }

        const token = authHeader.substring(7);
        if (token !== 'valid-token-123') {
          return c.json({
            success: false,
            error: 'Invalid token',
          }, 401);
        }

        c.set('auth', { userId: 'user-123', email: 'test@example.com' });
        await next();
      });

      app.get('/protected', async (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      const json = await res.json() as { success: boolean; error: string };

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid token');
    });

    it('should accept valid token', async () => {
      app.use('*', async (c, next) => {
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.substring(7);
        
        if (token === 'valid-token-123') {
          c.set('auth', { userId: 'user-123', email: 'test@example.com' });
        }
        
        await next();
      });

      app.get('/protected', async (c) => {
        const auth = c.get('auth');
        return c.json({ success: true, userId: auth.userId });
      });

      const res = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer valid-token-123',
        },
      });

      const json = await res.json() as { success: boolean; userId: string };

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.userId).toBe('user-123');
    });
  });

  describe('User context', () => {
    it('should provide user information in context', async () => {
      app.use('*', async (c, next) => {
        c.set('auth', { 
          userId: 'user-456', 
          email: 'user@example.com',
        });
        await next();
      });

      app.get('/me', async (c) => {
        const auth = c.get('auth');
        return c.json({ 
          success: true,
          user: {
            id: auth.userId,
            email: auth.email,
          }
        });
      });

      const res = await app.request('/me');
      const json = await res.json() as { 
        success: boolean; 
        user: { id: string; email: string } 
      };

      expect(res.status).toBe(200);
      expect(json.user.id).toBe('user-456');
      expect(json.user.email).toBe('user@example.com');
    });
  });
});
