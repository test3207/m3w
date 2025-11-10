'use server';

import { signIn } from "@/lib/auth/config";

export async function handleGitHubSignIn() {
  await signIn("github", { redirectTo: "/dashboard" });
}
