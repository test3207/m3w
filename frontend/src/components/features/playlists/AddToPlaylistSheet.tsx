/**
 * AddToPlaylistSheet Component
 * Sheet for adding songs to existing playlists (supports batch add)
 */

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUIStore, type SelectedSongInfo } from "@/stores/uiStore";
import { usePlaylistStore } from "@/stores/playlistStore";
import { useToast } from "@/components/ui/use-toast";
import { I18n } from "@/locales/i18n";
import { getPlaylistDisplayName } from "@/lib/utils/defaults";
import { isFavoritesPlaylist } from "@m3w/shared";
import { Check, Plus, Music, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverImage, CoverType, CoverSize } from "@/components/ui/cover-image";

export function AddToPlaylistSheet() {
  const { toast } = useToast();
  
  const isOpen = useUIStore((state) => state.isAddToPlaylistSheetOpen);
  const selectedSongForPlaylist = useUIStore((state) => state.selectedSongForPlaylist);
  const selectedSongs = useUIStore((state) => state.selectedSongs);
  const isSelectionMode = useUIStore((state) => state.isSelectionMode);
  const closeSheet = useUIStore((state) => state.closeAddToPlaylistSheet);
  const exitSelectionMode = useUIStore((state) => state.exitSelectionMode);
  
  const playlists = usePlaylistStore((state) => state.playlists);
  const addSongToPlaylist = usePlaylistStore((state) => state.addSongToPlaylist);
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists);
  const getPlaylistSongIds = usePlaylistStore((state) => state.getPlaylistSongIds);
  
  const [isAdding, setIsAdding] = useState(false);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const newPlaylistInputRef = useRef<HTMLInputElement>(null);

  // Focus new playlist input when it appears
  useEffect(() => {
    if (showNewPlaylist) {
      newPlaylistInputRef.current?.focus();
    }
  }, [showNewPlaylist]);

  // Fetch playlists when sheet opens to ensure data is fresh
  useEffect(() => {
    if (isOpen) {
      void fetchPlaylists();
    }
  }, [isOpen, fetchPlaylists]);

  // Determine which songs to add
  // Priority: selection mode > single song
  const songsToAdd: SelectedSongInfo[] = useMemo(() => {
    if (isSelectionMode && selectedSongs.length > 0) {
      return selectedSongs;
    }
    if (selectedSongForPlaylist) {
      return [selectedSongForPlaylist];
    }
    return [];
  }, [isSelectionMode, selectedSongs, selectedSongForPlaylist]);

  // Check which playlists already contain ALL the songs
  const playlistsWithAllSongs = useMemo(() => {
    if (songsToAdd.length === 0) return new Set<string>();
    
    return new Set(
      playlists
        .filter((pl) => {
          // Check if ALL selected songs are already in this playlist
          const songIds = getPlaylistSongIds(pl.id);
          return songsToAdd.every(song => songIds.includes(song.id));
        })
        .map((pl) => pl.id)
    );
  }, [playlists, songsToAdd, getPlaylistSongIds]);

  // Handle adding songs to a playlist
  const handleAddToPlaylist = async (playlistId: string, playlistName: string) => {
    if (songsToAdd.length === 0) return;
    
    // Check if all songs already in playlist
    if (playlistsWithAllSongs.has(playlistId)) {
      toast({
        title: I18n.library.addToPlaylist.alreadyInPlaylist,
      });
      return;
    }
    
    setIsAdding(true);
    try {
      let addedCount = 0;
      let skippedCount = 0;
      
      // Find the playlist to check existing songs
      const existingSongIds = new Set(getPlaylistSongIds(playlistId));
      
      // Add each song that isn't already in the playlist
      for (const song of songsToAdd) {
        if (existingSongIds.has(song.id)) {
          skippedCount++;
          continue;
        }
        
        const success = await addSongToPlaylist(
          playlistId, 
          song.id
        );
        
        if (success) {
          addedCount++;
        }
      }
      
      if (addedCount > 0) {
        const description = songsToAdd.length === 1
          ? I18n.library.addToPlaylist.toastSuccessDescriptionWithName
            .replace("{0}", songsToAdd[0].title)
            .replace("{1}", playlistName)
          : I18n.library.addToPlaylist.batchSuccessDescription
            .replace("{0}", String(addedCount))
            .replace("{1}", playlistName);
        
        toast({
          title: I18n.library.addToPlaylist.toastSuccessTitle,
          description,
        });
        
        // Exit selection mode and close sheet
        if (isSelectionMode) {
          exitSelectionMode();
        }
        closeSheet();
      } else if (skippedCount > 0) {
        toast({
          title: I18n.library.addToPlaylist.alreadyInPlaylist,
        });
      } else {
        toast({
          variant: "destructive",
          title: I18n.library.addToPlaylist.toastErrorTitle,
          description: I18n.library.addToPlaylist.toastErrorDescription,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: I18n.library.addToPlaylist.toastErrorTitle,
        description: error instanceof Error ? error.message : I18n.library.addToPlaylist.toastErrorDescription,
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Handle creating a new playlist and adding the songs
  const handleCreateAndAdd = async () => {
    if (songsToAdd.length === 0 || !newPlaylistName.trim()) return;
    
    setIsCreating(true);
    try {
      const newPlaylist = await createPlaylist(newPlaylistName.trim());
      
      if (newPlaylist) {
        // Add songs to the new playlist
        let addedCount = 0;
        for (const song of songsToAdd) {
          const success = await addSongToPlaylist(
            newPlaylist.id, 
            song.id
          );
          if (success) addedCount++;
        }
        
        if (addedCount > 0) {
          const description = songsToAdd.length === 1
            ? I18n.library.addToPlaylist.toastSuccessDescriptionWithName
              .replace("{0}", songsToAdd[0].title)
              .replace("{1}", newPlaylistName.trim())
            : I18n.library.addToPlaylist.batchSuccessDescription
              .replace("{0}", String(addedCount))
              .replace("{1}", newPlaylistName.trim());
          
          toast({
            title: I18n.library.addToPlaylist.toastSuccessTitle,
            description,
          });
          
          // Refresh playlists to show updated state
          await fetchPlaylists();
          
          // Exit selection mode and close sheet
          if (isSelectionMode) {
            exitSelectionMode();
          }
          closeSheet();
        }
      } else {
        toast({
          variant: "destructive",
          title: I18n.library.addToPlaylist.createPlaylistError,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: I18n.library.addToPlaylist.createPlaylistError,
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsCreating(false);
      setNewPlaylistName("");
      setShowNewPlaylist(false);
    }
  };

  // Reset state when sheet closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeSheet();
      setShowNewPlaylist(false);
      setNewPlaylistName("");
    }
  };

  // Generate description text
  const getSheetDescription = () => {
    if (songsToAdd.length === 0) return "";
    if (songsToAdd.length === 1) {
      return I18n.library.addToPlaylist.selectPlaylistForSong.replace("{0}", songsToAdd[0].title);
    }
    return I18n.library.addToPlaylist.selectPlaylistForSongs.replace("{0}", String(songsToAdd.length));
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[70vh]">
        <SheetHeader>
          <SheetTitle>{I18n.library.addToPlaylist.label}</SheetTitle>
          <SheetDescription>
            {getSheetDescription()}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4 overflow-y-auto pb-20">
          {/* Create New Playlist Section */}
          {!showNewPlaylist ? (
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setShowNewPlaylist(true)}
            >
              <Plus className="h-4 w-4" />
              {I18n.library.addToPlaylist.createNewPlaylist}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                ref={newPlaylistInputRef}
                placeholder={I18n.library.addToPlaylist.newPlaylistPlaceholder}
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPlaylistName.trim()) {
                    handleCreateAndAdd();
                  } else if (e.key === "Escape") {
                    setShowNewPlaylist(false);
                    setNewPlaylistName("");
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleCreateAndAdd}
                disabled={isCreating || !newPlaylistName.trim()}
              >
                {isCreating ? I18n.common.loadingLabel : I18n.library.addToPlaylist.createButton}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewPlaylist(false);
                  setNewPlaylistName("");
                }}
              >
                {I18n.common.cancelButton}
              </Button>
            </div>
          )}

          {/* Playlist List */}
          <div className="space-y-2">
            {playlists.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Music className="mx-auto h-12 w-12 opacity-50" />
                <p className="mt-2">{I18n.library.addToPlaylist.noPlaylists}</p>
              </div>
            ) : (
              playlists.map((playlist) => {
                const allSongsAdded = playlistsWithAllSongs.has(playlist.id);
                const isFavorites = isFavoritesPlaylist(playlist);
                const displayName = getPlaylistDisplayName(playlist);
                
                return (
                  <button
                    key={playlist.id}
                    onClick={() => handleAddToPlaylist(playlist.id, displayName)}
                    disabled={isAdding || allSongsAdded}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                      allSongsAdded
                        ? "bg-muted/50 cursor-not-allowed opacity-60"
                        : "hover:bg-accent cursor-pointer"
                    )}
                  >
                    {/* Playlist Cover */}
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                      {playlist.coverSongId ? (
                        <CoverImage
                          songId={playlist.coverSongId}
                          alt={displayName}
                          type={CoverType.Playlist}
                          size={CoverSize.MD}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          {isFavorites ? (
                            <Heart className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Music className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Playlist Info */}
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate font-medium">{displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {I18n.playlists.detail.songsCount.replace("{0}", String(playlist.songCount))}
                      </p>
                    </div>

                    {/* Already Added Indicator */}
                    {allSongsAdded && (
                      <div className="shrink-0 text-primary">
                        <Check className="h-5 w-5" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
