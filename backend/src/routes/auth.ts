/**
 * Authentication Routes (Hono Backend)
 * Admin routes - online only
 */

import { Hono } from 'hono';
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

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: githubUser.name || githubUser.login,
          image: githubUser.avatar_url,
        },
      });

      logger.info({ userId: user.id, email }, 'New user registered via GitHub');
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
    const tokens = generateTokens(user);

    // Set cookie for Service Worker and direct browser requests
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieMaxAge = 6 * 60 * 60; // 6 hours
    c.header(
      'Set-Cookie',
      `auth-token=${tokens.accessToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${cookieMaxAge}${isProduction ? '; Secure' : ''}`
    );

    // Redirect to frontend with tokens
    const frontendUrl = new URL(process.env.CORS_ORIGIN || 'http://localhost:3000');
    frontendUrl.pathname = '/auth/callback';
    frontendUrl.searchParams.set('access_token', tokens.accessToken);
    frontendUrl.searchParams.set('refresh_token', tokens.refreshToken);

    return c.redirect(frontendUrl.toString());
  } catch (error) {
    logger.error({ error }, 'OAuth callback error');
    return c.json(
      {
        success: false,
        error: 'Authentication failed',
      },
      500
    );
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
    const tokens = generateTokens(user);

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

// POST /api/auth/logout - Logout (optional: could invalidate tokens in Redis)
app.post('/logout', authMiddleware, async (c: Context) => {
  // TODO: Add token to blacklist in Redis if needed
  return c.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default app;
