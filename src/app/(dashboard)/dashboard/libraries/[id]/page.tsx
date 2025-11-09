'use client';

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
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
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { HttpStatusCode } from "@/lib/constants/http-status";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  file: {
    duration: number | null;
  };
}

interface Library {
  id: string;
  name: string;
  description: string | null;
}

interface Playlist {
  id: string;
  name: string;
}

export default function LibraryDetailPage() {
  useLocale(); // Subscribe to locale changes
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { toast } = useToast();

  const [library, setLibrary] = useState<Library | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      try {
        const [libraryRes, songsRes, playlistsRes] = await Promise.all([
          fetch(`/api/libraries/${id}`),
          fetch(`/api/libraries/${id}/songs`),
          fetch('/api/playlists'),
        ]);

        // Check authentication first
        if (libraryRes.status === HttpStatusCode.UNAUTHORIZED || songsRes.status === HttpStatusCode.UNAUTHORIZED || playlistsRes.status === HttpStatusCode.UNAUTHORIZED) {
          router.push('/signin');
          return;
        }

        // Check if library exists
        if (libraryRes.status === HttpStatusCode.NOT_FOUND) {
          toast({
            variant: "destructive",
            title: I18n.error.libraryNotFound,
          });
          router.push('/dashboard/libraries');
          return;
        }

        // Log status codes for debugging
        logger.info('Fetch responses', {
          libraryStatus: libraryRes.status,
          songsStatus: songsRes.status,
          playlistsStatus: playlistsRes.status,
        });

        // Check for other errors
        if (!libraryRes.ok || !songsRes.ok || !playlistsRes.ok) {
          const errors = [];
          if (!libraryRes.ok) errors.push(`Library: ${libraryRes.status}`);
          if (!songsRes.ok) errors.push(`Songs: ${songsRes.status}`);
          if (!playlistsRes.ok) errors.push(`Playlists: ${playlistsRes.status}`);
          
          logger.error('Failed to fetch data', { errors });
          toast({
            variant: "destructive",
            title: I18n.error.failedToRetrieveLibraries,
            description: errors.join(', '),
          });
          return;
        }

        const libraryData = await libraryRes.json();
        const songsData = await songsRes.json();
        const playlistsData = await playlistsRes.json();

        setLibrary(libraryData.data);
        setSongs(songsData.data || []);
        setPlaylists(playlistsData.data || []);
      } catch (error) {
        logger.error('Failed to fetch library details', error);
        toast({
          variant: "destructive",
          title: I18n.error.genericTryAgain,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id, router, toast]);

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
            <Link href="/dashboard/libraries">{I18n.library.detail.backToLibraries}</Link>
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
                  <Link href="/dashboard/upload">{I18n.library.detail.uploadSongsCta}</Link>
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
                        <AddSongToPlaylistForm
                          songId={song.id}
                          songTitle={song.title}
                          libraryId={library.id}
                          playlists={playlistOptions}
                        />
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
                  href="/dashboard/playlists"
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
