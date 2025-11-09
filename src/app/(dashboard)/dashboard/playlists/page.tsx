import { auth } from "@/lib/auth/config";
import {
  createPlaylist,
  deletePlaylist as deletePlaylistService,
  getUserPlaylists,
} from "@/lib/services/playlist.service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { HStack } from "@/components/ui/stack";
import { EmptyState } from "@/components/ui/empty-state";
import { ListItem, MetadataItem } from "@/components/ui/list-item";
import { COMMON_TEXT, PLAYLIST_TEXT } from "@/locales/messages";
import { PlaylistPlayButton } from "@/components/features/playlist-play-button";
import Link from "next/link";

async function createPlaylistAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const name = formData.get("name");
  const description = formData.get("description");
  const coverUrl = formData.get("coverUrl");

  if (typeof name !== "string" || name.trim().length === 0) {
    return;
  }

  const trimmedDescription =
    typeof description === "string" && description.trim().length > 0
      ? description.trim()
      : null;

  const normalizedCoverUrl =
    typeof coverUrl === "string" && coverUrl.trim().length > 0
      ? coverUrl.trim()
      : null;

  await createPlaylist(session.user.id, name.trim(), {
    description: trimmedDescription,
    coverUrl: normalizedCoverUrl,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/playlists");
}

async function deletePlaylistAction(playlistId: string) {
  "use server";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  await deletePlaylistService(playlistId, session.user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/playlists");
}

export default async function PlaylistsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const playlists = await getUserPlaylists(session.user.id);

  return (
    <AdaptiveLayout
      gap={16}
      className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8"
    >
      <AdaptiveSection
        id="playlists-header"
        baseSize={200}
        minSize={150}
        className="pt-4"
      >
        <div className="flex h-full flex-col justify-end">
          <PageHeader
            title={PLAYLIST_TEXT.manager.pageTitle}
            description={PLAYLIST_TEXT.manager.pageDescription}
          />
        </div>
      </AdaptiveSection>

      <AdaptiveSection
        id="playlists-content"
        baseSize={560}
        minSize={340}
        className="pb-4"
      >
        <div className="grid h-full gap-6 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>{PLAYLIST_TEXT.manager.form.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <form action={createPlaylistAction} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{PLAYLIST_TEXT.manager.form.nameLabel}</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    maxLength={100}
                    placeholder={PLAYLIST_TEXT.manager.form.namePlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{PLAYLIST_TEXT.manager.form.descriptionLabel}</Label>
                  <Textarea
                    id="description"
                    name="description"
                    maxLength={500}
                    placeholder={PLAYLIST_TEXT.manager.form.descriptionPlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverUrl">{PLAYLIST_TEXT.manager.form.coverLabel}</Label>
                  <Input
                    id="coverUrl"
                    name="coverUrl"
                    type="url"
                    placeholder={PLAYLIST_TEXT.manager.form.coverPlaceholder}
                  />
                </div>

                <Button type="submit" className="w-full">
                  {PLAYLIST_TEXT.manager.form.submitLabel}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>{PLAYLIST_TEXT.manager.list.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {playlists.length === 0 ? (
                <EmptyState
                  icon="📻"
                  title={PLAYLIST_TEXT.manager.list.emptyTitle}
                  description={PLAYLIST_TEXT.manager.list.emptyDescription}
                />
              ) : (
                <ul role="list" className="flex flex-col gap-3">
                  {playlists.map((playlist) => {
                    const metadata = [
                      <MetadataItem
                        key="songs"
                        label={PLAYLIST_TEXT.manager.list.metadataSongsLabel}
                        value={playlist._count.songs}
                        variant="outline"
                      />,
                    ];

                    if (playlist.coverUrl) {
                      metadata.push(
                        <span key="cover" className="text-xs text-muted-foreground">
                          {PLAYLIST_TEXT.manager.list.coverLabel}: {" "}
                          <a
                            href={playlist.coverUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-foreground"
                          >
                            {COMMON_TEXT.viewLinkLabel}
                          </a>
                        </span>
                      );
                    }

                    metadata.push(
                      <span key="created" className="text-xs text-muted-foreground">
                        {PLAYLIST_TEXT.manager.list.metadataCreatedLabel}: {" "}
                        {new Date(playlist.createdAt).toLocaleDateString()}
                      </span>,
                      <span key="updated" className="text-xs text-muted-foreground">
                        {PLAYLIST_TEXT.manager.list.metadataUpdatedLabel}: {" "}
                        {new Date(playlist.updatedAt).toLocaleDateString()}
                      </span>
                    );

                    return (
                      <li key={playlist.id}>
                        <ListItem
                          title={playlist.name}
                          description={playlist.description || undefined}
                          metadata={metadata}
                          actions={
                            <HStack gap="xs">
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/dashboard/playlists/${playlist.id}`}>
                                  {PLAYLIST_TEXT.manager.list.manageSongsCta}
                                </Link>
                              </Button>
                              <PlaylistPlayButton
                                playlistId={playlist.id}
                                playlistName={playlist.name}
                              />

                              <form
                                action={async () => {
                                  "use server";
                                  await deletePlaylistAction(playlist.id);
                                }}
                              >
                                <Button
                                  type="submit"
                                  variant="destructive"
                                  size="sm"
                                >
                                  {PLAYLIST_TEXT.manager.list.deleteButton}
                                </Button>
                              </form>
                            </HStack>
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </AdaptiveSection>
    </AdaptiveLayout>
  );
}
