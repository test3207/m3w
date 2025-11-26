/**
 * AddToPlaylistSheet Component
 * Sheet for adding a song to existing playlists
 */

import { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/stores/uiStore';
import { usePlaylistStore } from '@/stores/playlistStore';
import { useToast } from '@/components/ui/use-toast';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { getPlaylistDisplayName } from '@/lib/utils/defaults';
import { isFavoritesPlaylist } from '@m3w/shared';
import { Check, Plus, Music, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AddToPlaylistSheet() {
  useLocale();
  const { toast } = useToast();
  
  const isOpen = useUIStore((state) => state.isAddToPlaylistSheetOpen);
  const selectedSong = useUIStore((state) => state.selectedSongForPlaylist);
  const closeSheet = useUIStore((state) => state.closeAddToPlaylistSheet);
  
  const playlists = usePlaylistStore((state) => state.playlists);
  const addSongToPlaylist = usePlaylistStore((state) => state.addSongToPlaylist);
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists);
  
  const [isAdding, setIsAdding] = useState(false);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Check which playlists already contain the song
  const playlistsWithSong = useMemo(() => {
    if (!selectedSong) return new Set<string>();
    return new Set(
      playlists
        .filter((pl) => pl.songIds.includes(selectedSong.id))
        .map((pl) => pl.id)
    );
  }, [playlists, selectedSong]);

  // Handle adding song to a playlist
  const handleAddToPlaylist = async (playlistId: string, playlistName: string) => {
    if (!selectedSong) return;
    
    // Check if already in playlist
    if (playlistsWithSong.has(playlistId)) {
      toast({
        title: I18n.library.addToPlaylist.alreadyInPlaylist,
      });
      return;
    }
    
    setIsAdding(true);
    try {
      const success = await addSongToPlaylist(
        playlistId, 
        selectedSong.id, 
        selectedSong.coverUrl
      );
      
      if (success) {
        toast({
          title: I18n.library.addToPlaylist.toastSuccessTitle,
          description: I18n.library.addToPlaylist.toastSuccessDescriptionWithName
            .replace('{0}', selectedSong.title)
            .replace('{1}', playlistName),
        });
        closeSheet();
      } else {
        toast({
          variant: 'destructive',
          title: I18n.library.addToPlaylist.toastErrorTitle,
          description: I18n.library.addToPlaylist.toastErrorDescription,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: I18n.library.addToPlaylist.toastErrorTitle,
        description: error instanceof Error ? error.message : I18n.library.addToPlaylist.toastErrorDescription,
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Handle creating a new playlist and adding the song
  const handleCreateAndAdd = async () => {
    if (!selectedSong || !newPlaylistName.trim()) return;
    
    setIsCreating(true);
    try {
      const newPlaylist = await createPlaylist(newPlaylistName.trim());
      
      if (newPlaylist) {
        // Add song to the new playlist
        const success = await addSongToPlaylist(
          newPlaylist.id, 
          selectedSong.id, 
          selectedSong.coverUrl
        );
        
        if (success) {
          toast({
            title: I18n.library.addToPlaylist.toastSuccessTitle,
            description: I18n.library.addToPlaylist.toastSuccessDescriptionWithName
              .replace('{0}', selectedSong.title)
              .replace('{1}', newPlaylistName.trim()),
          });
          // Refresh playlists to show updated state
          await fetchPlaylists();
          closeSheet();
        }
      } else {
        toast({
          variant: 'destructive',
          title: I18n.library.addToPlaylist.createPlaylistError,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: I18n.library.addToPlaylist.createPlaylistError,
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsCreating(false);
      setNewPlaylistName('');
      setShowNewPlaylist(false);
    }
  };

  // Reset state when sheet closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeSheet();
      setShowNewPlaylist(false);
      setNewPlaylistName('');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[70vh]">
        <SheetHeader>
          <SheetTitle>{I18n.library.addToPlaylist.label}</SheetTitle>
          {selectedSong && (
            <SheetDescription>
              {I18n.library.addToPlaylist.selectPlaylistForSong.replace('{0}', selectedSong.title)}
            </SheetDescription>
          )}
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
                placeholder={I18n.library.addToPlaylist.newPlaylistPlaceholder}
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPlaylistName.trim()) {
                    handleCreateAndAdd();
                  } else if (e.key === 'Escape') {
                    setShowNewPlaylist(false);
                    setNewPlaylistName('');
                  }
                }}
                autoFocus
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
                  setNewPlaylistName('');
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
                const isAlreadyAdded = playlistsWithSong.has(playlist.id);
                const isFavorites = isFavoritesPlaylist(playlist);
                const displayName = getPlaylistDisplayName(playlist);
                
                return (
                  <button
                    key={playlist.id}
                    onClick={() => handleAddToPlaylist(playlist.id, displayName)}
                    disabled={isAdding || isAlreadyAdded}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      isAlreadyAdded
                        ? 'bg-muted/50 cursor-not-allowed opacity-60'
                        : 'hover:bg-accent cursor-pointer'
                    )}
                  >
                    {/* Playlist Cover */}
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                      {playlist.coverUrl ? (
                        <img
                          src={playlist.coverUrl}
                          alt={displayName}
                          className="h-full w-full object-cover"
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
                        {I18n.playlists.detail.songsCount.replace('{0}', String(playlist.songIds.length))}
                      </p>
                    </div>

                    {/* Already Added Indicator */}
                    {isAlreadyAdded && (
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
