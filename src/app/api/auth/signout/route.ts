import { signOut } from '@/lib/auth/config';
import { logger } from '@/lib/logger';
import { ERROR_MESSAGES } from '@/locales/messages';

export async function POST() {
  try {
    await signOut({ redirectTo: '/' });
    return Response.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Sign out error');
    return Response.json({ error: ERROR_MESSAGES.failedToSignOut }, { status: 500 });
  }
}
