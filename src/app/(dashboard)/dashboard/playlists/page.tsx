import { auth } from "@/lib/auth/config";
import {
  createPlaylist,
  deletePlaylist as deletePlaylistService,
  getUserPlaylists,
} from "@/lib/services/playlist.service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DashboardNavbar } from "@/components/layouts/dashboard-navbar";
import { Container, Section } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { HStack, VStack } from "@/components/ui/stack";
import { EmptyState } from "@/components/ui/empty-state";
import { ListItem, MetadataItem } from "@/components/ui/list-item";
import { UI_TEXT } from "@/locales/messages";
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
    <div className="min-h-screen bg-background">
      <DashboardNavbar session={session} />

      <main>
        <Container className="py-8">
          <VStack gap="lg">
            <PageHeader
              title={UI_TEXT.playlistBuilder.pageTitle}
              description={UI_TEXT.playlistBuilder.pageDescription}
            />

            <Section className="grid gap-6 md:grid-cols-[1fr_minmax(0,2fr)]">
              {/* Create Form */}
              <Card>
                <CardHeader>
                  <CardTitle>{UI_TEXT.playlistBuilder.createCardTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={createPlaylistAction}>
                    <VStack gap="md">
                      <div className="space-y-2">
                        <Label htmlFor="name">{UI_TEXT.playlistBuilder.nameLabel}</Label>
                        <Input
                          id="name"
                          name="name"
                          required
                          maxLength={100}
                          placeholder={UI_TEXT.playlistBuilder.namePlaceholder}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">{UI_TEXT.playlistBuilder.descriptionLabel}</Label>
                        <Textarea
                          id="description"
                          name="description"
                          maxLength={500}
                          placeholder={UI_TEXT.playlistBuilder.descriptionPlaceholder}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="coverUrl">{UI_TEXT.playlistBuilder.coverLabel}</Label>
                        <Input
                          id="coverUrl"
                          name="coverUrl"
                          type="url"
                          placeholder={UI_TEXT.playlistBuilder.coverPlaceholder}
                        />
                      </div>

                      <Button type="submit" className="w-full">
                        {UI_TEXT.playlistBuilder.createButton}
                      </Button>
                    </VStack>
                  </form>
                </CardContent>
              </Card>

              {/* Playlists List */}
              <Card>
                <CardHeader>
                  <CardTitle>{UI_TEXT.playlistBuilder.listTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  {playlists.length === 0 ? (
                    <EmptyState
                      icon="📻"
                      title={UI_TEXT.playlistBuilder.empty}
                    />
                  ) : (
                    <ul role="list" className="flex flex-col gap-3">
                      {playlists.map((playlist) => {
                        const metadata = [
                          <MetadataItem
                            key="songs"
                            label="Songs"
                            value={playlist._count.songs}
                            variant="outline"
                          />,
                        ];

                        if (playlist.coverUrl) {
                          metadata.push(
                            <span key="cover" className="text-xs text-muted-foreground">
                              {UI_TEXT.playlistBuilder.coverPrefix}
                              <a
                                href={playlist.coverUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-foreground"
                              >
                                View
                              </a>
                            </span>
                          );
                        }

                        metadata.push(
                          <span key="created" className="text-xs text-muted-foreground">
                            {UI_TEXT.playlistBuilder.createdOnPrefix}
                            {new Date(playlist.createdAt).toLocaleDateString()}
                          </span>,
                          <span key="updated" className="text-xs text-muted-foreground">
                            {UI_TEXT.playlistBuilder.updatedOnPrefix}
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
                                      Manage songs
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
                                      {UI_TEXT.playlistBuilder.deleteButton}
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
            </Section>
          </VStack>
        </Container>
      </main>
    </div>
  );
}
