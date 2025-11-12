'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { logger } from '@/lib/logger-client';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api-config';

interface DeleteLibraryButtonProps {
  libraryId: string;
  libraryName: string;
  onDeleted?: () => void;
}

export function DeleteLibraryButton({ libraryId, libraryName, onDeleted }: DeleteLibraryButtonProps) {
  useLocale(); // Subscribe to locale changes
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const handleDelete = React.useCallback(async () => {
    setIsPending(true);
    
    try {
      await apiClient.delete(API_ENDPOINTS.libraries.delete(libraryId));

      toast({
        title: I18n.library.manager.list.toastDeleteSuccessTitle,
        description: `${I18n.library.manager.list.toastDeleteSuccessDescriptionPrefix}${libraryName}`,
      });
      setOpen(false);
      onDeleted?.();
    } catch (error) {
      logger.error('Failed to delete library', error);
      toast({
        variant: 'destructive',
        title: I18n.library.manager.list.toastDeleteErrorTitle,
        description: I18n.library.manager.list.toastDeleteErrorDescription,
      });
    } finally {
      setIsPending(false);
    }
  }, [libraryId, libraryName, onDeleted]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isPending}>
          {I18n.library.manager.list.deleteButton}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{I18n.library.manager.list.deleteConfirmTitle}</DialogTitle>
          <DialogDescription>
            {I18n.library.manager.list.deleteConfirmDescription}
            <span className="mt-2 block font-medium text-foreground">{libraryName}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex w-full justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {I18n.library.manager.list.deleteConfirmCancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending
              ? I18n.library.manager.list.deleteConfirmPending
              : I18n.library.manager.list.deleteConfirmSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
