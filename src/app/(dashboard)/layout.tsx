'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MiniPlayer } from "@/components/features/mini-player";
import { PlaybackInitializer } from "@/components/features/playback-initializer";
import { DashboardNavbar } from "@/components/layouts/dashboard-navbar";
import { DashboardLayoutShell } from "@/components/layouts/dashboard-layout-shell";
import { logger } from "@/lib/logger-client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/session');
        if (!res.ok) {
          router.push('/signin');
        }
      } catch (error) {
        logger.error('Failed to check auth', error);
        router.push('/signin');
      }
    }

    checkAuth();
  }, [router]);

  return (
    <DashboardLayoutShell
      header={
        <>
          <PlaybackInitializer />
          <DashboardNavbar />
        </>
      }
      footer={<MiniPlayer />}
    >
      {children}
    </DashboardLayoutShell>
  );
}
