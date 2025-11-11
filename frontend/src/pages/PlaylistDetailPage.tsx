import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListItem, MetadataItem } from "@/components/ui/list-item";
import { HStack } from "@/components/ui/stack";
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { formatDuration } from "@/lib/utils/format-duration";
import { PlaylistSongControls } from "@/components/features/playlists/playlist-song-controls";
import { useAudioPlayer } from "@/lib/audio/useAudioPlayer";
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { apiClient, ApiError } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/api-config";
import type { Playlist, Song } from "@/types/models";

export default function PlaylistDetailPage() {
  useLocale();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { refreshCurrentPlaylistQueue } = useAudioPlayer();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!id) return;

    try {
      const [playlistData, songsData] = await Promise.all([
        apiClient.get<{ success: boolean; data: Playlist }>(API_ENDPOINTS.playlists.detail(id)),
        apiClient.get<{ success: boolean; data: Song[] }>(API_ENDPOINTS.playlists.songs(id)),
      ]);

      setPlaylist(playlistData.data);
      setSongs(songsData.data || []);
    } catch (error) {
      logger.error('Failed to fetch playlist', error);
      
      if (error instanceof ApiError) {
        if (error.status === 401) {
          navigate('/signin');
          return;
        }
        
        if (error.status === 404) {
          toast({
            variant: "destructive",
            title: I18n.error.playlistNotFoundOrUnauthorized,
          });
          navigate('/dashboard/playlists');
          return;
        }
        
        toast({
          variant: "destructive",
          title: I18n.error.failedToGetPlaylists,
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
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{I18n.common.loadingLabel}</div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{I18n.common.notFoundLabel}</div>
      </div>
    );
  }

  const totalDuration = songs.reduce((sum, song) => sum + (song.file?.duration ?? 0), 0);

  return (
    <AdaptiveLayout
      gap={16}
      className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8"
    >
      <AdaptiveSection
        id="playlist-detail-header"
        baseSize={200}
        minSize={150}
        className="pt-4"
      >
        <div className="flex h-full flex-col justify-end gap-3">
          <Button variant="ghost" size="sm" className="w-fit" asChild>
            <Link to="/dashboard/playlists">{I18n.playlist.detail.backToPlaylists}</Link>
          </Button>

          <PageHeader
            title={`${I18n.playlist.detail.titlePrefix}${playlist.name}`}
            description={I18n.playlist.detail.description}
          />
        </div>
      </AdaptiveSection>

      <AdaptiveSection
        id="playlist-detail-content"
        baseSize={560}
        minSize={340}
        className="pb-4"
      >
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader>
            <HStack justify="between" align="center">
              <div className="flex flex-col gap-1">
                <CardTitle>{I18n.playlist.detail.songListTitle}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {I18n.playlist.detail.playlistDurationLabel}: {formatDuration(totalDuration)}
                </p>
              </div>

              <MetadataItem
                label={I18n.playlist.detail.songCountLabel}
                value={songs.length}
                variant="secondary"
              />
            </HStack>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {songs.length === 0 ? (
                <EmptyState
                  icon="📻"
                  title={I18n.playlist.detail.songListEmpty}
                  description={I18n.playlist.detail.addedFromLibraryHelper}
                  action={
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/dashboard/libraries">
                        {I18n.playlist.detail.manageLibrariesCta}
                      </Link>
                    </Button>
                  }
                />
            ) : (
              <ul role="list" className="flex flex-col gap-3">
                {songs.map((song, index) => (
                  <li key={song.id}>
                    <ListItem
                      title={song.title}
                      description={song.artist || undefined}
                      metadata={
                        <HStack as="div" gap="xs" wrap>
                          {song.library ? (
                            <MetadataItem
                              label={I18n.playlist.detail.songLibraryLabel}
                              value={song.library.name}
                              variant="default"
                            />
                          ) : null}
                          {song.album ? (
                            <MetadataItem
                              label={I18n.playlist.detail.songAlbumLabel}
                              value={song.album}
                              variant="outline"
                            />
                          ) : null}
                          <MetadataItem
                            label={I18n.playlist.detail.songDurationLabel}
                            value={formatDuration(song.file?.duration ?? null)}
                            variant="secondary"
                          />
                        </HStack>
                      }
                      actions={
                        <PlaylistSongControls
                          playlistId={playlist.id}
                          songId={song.id}
                          songTitle={song.title}
                          index={index}
                          total={songs.length}
                          onMutate={fetchData}
                          onPlaylistUpdated={refreshCurrentPlaylistQueue}
                        />
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </AdaptiveSection>
    </AdaptiveLayout>
  );
}
