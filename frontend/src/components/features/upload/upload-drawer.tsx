/**
 * UploadDrawer Component
 * Bottom sheet drawer for uploading songs to a library
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { useUIStore } from '@/stores/uiStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlaylistStore } from '@/stores/playlistStore';
import { UploadSongForm } from '@/components/features/upload/upload-song-form';
import { logger } from '@/lib/logger-client';
import { eventBus, EVENTS } from '@/lib/events';
import type { LibraryOption } from '@/types/models';
import { isDefaultLibrary } from '@m3w/shared';

export function UploadDrawer() {
  useLocale();
  
  const { isUploadDrawerOpen, closeUploadDrawer } = useUIStore();
  const { libraries, fetchLibraries } = useLibraryStore();
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists);
  
  // Compute library options from libraries
  const libraryOptions: LibraryOption[] = useMemo(() => {
    return libraries.map((library) => ({
      id: library.id,
      name: library.name,
      description: library.description ?? null,
      songCount: library._count?.songs ?? 0,
    }));
  }, [libraries]);

  // Get default library ID
  const defaultLibraryId = useMemo(() => {
    if (libraries.length === 0) return '';
    const defaultLibrary = libraries.find(isDefaultLibrary);
    return defaultLibrary?.id || libraries[0].id;
  }, [libraries]);

  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
  
  // Loading state based on whether we have libraries
  const loading = libraries.length === 0;

  // Fetch libraries on mount
  useEffect(() => {
    if (isUploadDrawerOpen && libraries.length === 0) {
      fetchLibraries();
    }
  }, [isUploadDrawerOpen, libraries.length, fetchLibraries]);

  const handleUploadSuccess = async () => {
    logger.info('Upload completed, refreshing libraries');
    console.log('[UploadDrawer] handleUploadSuccess called');
    
    // Refresh libraries to update song counts
    await fetchLibraries();
    console.log('[UploadDrawer] fetchLibraries completed');
    
    // Refresh playlists (in case new songs added that might be used in playlists)
    await fetchPlaylists();
    console.log('[UploadDrawer] fetchPlaylists completed');
    
    // Emit event to notify other components
    eventBus.emit(EVENTS.SONG_UPLOADED);
    
    // Close drawer after 2 seconds to let user see the success toast
    setTimeout(() => {
      console.log('[UploadDrawer] Closing drawer after 2s delay');
      closeUploadDrawer();
    }, 2000);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeUploadDrawer();
    }
  };

  return (
    <Sheet open={isUploadDrawerOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>上传歌曲</SheetTitle>
          <SheetDescription>
            选择音乐库并上传音频文件
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">{I18n.common.loadingLabel}</p>
            </div>
          ) : libraryOptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-muted-foreground text-center">
                还没有音乐库
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  closeUploadDrawer();
                  // Navigate to libraries page would be done via router
                }}
              >
                创建音乐库
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Library Selection */}
              <div className="space-y-2">
                <Label htmlFor="library-select">选择音乐库</Label>
                <Select 
                  value={selectedLibraryId || defaultLibraryId} 
                  onValueChange={setSelectedLibraryId}
                >
                  <SelectTrigger id="library-select">
                    <SelectValue placeholder={I18n.upload.form.selectLibraryPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {libraryOptions.map((library) => (
                      <SelectItem key={library.id} value={library.id}>
                        {library.name} ({library.songCount} 首歌曲)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Upload Form */}
              {(selectedLibraryId || defaultLibraryId) && (
                <UploadSongForm
                  libraries={libraryOptions.filter((lib) => lib.id === (selectedLibraryId || defaultLibraryId))}
                  onUploadSuccess={handleUploadSuccess}
                />
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
