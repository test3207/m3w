import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getLibraryById } from "@/lib/services/library.service";
import { getSongsByLibrary } from "@/lib/services/song.service";
import { getUserPlaylists } from "@/lib/services/playlist.service";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import { PageHeader } from "@/components/ui/page-header";
import { HStack } from "@/components/ui/stack";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListItem, MetadataItem } from "@/components/ui/list-item";
import { UI_TEXT } from "@/locales/messages";
import { formatDuration } from "@/lib/utils/format-duration";
import { AddSongToPlaylistForm } from "@/components/features/libraries/add-song-to-playlist-form";

interface LibraryDetailPageProps {
  params: {
    id: string;
  };
}

export default async function LibraryDetailPage({ params }: LibraryDetailPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const [library, songs, playlists] = await Promise.all([
    getLibraryById(params.id, session.user.id),
    getSongsByLibrary(params.id, session.user.id),
    getUserPlaylists(session.user.id),
  ]);

  if (!library) {
    notFound();
  }

  const librarySongs = songs ?? [];
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
            <Link href="/dashboard/libraries">{UI_TEXT.libraryManager.backToLibraries}</Link>
          </Button>

          <PageHeader
            title={`${UI_TEXT.libraryManager.detailTitlePrefix}${library.name}`}
            description={UI_TEXT.libraryManager.detailDescription}
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
            <HStack justify="between" align="center">
              <CardTitle>{UI_TEXT.libraryManager.songListTitle}</CardTitle>
              <MetadataItem
                label={UI_TEXT.libraryManager.songCountLabel}
                value={librarySongs.length}
                variant="secondary"
              />
            </HStack>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {librarySongs.length === 0 ? (
              <EmptyState
                icon="🎵"
                title={UI_TEXT.libraryManager.songListEmpty}
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/upload">Upload Songs</Link>
                  </Button>
                }
              />
            ) : (
              <ul role="list" className="flex flex-col gap-3">
                {librarySongs.map((song) => (
                  <li key={song.id}>
                    <ListItem
                      title={song.title}
                      description={song.artist || undefined}
                      metadata={
                        <HStack as="div" gap="xs" wrap>
                          {song.album ? (
                            <MetadataItem
                              label={UI_TEXT.libraryManager.songAlbumLabel}
                              value={song.album}
                              variant="outline"
                            />
                          ) : null}
                          <MetadataItem
                            label={UI_TEXT.libraryManager.songDurationLabel}
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
                {UI_TEXT.libraryManager.noPlaylistsHelper}{" "}
                <Link
                  href="/dashboard/playlists"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {UI_TEXT.libraryManager.goToPlaylistsLink}
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
