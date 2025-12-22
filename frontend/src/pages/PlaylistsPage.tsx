/**
 * Playlists Page (Mobile-First)
 * Display and manage user's playlists
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePlaylistStore } from "@/stores/playlistStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListMusic, Plus, Trash2 } from "lucide-react";
import { CoverImage, CoverType, CoverSize } from "@/components/ui/cover-image";
import { useToast } from "@/components/ui/use-toast";
import { eventBus, EVENTS } from "@/lib/events";
import { getPlaylistDisplayName, getPlaylistBadge } from "@/lib/utils/defaults";
// Import from specific subpath to avoid pulling Zod into main bundle
import { isFavoritesPlaylist } from "@m3w/shared/constants";
import { I18n } from "@/locales/i18n";
import { logger } from "@/lib/logger-client";
import { useCanWrite } from "@/hooks/useCanWrite";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

export default function PlaylistsPage() {
  const { toast } = useToast();
  const { canWrite, disabledReason } = useCanWrite();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<{ id: string; name: string } | null>(null);

  const playlists = usePlaylistStore((state) => state.playlists);
  const isLoading = usePlaylistStore((state) => state.isLoading);
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists);
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const deletePlaylist = usePlaylistStore((state) => state.deletePlaylist);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  // Listen for external song changes (delete/upload) that may affect playlists
  useEffect(() => {
    const refetchPlaylists = () => {
      logger.debug("[PlaylistsPage] Event triggered, refetching playlists");
      fetchPlaylists();
    };

    const unsubscribeDelete = eventBus.on(
      EVENTS.SONG_DELETED,
      refetchPlaylists
    );
    const unsubscribeUpload = eventBus.on(
      EVENTS.SONG_UPLOADED,
      refetchPlaylists
    );

    return () => {
      unsubscribeDelete();
      unsubscribeUpload();
    };
  }, [fetchPlaylists]);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      toast({
        variant: "destructive",
        title: I18n.playlists.create.promptName,
      });
      return;
    }

    setIsCreating(true);
    try {
      await createPlaylist(newPlaylistName.trim());
      toast({
        title: I18n.playlists.create.successTitle,
        description: I18n.playlists.create.successDescription.replace("{0}", newPlaylistName),
      });
      setNewPlaylistName("");
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: I18n.playlists.create.errorTitle,
        description: error instanceof Error ? error.message : I18n.playlists.create.unknownError,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    
    try {
      const success = await deletePlaylist(playlistToDelete.id);
      if (success) {
        toast({
          title: I18n.playlists.delete.successTitle,
          description: I18n.playlists.delete.successDescription.replace("{0}", playlistToDelete.name),
        });
      } else {
        toast({
          variant: "destructive",
          title: I18n.playlists.delete.errorTitle,
          description: I18n.playlists.delete.cannotDeleteDefault,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: I18n.playlists.delete.errorTitle,
        description: error instanceof Error ? error.message : I18n.error.genericTryAgain,
      });
    } finally {
      setPlaylistToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{I18n.common.loadingLabel}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{I18n.playlists.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {I18n.playlists.count.replace("{0}", String(playlists.length))}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={!canWrite ? 0 : undefined}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="outline" disabled={!canWrite} aria-label={I18n.playlists.create.dialogTitle}>
                      <Plus className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                </span>
              </TooltipTrigger>
              {disabledReason && (
                <TooltipContent>
                  <p>{disabledReason}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{I18n.playlists.create.dialogTitle}</DialogTitle>
              <DialogDescription>{I18n.playlists.create.dialogDescription}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{I18n.playlists.create.nameLabel}</Label>
                <Input
                  id="name"
                  placeholder={I18n.playlists.create.namePlaceholder}
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreatePlaylist();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setNewPlaylistName("");
                }}
              >
                {I18n.playlists.create.cancel}
              </Button>
              <Button onClick={handleCreatePlaylist} disabled={isCreating}>
                {isCreating ? I18n.playlists.create.submitting : I18n.playlists.create.submit}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Playlists Grid */}
      {playlists.length === 0 ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <ListMusic className="mx-auto h-16 w-16 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-semibold">{I18n.playlists.empty.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {I18n.playlists.empty.description}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {playlists.map((playlist, index) => {
            const canDeletePlaylist = !isFavoritesPlaylist(playlist) && playlist.canDelete !== false && canWrite;
            // First few items are above-the-fold, load them eagerly for better LCP
            const isPriority = index < 3;
            return (
              <Card key={playlist.id} className="overflow-hidden transition-colors hover:bg-accent">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Cover Image - 96px (clickable) */}
                    <Link to={`/playlists/${playlist.id}`} className="shrink-0" aria-label={getPlaylistDisplayName(playlist)}>
                      <CoverImage
                        songId={playlist.coverSongId}
                        alt={getPlaylistDisplayName(playlist)}
                        type={CoverType.Playlist}
                        size={CoverSize.LG}
                        priority={isPriority}
                      />
                    </Link>

                    {/* Metadata (clickable) */}
                    <Link to={`/playlists/${playlist.id}`} className="flex flex-1 flex-col justify-center gap-1 overflow-hidden">
                      <h2 className="truncate font-semibold text-base flex items-center gap-2">
                        {getPlaylistDisplayName(playlist)}
                        {isFavoritesPlaylist(playlist) && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded whitespace-nowrap">
                            {getPlaylistBadge(playlist)}
                          </span>
                        )}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {I18n.playlists.card.songsCount.replace("{0}", String(playlist.songCount || 0))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {I18n.playlists.card.createdAt.replace("{0}", new Date(playlist.createdAt).toLocaleDateString(
                          "zh-CN",
                          { year: "numeric", month: "short", day: "numeric" }
                        ))}
                      </p>
                    </Link>

                    {/* Delete button */}
                    {canDeletePlaylist && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPlaylistToDelete({ id: playlist.id, name: getPlaylistDisplayName(playlist) });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{I18n.playlists.delete.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {playlistToDelete
                ? I18n.playlists.delete.confirmDescription.replace("{0}", playlistToDelete.name)
                : ""
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{I18n.common.cancelButton}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlaylist}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {I18n.common.deleteButton}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
