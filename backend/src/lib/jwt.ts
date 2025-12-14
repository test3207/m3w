/**
 * JWT Token utilities
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { User } from '@m3w/shared';

/**
 * Get or generate JWT secret.
 * If JWT_SECRET is not set, generates a random secret for this process lifetime.
 * Note: Random secret means tokens won't persist across restarts.
 */
function getJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  // Generate a random secret for offline/demo mode
  // This is fine because offline mode doesn't use server-side auth anyway
  const randomSecret = crypto.randomBytes(32).toString('hex');
  console.log('[JWT] No JWT_SECRET configured, using random secret (tokens will not persist across restarts)');
  return randomSecret;
}

const JWT_SECRET = getJwtSecret();
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '6h'; // 6 hours for music listening sessions
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '90d';

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export function generateAccessToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      type: 'access',
    } as TokenPayload,
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY } as jwt.SignOptions
  );
}

export function generateRefreshToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      type: 'refresh',
    } as TokenPayload,
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY } as jwt.SignOptions
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return payload;
  } catch {
    return null;
  }
}

export function generateTokens(user: User) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  // Calculate expiry time (in milliseconds)
  const decoded = jwt.decode(accessToken) as { exp: number };
  const expiresAt = decoded.exp * 1000;

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}
