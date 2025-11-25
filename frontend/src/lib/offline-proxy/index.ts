/**
 * Offline Proxy with Hono
 * 
 * Main router that composes all sub-routers for handling user data routes
 * (libraries, playlists, songs, upload, player) with IndexedDB.
 * 
 * Architecture:
 * - Each domain has its own route file in ./routes/
 * - Utilities are shared via ./utils/
 * - This file only handles routing composition
 */

import { Hono } from 'hono';
import {
  libraryRoutes,
  playlistRoutes,
  songRoutes,
  uploadRoutes,
  playerRoutes,
} from './routes';

// Create main app with /api base path
const app = new Hono().basePath('/api');

// Mount sub-routers
app.route('/libraries', libraryRoutes);
app.route('/playlists', playlistRoutes);
app.route('/songs', songRoutes);
app.route('/upload', uploadRoutes);
app.route('/player', playerRoutes);

export default app;

// Re-export utilities for external use
export { getUserId, isGuestUser } from './utils';
export { sortSongsOffline, getPinyinSort } from './utils';
