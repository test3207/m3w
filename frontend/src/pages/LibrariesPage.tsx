/**
 * Libraries Page (Mobile-First)
 * Display and manage user's music libraries
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLibraryStore } from "@/stores/libraryStore";
import { logger } from "@/lib/logger-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Library, Plus, Trash2 } from "lucide-react";
import { CoverImage, CoverType, CoverSize } from "@/components/ui/cover-image";
import { useToast } from "@/components/ui/use-toast";
import { getLibraryDisplayName, getLibraryBadge } from "@/lib/utils/defaults";
// Import from specific subpath to avoid pulling Zod into main bundle
import { isDefaultLibrary } from "@m3w/shared/constants";
import { I18n } from "@/locales/i18n";
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

export default function LibrariesPage() {
  const { toast } = useToast();
  const { canWrite, disabledReason } = useCanWrite();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [libraryToDelete, setLibraryToDelete] = useState<{ id: string; name: string } | null>(null);

  const libraries = useLibraryStore((state) => state.libraries);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const fetchLibraries = useLibraryStore((state) => state.fetchLibraries);
  const createLibrary = useLibraryStore((state) => state.createLibrary);
  const deleteLibrary = useLibraryStore((state) => state.deleteLibrary);

  // Fetch libraries on mount
  useEffect(() => {
    void fetchLibraries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleCreateLibrary = async () => {
    if (!newLibraryName.trim()) {
      toast({
        variant: "destructive",
        title: I18n.libraries.create.promptName,
      });
      return;
    }

    setIsCreating(true);
    try {
      await createLibrary(newLibraryName.trim());
      logger.info(
        "[LibrariesPage][handleCreateLibrary]",
        "Library created",
        { traceId: undefined, raw: { libraryName: newLibraryName.trim() } }
      );
      toast({
        title: I18n.libraries.create.successTitle,
        description: I18n.libraries.create.successDescription.replace("{0}", newLibraryName),
      });
      setNewLibraryName("");
      setIsDialogOpen(false);
    } catch (error) {
      logger.error(
        "[LibrariesPage][handleCreateLibrary]",
        "Failed to create library",
        error,
        { traceId: undefined, raw: { libraryName: newLibraryName.trim() } }
      );
      toast({
        variant: "destructive",
        title: I18n.libraries.create.errorTitle,
        description: error instanceof Error ? error.message : I18n.libraries.create.unknownError,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteLibrary = async () => {
    if (!libraryToDelete) return;
    
    try {
      const success = await deleteLibrary(libraryToDelete.id);
      if (success) {
        logger.info(
          "[LibrariesPage][handleDeleteLibrary]",
          "Library deleted",
          { traceId: undefined, raw: { libraryId: libraryToDelete.id, libraryName: libraryToDelete.name } }
        );
        toast({
          title: I18n.libraries.delete.successTitle,
          description: I18n.libraries.delete.successDescription.replace("{0}", libraryToDelete.name),
        });
      } else {
        logger.warn(
          "[LibrariesPage][handleDeleteLibrary]",
          "Cannot delete default library",
          { traceId: undefined, raw: { libraryId: libraryToDelete.id, libraryName: libraryToDelete.name } }
        );
        toast({
          variant: "destructive",
          title: I18n.libraries.delete.errorTitle,
          description: I18n.libraries.delete.cannotDeleteDefault,
        });
      }
    } catch (error) {
      logger.error(
        "[LibrariesPage][handleDeleteLibrary]",
        "Failed to delete library",
        error,
        { traceId: undefined, raw: { libraryId: libraryToDelete.id, libraryName: libraryToDelete.name } }
      );
      toast({
        variant: "destructive",
        title: I18n.libraries.delete.errorTitle,
        description: error instanceof Error ? error.message : I18n.error.genericTryAgain,
      });
    } finally {
      setLibraryToDelete(null);
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
          <h1 className="text-2xl font-bold">{I18n.libraries.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {I18n.libraries.count.replace("{0}", String(libraries.length))}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={!canWrite ? 0 : undefined}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="outline" disabled={!canWrite} aria-label={I18n.libraries.create.dialogTitle}>
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
              <DialogTitle>{I18n.libraries.create.dialogTitle}</DialogTitle>
              <DialogDescription>
                {I18n.libraries.create.dialogDescription}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{I18n.libraries.create.nameLabel}</Label>
                <Input
                  id="name"
                  placeholder={I18n.libraries.create.namePlaceholder}
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateLibrary();
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
                  setNewLibraryName("");
                }}
              >
                {I18n.libraries.create.cancel}
              </Button>
              <Button onClick={handleCreateLibrary} disabled={isCreating}>
                {isCreating ? I18n.libraries.create.submitting : I18n.libraries.create.submit}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Libraries Grid */}
      {libraries.length === 0 ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Library className="mx-auto h-16 w-16 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-semibold">{I18n.libraries.empty.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {I18n.libraries.empty.description}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {libraries.map((library, index) => {
            const canDeleteLibrary = !isDefaultLibrary(library) && library.canDelete !== false && canWrite;
            // First few items are above-the-fold, load them eagerly for better LCP
            const isPriority = index < 3;
            return (
              <Card key={library.id} className="overflow-hidden transition-colors hover:bg-accent">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Cover Image - 96px (clickable) */}
                    <Link to={`/libraries/${library.id}`} className="shrink-0" aria-label={getLibraryDisplayName(library)}>
                      <CoverImage
                        songId={library.coverSongId}
                        alt={getLibraryDisplayName(library)}
                        type={CoverType.Library}
                        size={CoverSize.LG}
                        priority={isPriority}
                      />
                    </Link>

                    {/* Metadata (clickable) */}
                    <Link to={`/libraries/${library.id}`} className="flex flex-1 flex-col justify-center gap-1 overflow-hidden">
                      <h2 className="truncate font-semibold text-base flex items-center gap-2">
                        {getLibraryDisplayName(library)}
                        {isDefaultLibrary(library) && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded whitespace-nowrap">
                            {getLibraryBadge(library)}
                          </span>
                        )}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {I18n.libraries.card.songsCount.replace("{0}", String(library.songCount || 0))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {I18n.libraries.card.createdAt.replace("{0}", new Date(library.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" }))}
                      </p>
                    </Link>

                    {/* Delete button */}
                    {canDeleteLibrary && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLibraryToDelete({ id: library.id, name: getLibraryDisplayName(library) });
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
            <AlertDialogTitle>{I18n.libraries.delete.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {libraryToDelete
                ? I18n.libraries.delete.confirmDescription.replace("{0}", libraryToDelete.name)
                : ""
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{I18n.common.cancelButton}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLibrary}
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
