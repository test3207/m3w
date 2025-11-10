import { signOut } from '@/lib/auth/config';
import { logger } from '@/lib/logger';
import { I18n } from '@/locales/i18n';

export async function POST() {
  try {
    await signOut({ redirectTo: '/' });
    return Response.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Sign out error');
    return Response.json({ error: I18n.error.failedToSignOut }, { status: 500 });
  }
}
