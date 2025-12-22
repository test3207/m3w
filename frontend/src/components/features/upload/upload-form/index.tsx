/**
 * Upload Song Form Component
 *
 * Main form for uploading audio files to a library.
 * Supports both individual file selection and folder upload.
 */

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VStack, HStack } from "@/components/ui/stack";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { FormDescription } from "@/components/ui/form-description";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/use-toast";
import { useLibraryStore } from "@/stores/libraryStore";
import { usePlaylistStore } from "@/stores/playlistStore";
import { I18n } from "@/locales/i18n";
import { logger } from "@/lib/logger-client";
import { eventBus, EVENTS } from "@/lib/events";
import { processAudioFileStream } from "@/lib/utils/stream-processor";
import { api } from "@/services";
import type { LibraryOption } from "@/types/models";
import { LibraryBig } from "lucide-react";
// Import from specific subpath to avoid pulling Zod into main bundle
import { isDefaultLibrary } from "@m3w/shared/constants";

import { UploadStatus, type FileUploadItem, type UploadSongFormProps } from "./types";
import { FileInputSection } from "./file-input-section";
import { FileList } from "./file-list";

export function UploadSongForm({ onDrawerClose, targetLibraryId }: UploadSongFormProps) {
  const { toast } = useToast();
  const { libraries, fetchLibraries } = useLibraryStore();
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists);

  // Compute library options from libraries
  const libraryOptions: LibraryOption[] = useMemo(() => {
    return libraries.map((library) => ({
      id: library.id,
      name: library.name,
      description: library.description ?? null,
      songCount: library.songCount ?? 0,
    }));
  }, [libraries]);

  // Get default library ID - prefer targetLibraryId if provided
  const defaultLibraryId = useMemo(() => {
    if (targetLibraryId) return targetLibraryId;
    if (libraries.length === 0) return "";
    const defaultLibrary = libraries.find(isDefaultLibrary);
    return defaultLibrary?.id || libraries[0].id;
  }, [libraries, targetLibraryId]);

  const [libraryId, setLibraryId] = useState<string>("");
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const loading = libraries.length === 0;

  // Fetch libraries on mount
  useEffect(() => {
    if (libraries.length === 0) {
      fetchLibraries();
    }
  }, [libraries.length, fetchLibraries]);

  // Set library ID when libraries are loaded
  useEffect(() => {
    if (!libraryId && defaultLibraryId) {
      setLibraryId(defaultLibraryId);
    }
  }, [libraryId, defaultLibraryId]);

  const handleUploadSuccess = async () => {
    logger.info("Upload completed, refreshing data");

    // Fetch updated data - Router will automatically cache these GET responses to IndexedDB
    await fetchLibraries();
    await fetchPlaylists();
    
    eventBus.emit(EVENTS.SONG_UPLOADED);

    if (onDrawerClose) {
      setTimeout(() => onDrawerClose(), 2000);
    }
  };

  const handleFilesSelected = (newFiles: FileUploadItem[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setFiles([]);
  };

  const uploadFile = async (item: FileUploadItem, index: number): Promise<void> => {
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, status: UploadStatus.Uploading } : f
      )
    );

    const { file } = item;
    
    // Stream-process: extract hash and cover in parallel (memory-efficient)
    let hash: string;
    let coverBlob: Blob | null = null;
    try {
      const result = await processAudioFileStream(file);
      hash = result.hash;
      coverBlob = result.coverBlob;
    } catch (err) {
      // If streaming fails, try hash-only fallback
      logger.warn("Stream processing failed, falling back to hash-only", { fileName: file.name, error: err });
      const { calculateFileHash } = await import("@/lib/utils/hash");
      hash = await calculateFileHash(file);
    }
    
    // Upload to backend
    const data = await api.main.libraries.uploadSong(libraryId, file, hash);
    const songId = data.song.id;
    const songTitle = data.song.title || file.name;
    
    // Cache audio and cover for offline use (non-blocking, fail silently)
    // Dynamic import to avoid loading cache-manager in initial bundle
    try {
      const { cacheAudioForOffline, cacheCoverForOffline } = await import("@/lib/pwa/cache-manager");
      await cacheAudioForOffline(songId, file);
      if (coverBlob) {
        await cacheCoverForOffline(songId, coverBlob);
      }
      logger.debug("Cached uploaded file for offline use", { songId });
    } catch (err) {
      // Non-critical: upload succeeded, caching failed
      logger.warn("Failed to cache uploaded file", { songId, error: err });
    }

    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, status: UploadStatus.Success, songTitle } : f
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (files.length === 0) {
      toast({
        title: I18n.error.title,
        description: I18n.error.noAudioFileSelected,
        variant: "destructive",
      });
      return;
    }

    if (!libraryId) {
      toast({
        title: I18n.error.title,
        description: I18n.error.noLibrarySelected,
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        if (item.status === UploadStatus.Pending || item.status === UploadStatus.Error) {
          try {
            await uploadFile(item, i);
            successCount++;
          } catch (err) {
            errorCount++;
            const errorMessage = err instanceof Error ? err.message : I18n.error.uploadErrorGeneric;
            setFiles((prev) =>
              prev.map((f, idx) =>
                idx === i ? { ...f, status: UploadStatus.Error, error: errorMessage } : f
              )
            );
            logger.error("Upload failed", { fileName: item.file.name, error: err });
          }
        } else if (item.status === UploadStatus.Success) {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: I18n.success.title,
          description: `${I18n.upload.form.successUploadedCount}${successCount}${I18n.upload.form.successUploadedSuffix}`,
        });
        await handleUploadSuccess();
      }

      if (errorCount > 0) {
        toast({
          title: I18n.error.title,
          description: `${errorCount}${I18n.upload.form.errorUploadedSuffix}`,
          variant: "destructive",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  // Count completed files (success + error) for progress display like "Uploading (2/5)"
  const completedCount = files.filter(
    (f) => f.status === UploadStatus.Success || f.status === UploadStatus.Error
  ).length;
  const showLibrarySelector = !targetLibraryId && libraryOptions.length > 1;

  // Loading state
  if (loading) {
    return (
      <VStack gap="md" align="center" justify="center" className="flex-1 py-12">
        <Text variant="body" color="muted">{I18n.common.loadingLabel}</Text>
      </VStack>
    );
  }

  // Empty state
  if (libraryOptions.length === 0) {
    return (
      <EmptyState
        icon={<LibraryBig className="h-12 w-12" />}
        title={I18n.upload.page.emptyState}
        action={
          <Button variant="outline" onClick={() => onDrawerClose?.()}>
            {I18n.library.manager.form.submitLabel}
          </Button>
        }
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <VStack gap="lg" className="flex-1 overflow-y-auto">
        {showLibrarySelector && (
          <VStack gap="xs">
            <Label htmlFor="library">{I18n.upload.form.selectLibraryLabel}</Label>
            <Select value={libraryId} onValueChange={setLibraryId} disabled={uploading}>
              <SelectTrigger id="library">
                <SelectValue placeholder={I18n.upload.form.libraryOptionFallback} />
              </SelectTrigger>
              <SelectContent>
                {libraryOptions.map((library) => (
                  <SelectItem key={library.id} value={library.id}>
                    {library.name} ({library.songCount}{I18n.upload.form.librarySongSuffix})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>{I18n.upload.form.selectLibraryPlaceholder}</FormDescription>
          </VStack>
        )}

        <FileInputSection uploading={uploading} onFilesSelected={handleFilesSelected} />

        <FileList
          files={files}
          uploading={uploading}
          onRemoveFile={handleRemoveFile}
          onClearAll={handleClearAll}
        />
      </VStack>

      <HStack gap="sm" className="mt-4 pt-4 border-t bg-background">
        <Button type="submit" disabled={files.length === 0 || !libraryId || uploading}>
          {uploading
            ? `${I18n.upload.form.uploadingLabel} (${completedCount}/${files.length})`
            : I18n.upload.form.uploadButton}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleClearAll}
          disabled={uploading || files.length === 0}
        >
          {I18n.upload.form.resetButton}
        </Button>
      </HStack>
    </form>
  );
}

// Re-export types for external use
export type { UploadSongFormProps, FileUploadItem } from "./types";
export { UploadStatus } from "./types";
