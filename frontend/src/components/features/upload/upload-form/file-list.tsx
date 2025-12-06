/**
 * Upload file list component
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VStack, HStack } from "@/components/ui/stack";
import { Text } from "@/components/ui/text";
import { I18n } from "@/locales/i18n";
import { UploadStatus, type FileUploadItem } from "./types";
import { FileItem } from "./file-item";

interface FileListProps {
  files: FileUploadItem[];
  uploading: boolean;
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
}

export function FileList({ files, uploading, onRemoveFile, onClearAll }: FileListProps) {
  const successCount = files.filter((f) => f.status === UploadStatus.Success).length;
  const errorCount = files.filter((f) => f.status === UploadStatus.Error).length;

  if (files.length === 0) {
    return null;
  }

  return (
    <VStack gap="sm">
      <HStack justify="between" align="center">
        <Text variant="h6" className="text-sm font-medium">
          {I18n.upload.form.selectedFilesTitle} ({files.length})
        </Text>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          disabled={uploading}
        >
          {I18n.upload.form.clearAllButton}
        </Button>
      </HStack>

      <VStack gap="xs" className="max-h-96 overflow-y-auto" role="list" aria-label="Selected files">
        {files.map((item, index) => (
          <FileItem
            key={index}
            item={item}
            index={index}
            uploading={uploading}
            onRemove={onRemoveFile}
          />
        ))}
      </VStack>

      {(successCount > 0 || errorCount > 0) && (
        <HStack gap="md" className="text-sm" role="status" aria-live="polite">
          {successCount > 0 && (
            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
              ✓ {successCount} {I18n.upload.form.successLabel}
            </Badge>
          )}
          {errorCount > 0 && (
            <Badge variant="destructive">
              ✗ {errorCount} {I18n.upload.form.errorLabel}
            </Badge>
          )}
        </HStack>
      )}
    </VStack>
  );
}
