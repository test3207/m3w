'use server';

import { signOut } from '@/lib/auth/config';

export async function signOutUser() {
  await signOut({ redirectTo: '/' });
}
