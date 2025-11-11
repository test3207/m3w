import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { I18n } from "@/locales/i18n";
import { useLocale } from "@/locales/use-locale";
import { PlaylistPlayButton } from "@/components/features/playlist-play-button";
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { apiClient, ApiError } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/api-config";
import type { Playlist } from "@/types/models";

export default function PlaylistsPage() {
  useLocale();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlaylists() {
      try {
        const data = await apiClient.get<{ success: boolean; data: Playlist[] }>(API_ENDPOINTS.playlists.list);
        setPlaylists(data.data || []);
      } catch (error) {
        logger.error('Failed to fetch playlists', error);
        
        if (error instanceof ApiError && error.status === 401) {
          navigate('/signin');
          return;
        }
        
        toast({
          variant: "destructive",
          title: I18n.error.failedToGetPlaylists,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchPlaylists();
  }, [navigate, toast]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const coverUrl = formData.get("coverUrl") as string;

    try {
      const data = await apiClient.post<{ success: boolean; data: Playlist }>(API_ENDPOINTS.playlists.create, {
        name: name.trim(),
        description: description.trim() || undefined,
        coverUrl: coverUrl.trim() || undefined,
      });

      if (data.data) {
        setPlaylists(prev => [...prev, data.data]);
      }

      event.currentTarget.reset();
      toast({
        title: "Playlist created successfully",
      });
    } catch (error) {
      logger.error('Failed to create playlist', error);
      
      if (error instanceof ApiError && error.status === 401) {
        navigate('/signin');
        return;
      }
      
      toast({
        variant: "destructive",
        title: I18n.error.failedToCreatePlaylist,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (playlistId: string) => {
    if (!confirm(I18n.common.confirmDeletePlaylist)) {
      return;
    }

    setDeletingId(playlistId);
    try {
      await apiClient.delete<{ success: boolean; message: string }>(API_ENDPOINTS.playlists.delete(playlistId));

      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      toast({
        title: "Playlist deleted successfully",
      });
    } catch (error) {
      logger.error('Failed to delete playlist', error);
      
      if (error instanceof ApiError && error.status === 401) {
        navigate('/signin');
        return;
      }
      
      toast({
        variant: "destructive",
        title: I18n.error.failedToDeletePlaylist,
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{I18n.common.loadingLabel}</div>
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
            title={I18n.playlist.manager.pageTitle}
            description={I18n.playlist.manager.pageDescription}
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
              <CardTitle>{I18n.playlist.manager.form.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{I18n.playlist.manager.form.nameLabel}</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    maxLength={100}
                    placeholder={I18n.playlist.manager.form.namePlaceholder}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{I18n.playlist.manager.form.descriptionLabel}</Label>
                  <Textarea
                    id="description"
                    name="description"
                    maxLength={500}
                    placeholder={I18n.playlist.manager.form.descriptionPlaceholder}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverUrl">{I18n.playlist.manager.form.coverLabel}</Label>
                  <Input
                    id="coverUrl"
                    name="coverUrl"
                    type="url"
                    placeholder={I18n.playlist.manager.form.coverPlaceholder}
                    disabled={submitting}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? I18n.common.creatingLabel : I18n.playlist.manager.form.submitLabel}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>{I18n.playlist.manager.list.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {playlists.length === 0 ? (
                <EmptyState
                  icon="📻"
                  title={I18n.playlist.manager.list.emptyTitle}
                  description={I18n.playlist.manager.list.emptyDescription}
                />
              ) : (
                <ul role="list" className="flex flex-col gap-3">
                  {playlists.map((playlist) => {
                    const metadata = [
                      <MetadataItem
                        key="songs"
                        label={I18n.playlist.manager.list.metadataSongsLabel}
                        value={playlist._count?.songs ?? 0}
                        variant="outline"
                      />,
                    ];

                    metadata.push(
                      <span key="created" className="text-xs text-muted-foreground">
                        {I18n.playlist.manager.list.metadataCreatedLabel}: {" "}
                        {new Date(playlist.createdAt).toLocaleDateString()}
                      </span>,
                      <span key="updated" className="text-xs text-muted-foreground">
                        {I18n.playlist.manager.list.metadataUpdatedLabel}: {" "}
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
                                <Link to={`/dashboard/playlists/${playlist.id}`}>
                                  {I18n.playlist.manager.list.manageSongsCta}
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
                                {deletingId === playlist.id ? I18n.common.deletingLabel : I18n.playlist.manager.list.deleteButton}
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
