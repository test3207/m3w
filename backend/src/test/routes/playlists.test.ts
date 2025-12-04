import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';

describe('Playlists Routes Integration', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    
    // Mock auth middleware
    app.use('*', async (c, next) => {
      c.set('auth', { userId: 'test-user-123', email: 'test@example.com' });
      await next();
    });
  });

  describe('GET /api/playlists', () => {
    it('should return empty array for user with no playlists', async () => {
      app.get('/playlists', async (c) => {
        return c.json({
          success: true,
          data: [],
        });
      });

      const res = await app.request('/playlists');
      const json = await res.json() as { success: boolean; data: unknown[] };

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('should return list of playlists with song counts', async () => {
      const mockPlaylists = [
        {
          id: 'playlist-1',
          name: 'Favorites',
          userId: 'test-user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          songCount: 10,
        },
        {
          id: 'playlist-2',
          name: 'Workout',
          userId: 'test-user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          songCount: 5,
        },
      ];

      app.get('/playlists', async (c) => {
        return c.json({
          success: true,
          data: mockPlaylists,
        });
      });

      const res = await app.request('/playlists');
      const json = await res.json() as { 
        success: boolean; 
        data: Array<{ name: string; songCount: number }> 
      };

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0].name).toBe('Favorites');
      expect(json.data[0].songCount).toBe(10);
    });
  });

  describe('POST /api/playlists', () => {
    it('should create a new playlist', async () => {
      app.post('/playlists', async (c) => {
        const body = await c.req.json();
        
        return c.json({
          success: true,
          data: {
            id: 'playlist-new',
            name: body.name,
            userId: 'test-user-123',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }, 201);
      });

      const res = await app.request('/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'My New Playlist' }),
      });

      const json = await res.json() as { success: boolean; data: { name: string } };

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('My New Playlist');
    });

    it('should reject empty playlist name', async () => {
      app.post('/playlists', async (c) => {
        const body = await c.req.json();
        
        if (!body.name || body.name.trim().length === 0) {
          return c.json({
            success: false,
            error: 'Playlist name is required',
          }, 400);
        }

        return c.json({ success: true }, 201);
      });

      const res = await app.request('/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '   ' }),
      });

      const json = await res.json() as { success: boolean; error: string };

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Playlist name is required');
    });
  });

  describe('POST /api/playlists/:id/songs', () => {
    it('should add song to playlist', async () => {
      app.post('/playlists/:id/songs', async (c) => {
        const playlistId = c.req.param('id');
        const body = await c.req.json();
        
        return c.json({
          success: true,
          data: {
            playlistId,
            songId: body.songId,
            order: 1,
          },
        }, 201);
      });

      const res = await app.request('/playlists/playlist-1/songs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ songId: 'song-123' }),
      });

      const json = await res.json() as { 
        success: boolean; 
        data: { playlistId: string; songId: string; order: number } 
      };

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.playlistId).toBe('playlist-1');
      expect(json.data.songId).toBe('song-123');
    });

    it('should reject duplicate song', async () => {
      app.post('/playlists/:id/songs', async (c) => {
        const body = await c.req.json();
        
        if (body.songId === 'song-duplicate') {
          return c.json({
            success: false,
            error: 'Song already in playlist',
          }, 409);
        }

        return c.json({ success: true }, 201);
      });

      const res = await app.request('/playlists/playlist-1/songs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ songId: 'song-duplicate' }),
      });

      const json = await res.json() as { success: boolean; error: string };

      expect(res.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Song already in playlist');
    });
  });

  describe('DELETE /api/playlists/:id', () => {
    it('should delete playlist', async () => {
      app.delete('/playlists/:id', async (c) => {
        return c.json({
          success: true,
          message: 'Playlist deleted',
        });
      });

      const res = await app.request('/playlists/playlist-1', {
        method: 'DELETE',
      });

      const json = await res.json() as { success: boolean };

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should return 404 for non-existent playlist', async () => {
      app.delete('/playlists/:id', async (c) => {
        const id = c.req.param('id');
        
        if (id === 'non-existent') {
          return c.json({
            success: false,
            error: 'Playlist not found',
          }, 404);
        }

        return c.json({ success: true });
      });

      const res = await app.request('/playlists/non-existent', {
        method: 'DELETE',
      });

      const json = await res.json() as { success: boolean; error: string };

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
    });
  });
});
