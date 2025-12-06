/**
 * Upload file list item component
 */

import { Button } from "@/components/ui/button";
import { VStack, HStack } from "@/components/ui/stack";
import { Text } from "@/components/ui/text";
import { CheckCircle2, XCircle, Loader2, Music } from "lucide-react";
import { I18n } from "@/locales/i18n";
import { getFileName } from "@/lib/utils/audio-filter";
import { UploadStatus, type FileUploadItem } from "./types";

interface FileItemProps {
  item: FileUploadItem;
  index: number;
  uploading: boolean;
  onRemove: (index: number) => void;
}

export function FileItem({ item, index, uploading, onRemove }: FileItemProps) {
  return (
    <HStack
      gap="sm"
      align="center"
      className="rounded-lg border bg-card p-3 text-sm"
    >
      <div className="shrink-0" role="img" aria-label="Status icon">
        {item.status === UploadStatus.Pending && (
          <Music className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        )}
        {item.status === UploadStatus.Uploading && (
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" aria-hidden="true" />
        )}
        {item.status === UploadStatus.Success && (
          <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
        )}
        {item.status === UploadStatus.Error && (
          <XCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
        )}
      </div>

      <VStack gap="xs" className="flex-1 min-w-0">
        <Text variant="body" className="font-medium truncate">
          {item.songTitle || getFileName(item.file)}
        </Text>
        <Text variant="caption" color="muted">
          {(item.file.size / 1024 / 1024).toFixed(2)} MB
        </Text>
        {item.error && (
          <Text variant="caption" color="destructive">{item.error}</Text>
        )}
      </VStack>

      {item.status === UploadStatus.Pending && !uploading && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
        >
          {I18n.upload.form.removeButton}
        </Button>
      )}
    </HStack>
  );
}
