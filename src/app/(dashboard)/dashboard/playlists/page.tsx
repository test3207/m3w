'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { COMMON_TEXT, PLAYLIST_TEXT, ERROR_MESSAGES } from "@/locales/messages";
import { PlaylistPlayButton } from "@/components/features/playlist-play-button";
import Link from "next/link";
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { HttpStatusCode } from "@/lib/constants/http-status";
import type { Playlist } from "@/types/models";

export default function PlaylistsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlaylists() {
      try {
        const res = await fetch('/api/playlists');
        
        if (res.status === HttpStatusCode.UNAUTHORIZED) {
          router.push('/signin');
          return;
        }
        
        logger.info('Fetch playlists response', { status: res.status });
        
        if (!res.ok) {
          logger.error('Failed to fetch playlists', { status: res.status });
          toast({
            variant: "destructive",
            title: ERROR_MESSAGES.failedToGetPlaylists,
          });
          return;
        }
        
        const data = await res.json();
        setPlaylists(data.data || []);
      } catch (error) {
        logger.error('Failed to fetch playlists', error);
        toast({
          variant: "destructive",
          title: ERROR_MESSAGES.genericTryAgain,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchPlaylists();
  }, [router, toast]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const coverUrl = formData.get("coverUrl") as string;

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          coverUrl: coverUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        logger.error('Failed to create playlist', { status: res.status });
        toast({
          variant: "destructive",
          title: ERROR_MESSAGES.failedToCreatePlaylist,
        });
        return;
      }

      const data = await res.json();
      if (data.data) {
        setPlaylists(prev => [...prev, data.data]);
      }

      event.currentTarget.reset();
    } catch (error) {
      logger.error('Failed to create playlist', error);
      toast({
        variant: "destructive",
        title: ERROR_MESSAGES.failedToCreatePlaylist,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (playlistId: string) => {
    if (!confirm(COMMON_TEXT.confirmDeletePlaylist)) {
      return;
    }

    setDeletingId(playlistId);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        logger.error('Failed to delete playlist', { status: res.status });
        toast({
          variant: "destructive",
          title: ERROR_MESSAGES.failedToDeletePlaylist,
        });
        return;
      }

      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
    } catch (error) {
      logger.error('Failed to delete playlist', error);
      toast({
        variant: "destructive",
        title: ERROR_MESSAGES.failedToDeletePlaylist,
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{COMMON_TEXT.loadingLabel}</div>
      </div>
    );
  }

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
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{PLAYLIST_TEXT.manager.form.nameLabel}</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    maxLength={100}
                    placeholder={PLAYLIST_TEXT.manager.form.namePlaceholder}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{PLAYLIST_TEXT.manager.form.descriptionLabel}</Label>
                  <Textarea
                    id="description"
                    name="description"
                    maxLength={500}
                    placeholder={PLAYLIST_TEXT.manager.form.descriptionPlaceholder}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverUrl">{PLAYLIST_TEXT.manager.form.coverLabel}</Label>
                  <Input
                    id="coverUrl"
                    name="coverUrl"
                    type="url"
                    placeholder={PLAYLIST_TEXT.manager.form.coverPlaceholder}
                    disabled={submitting}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? COMMON_TEXT.creatingLabel : PLAYLIST_TEXT.manager.form.submitLabel}
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
                        value={playlist._count?.songs ?? 0}
                        variant="outline"
                      />,
                    ];

                    // TODO: Add cover URL support when backend implements it
                    // if (playlist.coverUrl) {
                    //   metadata.push(...)
                    // }

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

                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(playlist.id)}
                                disabled={deletingId === playlist.id}
                              >
                                {deletingId === playlist.id ? COMMON_TEXT.deletingLabel : PLAYLIST_TEXT.manager.list.deleteButton}
                              </Button>
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
