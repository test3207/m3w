'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { I18n } from '@/locales/i18n';
import { logger } from '@/lib/logger-client';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api-config';
import { LIBRARIES_QUERY_KEY } from '@/hooks/useLibraries';
import { PLAYLISTS_QUERY_KEY } from '@/hooks/usePlaylists';

interface DeleteSongButtonProps {
  songId: string;
  songTitle: string;
  onDeleteSuccess?: () => void | Promise<void>;
}

export function DeleteSongButton({
  songId,
  songTitle,
  onDeleteSuccess,
}: DeleteSongButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [playlistCount, setPlaylistCount] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    
    if (open && playlistCount === null) {
      // Fetch playlist count when dialog opens
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: { count: number };
        }>(API_ENDPOINTS.songs.playlistCount(songId));
        
        if (response.success && response.data) {
          setPlaylistCount(response.data.count);
        }
      } catch (error) {
        logger.error('Failed to fetch playlist count', error);
        // Continue anyway, just don't show the count
      }
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      await apiClient.delete(API_ENDPOINTS.songs.delete(songId));

      toast({
        title: I18n.success.title,
        description: `${I18n.library.deleteSong.successPrefix}${songTitle}${I18n.library.deleteSong.successSuffix}`,
      });

      setIsOpen(false);

      // Invalidate queries to update counts on dashboard
      queryClient.invalidateQueries({ queryKey: LIBRARIES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PLAYLISTS_QUERY_KEY });

      if (onDeleteSuccess) {
        await onDeleteSuccess();
      }
    } catch (error) {
      logger.error('Failed to delete song', error);
      toast({
        title: I18n.error.title,
        description: I18n.error.failedToDeleteSong,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={I18n.library.deleteSong.buttonLabel}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{I18n.library.deleteSong.dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {I18n.library.deleteSong.dialogDescription}
            <strong className="block mt-2">{songTitle}</strong>
            {playlistCount !== null && playlistCount > 0 && (
              <span className="block mt-2 text-yellow-600">
                {I18n.library.deleteSong.playlistWarningPrefix}
                {playlistCount}
                {I18n.library.deleteSong.playlistWarningSuffix}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {I18n.common.cancelButton}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? I18n.common.deletingLabel : I18n.common.deleteButton}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
