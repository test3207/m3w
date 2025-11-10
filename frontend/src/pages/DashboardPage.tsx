import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { I18n } from "@/locales/i18n";
import { useLocale } from "@/locales/use-locale";
import { useToast } from "@/components/ui/use-toast";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import {
  LibrariesCard,
  PlaylistsCard,
  StorageCard,
} from "@/components/features/dashboard-cards";
import { useLibraries } from "@/hooks/useLibraries";
import { usePlaylists } from "@/hooks/usePlaylists";
import { HttpStatusCode } from "@/lib/constants/http-status";
import { ApiError } from "@/lib/api/client";

export default function DashboardPage() {
  useLocale();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch data with TanStack Query
  const { 
    data: libraries = [], 
    isLoading: librariesLoading,
    error: librariesError 
  } = useLibraries();

  const { 
    data: playlists = [], 
    isLoading: playlistsLoading,
    error: playlistsError 
  } = usePlaylists();

  // Handle authentication errors with useEffect
  useEffect(() => {
    if (librariesError instanceof ApiError && librariesError.status === HttpStatusCode.UNAUTHORIZED) {
      navigate('/signin');
    }
  }, [librariesError, navigate]);

  useEffect(() => {
    if (playlistsError instanceof ApiError && playlistsError.status === HttpStatusCode.UNAUTHORIZED) {
      navigate('/signin');
    }
  }, [playlistsError, navigate]);

  // Show error toasts with useEffect
  useEffect(() => {
    if (librariesError && !(librariesError instanceof ApiError && librariesError.status === HttpStatusCode.UNAUTHORIZED)) {
      toast({
        title: "Failed to load libraries",
        description: librariesError instanceof Error ? librariesError.message : 'Unknown error',
        variant: "destructive",
      });
    }
  }, [librariesError, toast]);

  useEffect(() => {
    if (playlistsError && !(playlistsError instanceof ApiError && playlistsError.status === HttpStatusCode.UNAUTHORIZED)) {
      toast({
        title: "Failed to load playlists",
        description: playlistsError instanceof Error ? playlistsError.message : 'Unknown error',
        variant: "destructive",
      });
    }
  }, [playlistsError, toast]);

  const isLoading = librariesLoading || playlistsLoading;

  if (isLoading) {
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
