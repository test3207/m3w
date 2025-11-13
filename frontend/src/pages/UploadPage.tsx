import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import { UploadSongForm } from "@/components/features/upload/upload-song-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { ApiError } from "@/lib/api/client";
import { LIBRARIES_QUERY_KEY } from "@/hooks/useLibraries";
import { useLibraryStore } from "@/stores/libraryStore";
import { usePlaylistStore } from "@/stores/playlistStore";
import type { LibraryOption } from "@/types/models";

export default function UploadPage() {
  useLocale();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { libraries, fetchLibraries } = useLibraryStore();
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists);
  const [librariesList, setLibrariesList] = useState<LibraryOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        await fetchLibraries();
      } catch (error) {
        logger.error('Failed to fetch libraries', error);
        
        if (error instanceof ApiError && error.status === 401) {
          navigate('/signin');
          return;
        }
        
        toast({
          variant: "destructive",
          title: I18n.error.failedToRetrieveLibraries,
        });
      } finally {
        setLoading(false);
      }
    };

    void loadLibraries();
  }, [navigate, toast, fetchLibraries]);

  // Watch libraries changes (from upload/delete events)
  useEffect(() => {
    console.log('[UploadPage] Libraries changed, count:', libraries.length);
    const libraryOptions = libraries.map((library) => ({
      id: library.id,
      name: library.name,
      description: library.description ?? null,
      songCount: library._count?.songs ?? 0,
    }));
    
    console.log('[UploadPage] Updated librariesList:', libraryOptions);
    setLibrariesList(libraryOptions);
  }, [libraries]); // Re-run when libraries array changes

  const refetchLibraries = async () => {
    try {
      console.log('[UploadPage] refetchLibraries called');
      // Refresh libraries store (updates global state)
      await fetchLibraries();
      console.log('[UploadPage] fetchLibraries completed');
      
      // Refresh playlists
      await fetchPlaylists();
      console.log('[UploadPage] fetchPlaylists completed');
      
      // Invalidate TanStack Query cache to update dashboard counts
      queryClient.invalidateQueries({ queryKey: LIBRARIES_QUERY_KEY });
    } catch (error) {
      logger.error('Failed to refetch libraries', error);
      
      toast({
        variant: "destructive",
        title: I18n.error.failedToRetrieveLibraries,
      });
    }
  };

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
        id="upload-header"
        baseSize={200}
        minSize={150}
        className="pt-4"
      >
        <div className="flex h-full flex-col justify-end">
          <PageHeader
            title={I18n.upload.page.title}
            description={I18n.upload.page.description}
          />
        </div>
      </AdaptiveSection>

      <AdaptiveSection
        id="upload-content"
        baseSize={480}
        minSize={320}
        className="pb-4"
      >
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>{I18n.upload.page.cardTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {librariesList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {I18n.upload.page.emptyState}
              </p>
            ) : (
              <UploadSongForm libraries={librariesList} onUploadSuccess={refetchLibraries} />
            )}
          </CardContent>
        </Card>
      </AdaptiveSection>
    </AdaptiveLayout>
  );
}
