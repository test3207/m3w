/**
 * UploadDrawer Component
 * Simple layout wrapper - delegates all logic to UploadSongForm
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { useUIStore } from '@/stores/uiStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { UploadSongForm } from '@/components/features/upload/upload-song-form';
import { getLibraryDisplayName } from '@/lib/utils/defaults';

export function UploadDrawer() {
  useLocale();
  
  const { isUploadDrawerOpen, closeUploadDrawer, uploadTargetLibraryId } = useUIStore();
  const { libraries } = useLibraryStore();
  
  // Find target library
  const targetLibrary = uploadTargetLibraryId 
    ? libraries.find(lib => lib.id === uploadTargetLibraryId)
    : null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeUploadDrawer();
    }
  };

  return (
    <Sheet open={isUploadDrawerOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>{I18n.upload.page.title}</SheetTitle>
          <SheetDescription>
            {targetLibrary 
              ? I18n.upload.page.uploadingTo.replace('{0}', getLibraryDisplayName(targetLibrary))
              : I18n.upload.page.description
            }
          </SheetDescription>
        </SheetHeader>

        <UploadSongForm 
          onDrawerClose={closeUploadDrawer} 
          targetLibraryId={uploadTargetLibraryId}
        />
      </SheetContent>
    </Sheet>
  );
}
