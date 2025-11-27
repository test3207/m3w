/**
 * Authentication Routes (Hono Backend)
 * Admin routes - online only
 */

import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { generateTokens, verifyToken } from '../lib/jwt';
import { authMiddleware } from '../lib/auth-middleware';
import type { Context } from 'hono';

const app = new Hono();

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI =
  process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/api/auth/callback';

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
        isDefault: true,
        canDelete: false,
      },
    });

    // Create favorites playlist (unique ID per user via cuid())
    const favoritesPlaylist = await prisma.playlist.create({
      data: {
        name: 'Favorites', // Frontend displays i18n translation via getPlaylistDisplayName()
        userId,
        songIds: [],
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

// GET /api/auth/callback - GitHub OAuth callback
app.get('/callback', async (c: Context) => {
  try {
    const code = c.req.query('code');
    // const state = c.req.query('state'); // TODO: Validate state for CSRF protection

    if (!code) {
      return c.json(
        {
          success: false,
          error: 'Authorization code not provided',
        },
        400
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
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

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
    };

    if (!tokenData.access_token) {
      logger.error({ tokenData }, 'Failed to get GitHub access token');
      return c.json(
        {
          success: false,
          error: 'Failed to authenticate with GitHub',
        },
        400
      );
    }

    const githubToken = tokenData.access_token;

    // Fetch user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/json',
      },
    });

    const githubUser = (await userResponse.json()) as GitHubUser;

    // Fetch user emails if primary email is not available
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/json',
        },
      });

      const emails = (await emailsResponse.json()) as GitHubEmail[];
      const primaryEmail = emails.find((e) => e.primary && e.verified);
      email = primaryEmail?.email || emails[0]?.email || null;
    }

    if (!email) {
      return c.json(
        {
          success: false,
          error: 'No email found in GitHub account',
        },
        400
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    let isNewUser = false;
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: githubUser.name || githubUser.login,
          image: githubUser.avatar_url,
        },
      });

      isNewUser = true;
      logger.info({ userId: user.id, email }, 'New user registered via GitHub');
    }

    // Create default resources for first-time users
    if (isNewUser) {
      await createDefaultResources(user.id);
    }

    // Create or update account record
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId: String(githubUser.id),
        },
      },
      create: {
        userId: user.id,
        type: 'oauth',
        provider: 'github',
        providerAccountId: String(githubUser.id),
        access_token: githubToken,
      },
      update: {
        access_token: githubToken,
      },
    });

    // Generate JWT tokens
    const tokens = generateTokens({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });

    // Set HTTP-only cookies for tokens (more secure than URL params)
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieMaxAge = 6 * 60 * 60; // 6 hours in seconds
    const refreshCookieMaxAge = 90 * 24 * 60 * 60; // 90 days in seconds
    
    // Set auth token cookie
    setCookie(c, 'auth-token', tokens.accessToken, {
      httpOnly: true,
      path: '/',
      sameSite: 'Lax',
      maxAge: cookieMaxAge,
      secure: isProduction,
    });
    
    // Set refresh token cookie
    setCookie(c, 'refresh-token', tokens.refreshToken, {
      httpOnly: true,
      path: '/',
      sameSite: 'Lax',
      maxAge: refreshCookieMaxAge,
      secure: isProduction,
    });

    // Redirect to frontend success page (tokens are in HTTP-only cookies)
    const frontendUrl = new URL(getFrontendUrl(c));
    frontendUrl.pathname = '/auth/callback';
    frontendUrl.searchParams.set('success', 'true');

    return c.redirect(frontendUrl.toString());
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

    // Generate new tokens
    const tokens = generateTokens({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });

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
    const tokens = generateTokens({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });

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
