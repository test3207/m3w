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
import { UploadSongForm } from '@/components/features/upload/upload-song-form';

export function UploadDrawer() {
  useLocale();
  
  const { isUploadDrawerOpen, closeUploadDrawer } = useUIStore();

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
            {I18n.upload.page.description}
          </SheetDescription>
        </SheetHeader>

        <UploadSongForm onDrawerClose={closeUploadDrawer} />
      </SheetContent>
    </Sheet>
  );
}
