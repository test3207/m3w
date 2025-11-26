/**
 * Auth helper - extract userId from context
 */

import type { Context } from 'hono';

export function getUserId(c: Context): string {
  const auth = c.get('auth');
  if (!auth || !auth.userId) {
    throw new Error('User not authenticated');
  }
  return auth.userId;
}
