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
const HOME_REGION = process.env.HOME_REGION || 'default';

/**
 * Calculate Redis TTL in seconds from JWT_REFRESH_EXPIRY configuration
 * Ensures Redis TTL stays in sync with refresh token expiry
 */
export function getRedisUserTTL(): number {
  const expiry = JWT_REFRESH_EXPIRY;
  const match = expiry.match(/^(\d+)([dhms])$/);
  if (!match) return 60 * 60 * 24 * 90; // Default 90 days
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'd': return value * 24 * 60 * 60;
    case 'h': return value * 60 * 60;
    case 'm': return value * 60;
    case 's': return value;
    default: return 60 * 60 * 24 * 90;
  }
}

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  homeRegion: string;  // "jp", "sea", "usw", or "default" for AIO
  isRemote?: boolean;  // true if user accessing from non-home region
}

export function generateAccessToken(user: User, homeRegion = HOME_REGION, isRemote = false): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      type: 'access',
      homeRegion,
      isRemote,
    } as TokenPayload,
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY } as jwt.SignOptions
  );
}

export function generateRefreshToken(user: User, homeRegion = HOME_REGION): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      type: 'refresh',
      homeRegion,
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

export function generateTokens(user: User, homeRegion = HOME_REGION, isRemote = false) {
  const accessToken = generateAccessToken(user, homeRegion, isRemote);
  const refreshToken = generateRefreshToken(user, homeRegion);
  
  // Calculate expiry time (in milliseconds)
  const decoded = jwt.decode(accessToken) as { exp: number };
  const expiresAt = decoded.exp * 1000;

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}
