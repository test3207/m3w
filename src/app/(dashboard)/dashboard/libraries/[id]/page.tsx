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
import { LIBRARY_TEXT, COMMON_TEXT } from "@/locales/messages";
import { formatDuration } from "@/lib/utils/format-duration";
import { AddSongToPlaylistForm } from "@/components/features/libraries/add-song-to-playlist-form";
import { logger } from "@/lib/logger-client";

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
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

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

        if (!libraryRes.ok || !songsRes.ok || !playlistsRes.ok) {
          if (libraryRes.status === 401 || songsRes.status === 401 || playlistsRes.status === 401) {
            router.push('/signin');
            return;
          }
          if (libraryRes.status === 404) {
            router.push('/dashboard/libraries');
            return;
          }
          throw new Error('Failed to fetch data');
        }

        const libraryData = await libraryRes.json();
        const songsData = await songsRes.json();
        const playlistsData = await playlistsRes.json();

        setLibrary(libraryData.data);
        setSongs(songsData.data || []);
        setPlaylists(playlistsData.data || []);
      } catch (error) {
        logger.error('Failed to fetch library details', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id, router]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{COMMON_TEXT.loadingLabel}</div>
      </div>
    );
  }

  if (!library) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{COMMON_TEXT.notFoundLabel}</div>
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
            <Link href="/dashboard/libraries">{LIBRARY_TEXT.detail.backToLibraries}</Link>
          </Button>

          <PageHeader
            title={`${LIBRARY_TEXT.detail.titlePrefix}${library.name}`}
            description={LIBRARY_TEXT.detail.description}
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
              <CardTitle>{LIBRARY_TEXT.detail.songListTitle}</CardTitle>
              <HStack as="div" gap="sm" align="center" wrap>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/upload">{LIBRARY_TEXT.detail.uploadSongsCta}</Link>
                </Button>
                <MetadataItem
                  label={LIBRARY_TEXT.detail.songCountLabel}
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
                title={LIBRARY_TEXT.detail.songListEmpty}
                description={LIBRARY_TEXT.detail.songListEmptyHelper}
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
                              label={LIBRARY_TEXT.detail.songAlbumLabel}
                              value={song.album}
                              variant="outline"
                            />
                          ) : null}
                          <MetadataItem
                            label={LIBRARY_TEXT.detail.songDurationLabel}
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
                {LIBRARY_TEXT.detail.noPlaylistsHelper}{" "}
                <Link
                  href="/dashboard/playlists"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {LIBRARY_TEXT.detail.goToPlaylistsLink}
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
