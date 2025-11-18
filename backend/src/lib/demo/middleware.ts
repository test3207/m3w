/**
 * Demo Mode - Middleware
 * 
 * Provides request interception during demo mode operations.
 */

import type { Context, Next } from 'hono';
import { storageTracker } from './storage-tracker';

// Global flag to track reset status
let isResetting = false;

/**
 * Set the resetting status
 */
export function setResetting(value: boolean): void {
  isResetting = value;
}

/**
 * Get the resetting status
 */
export function isSystemResetting(): boolean {
  return isResetting;
}

/**
 * Middleware to check demo mode status and reject requests during reset
 */
export function demoStorageCheckMiddleware() {
  return async (c: Context, next: Next) => {
    // Runtime check: only enforce if storage limit is enabled
    if (!storageTracker.enabled) {
      await next();
      return;
    }
    
    // Check if system is resetting
    if (isResetting) {
      return c.json({
        status: 'error',
        message: 'System is resetting, please try again later',
      }, 503);
    }

    await next();
  };
}

import type { Hono } from 'hono';

/**
 * Register demo-related API routes
 */
export function registerDemoRoutes(app: Hono): void {
  // GET /api/demo/storage - Get current storage usage
  app.get('/api/demo/storage', (c: Context) => {
    if (!storageTracker.enabled) {
      return c.json({
        success: false,
        error: 'Demo mode is not enabled',
      }, 404);
    }

    const usage = storageTracker.getCurrentUsage();
    return c.json({ 
      success: true, 
      data: usage 
    });
  });
}
