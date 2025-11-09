import { signOut } from '@/lib/auth/config';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    await signOut({ redirectTo: '/' });
    return Response.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Sign out error');
    return Response.json({ error: 'Failed to sign out' }, { status: 500 });
  }
}
