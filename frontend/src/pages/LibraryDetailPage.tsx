import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import { PageHeader } from "@/components/ui/page-header";
import { HStack } from "@/components/ui/stack";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListItem, MetadataItem } from "@/components/ui/list-item";
import { I18n } from "@/locales/i18n";
import { useLocale } from "@/locales/use-locale";
import { formatDuration } from "@/lib/utils/format-duration";
import { AddSongToPlaylistForm } from "@/components/features/libraries/add-song-to-playlist-form";
import { DeleteSongButton } from "@/components/features/libraries/delete-song-button";
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { apiClient, ApiError } from "@/lib/api/client";
import type { Song, Library, PlaylistOption } from "@/types/models";

export default function LibraryDetailPage() {
  useLocale();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [library, setLibrary] = useState<Library | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    
    try {
      const [libraryData, songsData, playlistsData] = await Promise.all([
        apiClient.get<{ success: boolean; data: Library }>(`/libraries/${id}`),
        apiClient.get<{ success: boolean; data: Song[] }>(`/libraries/${id}/songs`),
        apiClient.get<{ success: boolean; data: PlaylistOption[] }>('/playlists'),
      ]);

      setLibrary(libraryData.data);
      setSongs(songsData.data || []);
      setPlaylists(playlistsData.data || []);
    } catch (error) {
      logger.error('Failed to fetch library details', error);
      
      if (error instanceof ApiError) {
        if (error.status === 401) {
          navigate('/signin');
          return;
        }
        
        if (error.status === 404) {
          toast({
            variant: "destructive",
            title: I18n.error.libraryNotFound,
          });
          navigate('/dashboard/libraries');
          return;
        }
        
        toast({
          variant: "destructive",
          title: I18n.error.failedToRetrieveLibraries,
          description: error.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: I18n.error.genericTryAgain,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{I18n.common.loadingLabel}</div>
      </div>
    );
  }

  if (!library) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{I18n.common.notFoundLabel}</div>
      </div>
    );
  }

  const playlistOptions = playlists.map((playlist) => ({ id: playlist.id, name: playlist.name }));

  return (
    <AdaptiveLayout
      gap={16}
      className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8"
    >
      <AdaptiveSection
        id="library-detail-header"
        baseSize={200}
        minSize={150}
        className="pt-4"
      >
        <div className="flex h-full flex-col justify-end gap-3">
          <Button variant="ghost" size="sm" className="w-fit" asChild>
            <Link to="/dashboard/libraries">{I18n.library.detail.backToLibraries}</Link>
          </Button>

          <PageHeader
            title={`${I18n.library.detail.titlePrefix}${library.name}`}
            description={I18n.library.detail.description}
          />
        </div>
      </AdaptiveSection>

      <AdaptiveSection
        id="library-detail-content"
        baseSize={560}
        minSize={340}
        className="pb-4"
      >
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader>
            <HStack justify="between" align="center" wrap>
              <CardTitle>{I18n.library.detail.songListTitle}</CardTitle>
              <HStack as="div" gap="sm" align="center" wrap>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/dashboard/upload">{I18n.library.detail.uploadSongsCta}</Link>
                </Button>
                <MetadataItem
                  label={I18n.library.detail.songCountLabel}
                  value={songs.length}
                  variant="secondary"
                />
              </HStack>
            </HStack>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {songs.length === 0 ? (
              <EmptyState
                icon="🎵"
                title={I18n.library.detail.songListEmpty}
                description={I18n.library.detail.songListEmptyHelper}
              />
            ) : (
              <ul role="list" className="flex flex-col gap-3">
                {songs.map((song) => (
                  <li key={song.id}>
                    <ListItem
                      title={song.title}
                      description={song.artist || undefined}
                      metadata={
                        <HStack as="div" gap="xs" wrap>
                          {song.album ? (
                            <MetadataItem
                              label={I18n.library.detail.songAlbumLabel}
                              value={song.album}
                              variant="outline"
                            />
                          ) : null}
                          <MetadataItem
                            label={I18n.library.detail.songDurationLabel}
                            value={formatDuration(song.file?.duration ?? null)}
                            variant="secondary"
                          />
                        </HStack>
                      }
                      actions={
                        <HStack as="div" gap="xs">
                          <AddSongToPlaylistForm
                            songId={song.id}
                            songTitle={song.title}
                            libraryId={library.id}
                            playlists={playlistOptions}
                            onAddSuccess={fetchData}
                          />
                          <DeleteSongButton
                            songId={song.id}
                            songTitle={song.title}
                            onDeleteSuccess={fetchData}
                          />
                        </HStack>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

            {playlists.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {I18n.library.detail.noPlaylistsHelper}{" "}
                <Link
                  to="/dashboard/playlists"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {I18n.library.detail.goToPlaylistsLink}
                </Link>
                .
              </p>
            ) : null}
          </CardContent>
        </Card>
      </AdaptiveSection>
    </AdaptiveLayout>
  );
}
