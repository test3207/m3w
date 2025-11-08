import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth/config";
import {
  getPlaylistById,
} from "@/lib/services/playlist.service";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListItem, MetadataItem } from "@/components/ui/list-item";
import { HStack, VStack } from "@/components/ui/stack";
import { UI_TEXT } from "@/locales/messages";
import { formatDuration } from "@/lib/utils/format-duration";
import { PlaylistSongControls } from "@/components/features/playlists/playlist-song-controls";

interface PlaylistDetailPageProps {
  params: {
    id: string;
  };
}

export default async function PlaylistDetailPage({ params }: PlaylistDetailPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const playlist = await getPlaylistById(params.id, session.user.id);

  if (!playlist) {
    notFound();
  }

  const songs = playlist.songs;
  const totalDuration = songs.reduce((sum, item) => sum + (item.song.file?.duration ?? 0), 0);

  return (
  <Container as="main" className="py-8">
      <VStack gap="lg">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/dashboard/playlists">{UI_TEXT.playlistBuilder.backToPlaylists}</Link>
        </Button>

        <PageHeader
          title={`${UI_TEXT.playlistBuilder.detailTitlePrefix}${playlist.name}`}
          description={UI_TEXT.playlistBuilder.detailDescription}
        />

        <Card>
          <CardHeader>
            <HStack justify="between" align="center">
              <div className="flex flex-col gap-1">
                <CardTitle>{UI_TEXT.playlistBuilder.songListTitle}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {UI_TEXT.playlistBuilder.playlistDurationLabel}: {formatDuration(totalDuration)}
                </p>
              </div>

              <MetadataItem
                label={UI_TEXT.playlistBuilder.songCountLabel}
                value={songs.length}
                variant="secondary"
              />
            </HStack>
          </CardHeader>
          <CardContent>
            {songs.length === 0 ? (
              <EmptyState
                icon="📻"
                title={UI_TEXT.playlistBuilder.songListEmpty}
                description={UI_TEXT.playlistBuilder.addedFromLibraryHelper}
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/libraries">
                      {UI_TEXT.playlistBuilder.manageLibrariesCta}
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul role="list" className="flex flex-col gap-3">
                {songs.map((item, index) => (
                  <li key={item.songId}>
                    <ListItem
                      title={item.song.title}
                      description={item.song.artist || undefined}
                      metadata={
                        <HStack as="div" gap="xs" wrap>
                          {item.song.album ? (
                            <MetadataItem
                              label={UI_TEXT.playlistBuilder.songAlbumLabel}
                              value={item.song.album}
                              variant="outline"
                            />
                          ) : null}
                          <MetadataItem
                            label={UI_TEXT.playlistBuilder.songDurationLabel}
                            value={formatDuration(item.song.file?.duration ?? null)}
                            variant="secondary"
                          />
                        </HStack>
                      }
                      actions={
                        <PlaylistSongControls
                          playlistId={playlist.id}
                          songId={item.songId}
                          songTitle={item.song.title}
                          index={index}
                          total={songs.length}
                        />
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </VStack>
    </Container>
  );
}
