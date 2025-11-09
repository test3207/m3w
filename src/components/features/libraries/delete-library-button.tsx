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
import { deleteLibraryAction } from '@/app/(dashboard)/dashboard/libraries/actions';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';

interface DeleteLibraryButtonProps {
  libraryId: string;
  libraryName: string;
}

export function DeleteLibraryButton({ libraryId, libraryName }: DeleteLibraryButtonProps) {
  useLocale(); // Subscribe to locale changes
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = React.useCallback(() => {
    startTransition(async () => {
      const result = await deleteLibraryAction(libraryId);

      if (result.status === 'success') {
        toast({
          title: I18n.library.manager.list.toastDeleteSuccessTitle,
          description: `${I18n.library.manager.list.toastDeleteSuccessDescriptionPrefix}${libraryName}`,
        });
        setOpen(false);
        return;
      }

      toast({
        variant: 'destructive',
        title: I18n.library.manager.list.toastDeleteErrorTitle,
        description:
          result.message === 'not-authorized'
            ? I18n.library.manager.list.toastDeleteErrorUnauthorized
            : I18n.library.manager.list.toastDeleteErrorDescription,
      });
    });
  }, [libraryId, libraryName, startTransition]);

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
