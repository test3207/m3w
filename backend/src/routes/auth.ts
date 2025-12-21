/**
 * Authentication Routes (Hono Backend)
 * Admin routes - online only
 */

import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { generateTokens, verifyToken, getRedisUserTTL, getAccessTokenExpirySeconds, getRefreshTokenExpirySeconds } from '../lib/jwt';
import { authMiddleware } from '../lib/auth-middleware';
import { redis, isRedisAvailable } from '../lib/redis';
import type { Context } from 'hono';
import type { User } from '@prisma/client';

const app = new Hono();

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI =
  process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/api/auth/callback';

// Multi-region configuration
const HOME_REGION = process.env.HOME_REGION || 'default';  // "jp", "sea", "usw", or "default" for AIO
// Cookie domain for multi-region (e.g., ".m3w.test3207.fun" for wildcard)
// Leave empty for local dev (cookie bound to request domain)
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '';

// Runtime validation: warn if COOKIE_DOMAIN looks misconfigured for wildcard
// Only warn for domains with at least one dot, avoids false positives for "localhost"
const dotCount = (COOKIE_DOMAIN.match(/\./g) || []).length;
if (COOKIE_DOMAIN && !COOKIE_DOMAIN.startsWith('.') && dotCount >= 1) {
  logger.warn(
    `COOKIE_DOMAIN "${COOKIE_DOMAIN}" does not start with a leading dot (.) which is required for wildcard subdomain cookies. ` +
    `Consider using ".${COOKIE_DOMAIN}" for multi-region deployments.`
  );
}

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

// AIO mode: backend serves frontend, so we can use request origin for redirects
const SERVE_FRONTEND = process.env.SERVE_FRONTEND === 'true';

// ============================================================================
// Helper Functions for OAuth Callback
// ============================================================================

/**
 * Step 1: Exchange GitHub OAuth code for access token
 */
async function exchangeCodeForToken(code: string): Promise<string | null> {
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status, statusText: response.statusText }, 'GitHub token exchange HTTP error');
      return null;
    }

    const data = (await response.json()) as { access_token?: string; error?: string };
    if (data.error) {
      logger.error({ error: data.error }, 'GitHub token exchange API error');
      return null;
    }
    return data.access_token || null;
  } catch (error) {
    logger.error({ error }, 'GitHub token exchange failed');
    return null;
  }
}

/**
 * Step 2: Fetch GitHub user profile and email
 */
async function fetchGitHubUser(token: string): Promise<{ user: GitHubUser; email: string } | null> {
  try {
    // Fetch user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!userResponse.ok) {
      logger.error({ status: userResponse.status, statusText: userResponse.statusText }, 'GitHub user API HTTP error');
      return null;
    }
    const user = (await userResponse.json()) as GitHubUser;

    // Get email (from profile or emails API)
    let email = user.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!emailsResponse.ok) {
        logger.error({ status: emailsResponse.status, statusText: emailsResponse.statusText }, 'GitHub emails API HTTP error');
        return null;
      }
      const emails = (await emailsResponse.json()) as GitHubEmail[];
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email || emails[0]?.email || null;
    }

    return email ? { user, email } : null;
  } catch (error) {
    logger.error({ error }, 'GitHub user fetch failed');
    return null;
  }
}

/**
 * Step 3: Check Redis for cross-region user
 * Returns the home region if user exists in another region, null otherwise
 * Also atomically claims the user for this region if new
 * 
 * Race condition handling:
 * - SETNX is atomic, so only one region can successfully claim a user
 * - If Redis fails mid-operation, we log and return null (graceful degradation)
 * - Database unique constraint on Account.providerAccountId provides fallback safety
 */
async function checkCrossRegion(githubId: number): Promise<string | null> {
  if (!isRedisAvailable()) {
    logger.debug({ githubId }, 'Redis not available, skipping cross-region check');
    return null;
  }

  const redisKey = `m3w:github:${githubId}`;
  try {
    // SETNX: atomically claim this GitHub user for this region
    const claimed = await redis!.set(
      redisKey,
      HOME_REGION,
      'EX',
      getRedisUserTTL(),
      'NX'
    );

    if (!claimed) {
      // User already claimed by another region
      const existingRegion = await redis!.get(redisKey);
      if (!existingRegion) {
        // Key expired between SETNX failure and GET - race condition, treat as new user
        logger.warn({ githubId, redisKey }, 'Redis key disappeared between SETNX and GET');
        return null;
      }
      return existingRegion;
    }
    return null;
  } catch (error) {
    // Redis operation failed - log and allow local operation (graceful degradation)
    // Database constraint on Account.providerAccountId prevents true duplicates
    logger.error({ error, githubId }, 'Redis cross-region check failed, allowing local operation');
    return null;
  }
}

/**
 * Step 4a: Handle cross-region user (user registered in another region)
 * Sets cookies and redirects to frontend (same as local users).
 * 
 * Cross-region routing is handled by:
 * - JWT contains homeRegion claim for Gateway routing
 * - Cookie is set with wildcard domain for all regions
 * - Frontend receives same redirect flow regardless of region
 */
function handleCrossRegionUser(
  c: Context,
  githubUser: GitHubUser,
  email: string,
  homeRegion: string
) {
  logger.info(
    { githubId: githubUser.id, email, homeRegion, currentRegion: HOME_REGION },
    'Cross-region user login: setting cookies and redirecting'
  );

  const now = new Date().toISOString();
  // Create user object for token generation
  const crossRegionUser = {
    id: githubUser.id.toString(),
    email,
    name: githubUser.name || githubUser.login,
    image: githubUser.avatar_url,
    homeRegion,
    createdAt: now,
    updatedAt: now,
  };

  const tokens = generateTokens(crossRegionUser, homeRegion, true /* isRemote */);

  // Use same cookie+redirect flow as local users
  // JWT.homeRegion tells Gateway where to route future API requests
  return setAuthCookiesAndRedirect(c, tokens);
}

/**
 * Step 4b: Find or create local user
 * - Looks up by GitHub ID (Account table) first
 * - Falls back to email (User table)
 * - Creates new user with Account if not found
 */
async function findOrCreateLocalUser(
  githubUser: GitHubUser,
  email: string,
  githubToken: string
): Promise<{ user: User; isNewUser: boolean }> {
  // Try to find existing account by GitHub ID
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: 'github',
        providerAccountId: githubUser.id.toString(),
      },
    },
    include: { user: true },
  });

  if (account?.user) {
    // Update access token
    await prisma.account.update({
      where: { id: account.id },
      data: { access_token: githubToken },
    });
    return { user: account.user, isNewUser: false };
  }

  // Try to find by email (user may exist from different provider)
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // Link GitHub account to existing user
    // Note: homeRegion is not stored in DB - it's determined by HOME_REGION env var
    // If this user exists locally, they registered in this region, so homeRegion is correct
    // Cross-region case is handled by checkCrossRegion() before this function is called
    await prisma.account.create({
      data: {
        userId: existingUser.id,
        type: 'oauth',
        provider: 'github',
        providerAccountId: String(githubUser.id),
        access_token: githubToken,
      },
    });
    return { user: existingUser, isNewUser: false };
  }

  // Create new user with Account (in a single transaction)
  const newUser = await prisma.user.create({
    data: {
      email,
      name: githubUser.name || githubUser.login,
      image: githubUser.avatar_url,
      accounts: {
        create: {
          type: 'oauth',
          provider: 'github',
          providerAccountId: String(githubUser.id),
          access_token: githubToken,
        },
      },
    },
  });

  logger.info({ userId: newUser.id, email }, 'New user registered');
  return { user: newUser, isNewUser: true };
}

/**
 * Step 5: Set HTTP-only cookies and redirect to frontend
 */
function setAuthCookiesAndRedirect(c: Context, tokens: ReturnType<typeof generateTokens>) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Cookie options - domain is optional for multi-region wildcard support
  const cookieOptions = {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax' as const,
    secure: isProduction,
    // Wildcard domain for multi-region (e.g., ".m3w.test3207.fun")
    // Empty = bound to request domain (local dev)
    ...(COOKIE_DOMAIN && { domain: COOKIE_DOMAIN }),
  };

  setCookie(c, 'auth-token', tokens.accessToken, {
    ...cookieOptions,
    maxAge: getAccessTokenExpirySeconds(),
  });

  setCookie(c, 'refresh-token', tokens.refreshToken, {
    ...cookieOptions,
    maxAge: getRefreshTokenExpirySeconds(),
  });

  const frontendUrl = new URL(getFrontendUrl(c));
  frontendUrl.pathname = '/auth/callback';
  frontendUrl.searchParams.set('success', 'true');

  return c.redirect(frontendUrl.toString());
}

/**
 * Get frontend URL for redirects
 * In AIO mode, use request origin (same origin as backend)
 * In separated mode, use CORS_ORIGIN env var
 */
function getFrontendUrl(c: Context): string {
  if (SERVE_FRONTEND) {
    // AIO mode: use request origin or host header
    const origin = c.req.header('origin');
    if (origin) return origin;
    
    const host = c.req.header('host');
    const protocol = c.req.header('x-forwarded-proto') || 'http';
    if (host) return `${protocol}://${host}`;
    
    // Fallback: AIO mode but no origin/host headers (unusual)
    logger.warn('AIO mode but no origin/host headers found, falling back to CORS_ORIGIN');
  }
  
  // Separated mode: use configured CORS_ORIGIN
  return process.env.CORS_ORIGIN || 'http://localhost:3000';
}

/**
 * Create default resources for first-time users
 * - Default Library: "默认音乐库" (cannot be deleted)
 * - Favorites Playlist: "我喜欢的音乐" (cannot be deleted)
 */
async function createDefaultResources(userId: string) {
  try {
    // Create default library (unique ID per user via cuid())
    const defaultLibrary = await prisma.library.create({
      data: {
        name: 'Default Library', // Frontend displays i18n translation via getLibraryDisplayName()
        userId,
        songCount: 0,
        isDefault: true,
        canDelete: false,
      },
    });

    // Create favorites playlist (unique ID per user via cuid())
    const favoritesPlaylist = await prisma.playlist.create({
      data: {
        name: 'Favorites', // Frontend displays i18n translation via getPlaylistDisplayName()
        userId,
        songCount: 0,
        isDefault: true,
        canDelete: false,
      },
    });

    logger.info(
      {
        userId,
        defaultLibraryId: defaultLibrary.id,
        favoritesPlaylistId: favoritesPlaylist.id,
      },
      'Default resources created for new user'
    );

    return { defaultLibrary, favoritesPlaylist };
  } catch (error) {
    logger.error({ error, userId }, 'Failed to create default resources');
    throw error;
  }
}

// GET /api/auth/github - Redirect to GitHub OAuth
app.get('/github', (c: Context) => {
  const state = Math.random().toString(36).substring(7);
  const scope = 'read:user user:email';

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI);
  githubAuthUrl.searchParams.set('scope', scope);
  githubAuthUrl.searchParams.set('state', state);

  return c.redirect(githubAuthUrl.toString());
});

/*
 * OAuth Callback Flow:
 * =====================
 * 1. exchangeCodeForToken()   - Exchange OAuth code for GitHub access token
 * 2. fetchGitHubUser()        - Fetch GitHub profile and verified email
 * 3. checkCrossRegion()       - Redis SETNX to check/claim user region atomically
 * 4a. handleCrossRegionUser() - If user in another region → set cookies + redirect
 * 4b. findOrCreateLocalUser() - Otherwise → find/create local User + Account
 * 5. createDefaultResources() - For new local users: create Library + Playlist
 * 6. setAuthCookiesAndRedirect() - Set HTTP-only cookies, redirect to frontend
 *
 * Note: Both 4a and 4b/5/6 end with cookie+redirect. The difference is:
 * - Cross-region (4a): JWT has isRemote=true, Gateway routes to home region
 * - Local (4b-6): JWT has isRemote=false, requests handled locally
 */
app.get('/callback', async (c: Context) => {
  try {
    // Validate OAuth code
    const code = c.req.query('code');
    if (!code) {
      return c.json({ success: false, error: 'Authorization code not provided' }, 400);
    }

    // Step 1: Exchange code for GitHub token
    const githubToken = await exchangeCodeForToken(code);
    if (!githubToken) {
      logger.error('Failed to exchange code for GitHub token');
      return c.json({ success: false, error: 'Failed to authenticate with GitHub' }, 400);
    }

    // Step 2: Fetch GitHub user profile and email
    const githubData = await fetchGitHubUser(githubToken);
    if (!githubData) {
      return c.json({ success: false, error: 'No email found in GitHub account' }, 400);
    }
    const { user: githubUser, email } = githubData;

    // Step 3: Check cross-region (Redis SETNX)
    // Returns existing region if user registered elsewhere, null if new/local
    const existingRegion = await checkCrossRegion(githubUser.id);

    // Step 4a: Cross-region user → set cookies and redirect (same as local users)
    // JWT.homeRegion tells Gateway where to route future API requests
    if (existingRegion && existingRegion !== HOME_REGION) {
      return handleCrossRegionUser(c, githubUser, email, existingRegion);
    }

    // Step 4b: Local user → find or create in database
    const { user, isNewUser } = await findOrCreateLocalUser(githubUser, email, githubToken);

    // Step 5: Create default resources for new local users
    if (isNewUser) {
      await createDefaultResources(user.id);
    }

    // Step 6: Generate JWT and set cookies
    // homeRegion comes from env var (not stored in DB - only in Redis + JWT)
    const tokens = generateTokens(
      {
        ...user,
        homeRegion: HOME_REGION,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      HOME_REGION,
      false // isRemote = false (local user)
    );

    return setAuthCookiesAndRedirect(c, tokens);
  } catch (error) {
    logger.error({ error }, 'OAuth callback error');

    // Redirect to frontend with error
    const frontendUrl = new URL(getFrontendUrl(c));
    frontendUrl.pathname = '/signin';
    frontendUrl.searchParams.set('error', 'auth_failed');

    return c.redirect(frontendUrl.toString());
  }
});

// POST /api/auth/refresh - Refresh access token
app.post('/refresh', async (c: Context) => {
  try {
    const body = await c.req.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return c.json(
        {
          success: false,
          error: 'Refresh token required',
        },
        400
      );
    }

    const payload = verifyToken(refreshToken);

    if (!payload || payload.type !== 'refresh') {
      return c.json(
        {
          success: false,
          error: 'Invalid refresh token',
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

    // Generate new tokens - homeRegion from original token, not DB
    const homeRegion = payload.homeRegion || HOME_REGION;
    const isRemote = homeRegion !== HOME_REGION;
    const tokens = generateTokens(
      {
        ...user,
        homeRegion,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      homeRegion,
      isRemote
    );

    return c.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Token refresh error');
    return c.json(
      {
        success: false,
        error: 'Failed to refresh token',
      },
      500
    );
  }
});

// GET /api/auth/me - Get current user info (requires auth)
app.get('/me', authMiddleware, async (c: Context) => {
  try {
    const auth = c.get('auth');

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
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

    return c.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch user info');
    return c.json(
      {
        success: false,
        error: 'Failed to fetch user info',
      },
      500
    );
  }
});

// GET /api/auth/session - Get session tokens (requires auth via cookie)
app.get('/session', authMiddleware, async (c: Context) => {
  try {
    const auth = c.get('auth');

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
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

    // Generate fresh tokens for frontend storage
    // homeRegion from env var (this backend's region)
    const tokens = generateTokens(
      {
        ...user,
        homeRegion: HOME_REGION,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      HOME_REGION,
      false
    );

    return c.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get session');
    return c.json(
      {
        success: false,
        error: 'Failed to get session',
      },
      500
    );
  }
});

// POST /api/auth/logout - Logout
app.post('/logout', authMiddleware, async (c: Context) => {
  // Note: Using stateless JWT, no server-side session invalidation needed
  // Client should delete tokens on logout
  return c.json({
    success: true,
  });
});

export default app;
