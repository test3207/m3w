/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to context
 */

import { Context, Next } from 'hono';
import { verifyToken } from './jwt';
import { prisma } from './prisma';
import { logger } from './logger';

export interface AuthContext {
  userId: string;
  email: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  // Try Authorization header first
  const authHeader = c.req.header('Authorization');
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Fallback to cookie for Service Worker and direct browser requests
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      const authCookie = cookies.find(c => c.startsWith('auth-token='));
      if (authCookie) {
        token = authCookie.substring('auth-token='.length);
      }
    }
  }

  if (!token) {
    logger.warn('Missing authorization header and cookie');
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
      },
      401
    );
  }

  logger.debug({ tokenPrefix: token.substring(0, 20) }, 'Verifying token');
  
  const payload = verifyToken(token);

  if (!payload || payload.type !== 'access') {
    logger.warn({ payload, tokenPrefix: token.substring(0, 20) }, 'Invalid or expired token');
    return c.json(
      {
        success: false,
        error: 'Invalid or expired token',
      },
      401
    );
  }

  // Verify user still exists
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    return c.json(
      {
        success: false,
        error: 'User not found',
      },
      404
    );
  }

  // Attach auth context
  c.set('auth', {
    userId: user.id,
    email: user.email || '',
  });

  await next();
}

/**
 * Optional auth middleware - doesn't fail if no token
 * Useful for endpoints that work with or without auth
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload && payload.type === 'access') {
      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });

        if (user) {
          c.set('auth', {
            userId: user.id,
            email: user.email || '',
          });
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to verify optional auth');
      }
    }
  }

  await next();
}
