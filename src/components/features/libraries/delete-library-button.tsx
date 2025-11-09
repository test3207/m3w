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
import { LIBRARY_TEXT } from '@/locales/messages';

interface DeleteLibraryButtonProps {
  libraryId: string;
  libraryName: string;
}

export function DeleteLibraryButton({ libraryId, libraryName }: DeleteLibraryButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = React.useCallback(() => {
    startTransition(async () => {
      const result = await deleteLibraryAction(libraryId);

      if (result.status === 'success') {
        toast({
          title: LIBRARY_TEXT.manager.list.toastDeleteSuccessTitle,
          description: `${LIBRARY_TEXT.manager.list.toastDeleteSuccessDescriptionPrefix}${libraryName}`,
        });
        setOpen(false);
        return;
      }

      toast({
        variant: 'destructive',
        title: LIBRARY_TEXT.manager.list.toastDeleteErrorTitle,
        description:
          result.message === 'not-authorized'
            ? LIBRARY_TEXT.manager.list.toastDeleteErrorUnauthorized
            : LIBRARY_TEXT.manager.list.toastDeleteErrorDescription,
      });
    });
  }, [libraryId, libraryName, startTransition]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isPending}>
          {LIBRARY_TEXT.manager.list.deleteButton}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{LIBRARY_TEXT.manager.list.deleteConfirmTitle}</DialogTitle>
          <DialogDescription>
            {LIBRARY_TEXT.manager.list.deleteConfirmDescription}
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
            {LIBRARY_TEXT.manager.list.deleteConfirmCancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending
              ? LIBRARY_TEXT.manager.list.deleteConfirmPending
              : LIBRARY_TEXT.manager.list.deleteConfirmSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
