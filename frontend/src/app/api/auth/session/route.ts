import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { logger } from '@/lib/logger';
import { I18n } from '@/locales/i18n';
import { HttpStatusCode } from '@/lib/constants/http-status';

/**
 * GET /api/auth/session
 * Check if user has a valid session
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: I18n.error.unauthorized },
        { status: HttpStatusCode.UNAUTHORIZED }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        },
      },
    });
  } catch (error) {
    logger.error({ msg: 'Session check failed', error });
    return NextResponse.json(
      { error: I18n.error.unauthorized },
      { status: HttpStatusCode.UNAUTHORIZED }
    );
  }
}
