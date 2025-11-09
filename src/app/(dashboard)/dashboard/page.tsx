'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DASHBOARD_TEXT, COMMON_TEXT } from "@/locales/messages";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import {
  LibrariesCard,
  PlaylistsCard,
  StorageCard,
} from "@/components/features/dashboard-cards";
import { logger } from "@/lib/logger-client";
import type { Library, Playlist } from "@/types/models";

export default function DashboardPage() {
  const router = useRouter();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [librariesRes, playlistsRes] = await Promise.all([
          fetch('/api/libraries'),
          fetch('/api/playlists'),
        ]);

        if (!librariesRes.ok || !playlistsRes.ok) {
          if (librariesRes.status === 401 || playlistsRes.status === 401) {
            router.push('/signin');
            return;
          }
          throw new Error('Failed to fetch data');
        }

        const librariesData = await librariesRes.json();
        const playlistsData = await playlistsRes.json();

        setLibraries(librariesData.data || []);
        setPlaylists(playlistsData.data || []);
      } catch (error) {
        logger.error('Failed to fetch dashboard data', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{COMMON_TEXT.loadingLabel}</div>
      </div>
    );
  }

  return (
    <AdaptiveLayout
      gap={16}
      className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8"
    >
      <AdaptiveSection
        id="dashboard-overview"
        baseSize={360}
        minSize={240}
        className="pt-4"
      >
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">
              {DASHBOARD_TEXT.navbar.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid flex-1 gap-3 overflow-auto md:grid-cols-2">
            <LibrariesCard libraries={libraries} />
            <PlaylistsCard playlists={playlists} />
          </CardContent>
        </Card>
      </AdaptiveSection>

      <AdaptiveSection
        id="dashboard-storage"
        baseSize={220}
        minSize={160}
        className="pb-4"
        allowOverflow
      >
        <div className="h-full overflow-auto">
          <StorageCard />
        </div>
      </AdaptiveSection>
    </AdaptiveLayout>
  );
}
