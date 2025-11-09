'use client';

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListItem, MetadataItem } from "@/components/ui/list-item";
import { HStack } from "@/components/ui/stack";
import { PLAYLIST_TEXT, COMMON_TEXT, ERROR_MESSAGES } from "@/locales/messages";
import { formatDuration } from "@/lib/utils/format-duration";
import { PlaylistSongControls } from "@/components/features/playlists/playlist-song-controls";
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { HttpStatusCode } from "@/lib/constants/http-status";
import type { Playlist } from "@/types/models";

export default function PlaylistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { toast } = useToast();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlaylist = async () => {
    if (!id) return;

    try {
      const res = await fetch(`/api/playlists/${id}`);

      // Check authentication first
      if (res.status === HttpStatusCode.UNAUTHORIZED) {
        router.push('/signin');
        return;
      }

      // Check if playlist exists
      if (res.status === HttpStatusCode.NOT_FOUND) {
        toast({
          variant: "destructive",
          title: ERROR_MESSAGES.playlistNotFoundOrUnauthorized,
        });
        router.push('/dashboard/playlists');
        return;
      }

      // Log status code for debugging
      logger.info('Fetch response', { status: res.status });

      // Check for other errors
      if (!res.ok) {
        logger.error('Failed to fetch playlist', { status: res.status });
        toast({
          variant: "destructive",
          title: ERROR_MESSAGES.failedToGetPlaylists,
          description: `Status: ${res.status}`,
        });
        return;
      }

      const data = await res.json();
      setPlaylist(data.data);
    } catch (error) {
      logger.error('Failed to fetch playlist', error);
      toast({
        variant: "destructive",
        title: ERROR_MESSAGES.genericTryAgain,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router, toast]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{COMMON_TEXT.loadingLabel}</div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{COMMON_TEXT.notFoundLabel}</div>
      </div>
    );
  }

  const songs = playlist.songs ?? [];
  const totalDuration = songs.reduce((sum, item) => sum + (item.song.file?.duration ?? 0), 0);

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
            <Link href="/dashboard/playlists">{PLAYLIST_TEXT.detail.backToPlaylists}</Link>
          </Button>

          <PageHeader
            title={`${PLAYLIST_TEXT.detail.titlePrefix}${playlist.name}`}
            description={PLAYLIST_TEXT.detail.description}
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
                <CardTitle>{PLAYLIST_TEXT.detail.songListTitle}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {PLAYLIST_TEXT.detail.playlistDurationLabel}: {formatDuration(totalDuration)}
                </p>
              </div>

              <MetadataItem
                label={PLAYLIST_TEXT.detail.songCountLabel}
                value={songs.length}
                variant="secondary"
              />
            </HStack>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {songs.length === 0 ? (
                <EmptyState
                  icon="📻"
                  title={PLAYLIST_TEXT.detail.songListEmpty}
                  description={PLAYLIST_TEXT.detail.addedFromLibraryHelper}
                  action={
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard/libraries">
                        {PLAYLIST_TEXT.detail.manageLibrariesCta}
                      </Link>
                    </Button>
                  }
                />
            ) : (
              <ul role="list" className="flex flex-col gap-3">
                {songs.map((item, index) => (
                  <li key={item.song.id}>
                    <ListItem
                      title={item.song.title}
                      description={item.song.artist || undefined}
                      metadata={
                        <HStack as="div" gap="xs" wrap>
                          {item.song.album ? (
                            <MetadataItem
                              label={PLAYLIST_TEXT.detail.songAlbumLabel}
                              value={item.song.album}
                              variant="outline"
                            />
                          ) : null}
                          <MetadataItem
                            label={PLAYLIST_TEXT.detail.songDurationLabel}
                            value={formatDuration(item.song.file?.duration ?? null)}
                            variant="secondary"
                          />
                        </HStack>
                      }
                      actions={
                        <PlaylistSongControls
                          playlistId={playlist.id}
                          songId={item.song.id}
                          songTitle={item.song.title}
                          index={index}
                          total={songs.length}
                          onMutate={fetchPlaylist}
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
