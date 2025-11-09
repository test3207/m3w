'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { I18n } from "@/locales/i18n";
import { useLocale } from "@/locales/use-locale";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import {
  LibrariesCard,
  PlaylistsCard,
  StorageCard,
} from "@/components/features/dashboard-cards";
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { HttpStatusCode } from "@/lib/constants/http-status";
import type { Library, Playlist } from "@/types/models";

export default function DashboardPage() {
  useLocale(); // Subscribe to locale changes
  const router = useRouter();
  const { toast } = useToast();
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

        // Check authentication first
        if (librariesRes.status === HttpStatusCode.UNAUTHORIZED || playlistsRes.status === HttpStatusCode.UNAUTHORIZED) {
          router.push('/signin');
          return;
        }

        // Log status codes for debugging
        logger.info('Fetch responses', {
          librariesStatus: librariesRes.status,
          playlistsStatus: playlistsRes.status,
        });

        // Check for other errors
        if (!librariesRes.ok || !playlistsRes.ok) {
          const errors = [];
          if (!librariesRes.ok) errors.push(`Libraries: ${librariesRes.status}`);
          if (!playlistsRes.ok) errors.push(`Playlists: ${playlistsRes.status}`);
          
          logger.error('Failed to fetch data', { errors });
          toast({
            variant: "destructive",
            title: I18n.error.failedToRetrieveLibraries,
            description: errors.join(', '),
          });
          return;
        }

        const librariesData = await librariesRes.json();
        const playlistsData = await playlistsRes.json();

        setLibraries(librariesData.data || []);
        setPlaylists(playlistsData.data || []);
      } catch (error) {
        logger.error('Failed to fetch dashboard data', error);
        toast({
          variant: "destructive",
          title: I18n.error.genericTryAgain,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router, toast]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{I18n.common.loadingLabel}</div>
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
              {I18n.dashboard.navbar.title}
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
