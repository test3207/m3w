import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/use-toast";
import { useLibraryStore } from "@/stores/libraryStore";
import { usePlaylistStore } from "@/stores/playlistStore";
import { I18n } from "@/locales/i18n";
import { logger } from "@/lib/logger-client";
import { eventBus, EVENTS } from "@/lib/events";
import { calculateFileHash } from "@/lib/utils/hash";
import { api } from "@/services";
import type { LibraryOption } from "@/types/models";
import { CheckCircle2, XCircle, Loader2, Music, LibraryBig } from "lucide-react";
import { isDefaultLibrary } from "@m3w/shared";

interface UploadSongFormProps {
  onDrawerClose?: () => void;
  targetLibraryId?: string | null;
}

interface FileUploadItem {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress?: number;
  error?: string;
  songTitle?: string;
}

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
    if (libraries.length === 0) return '';
    const defaultLibrary = libraries.find(isDefaultLibrary);
    return defaultLibrary?.id || libraries[0].id;
  }, [libraries, targetLibraryId]);

  const [libraryId, setLibraryId] = useState<string>('');
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
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
    logger.info('Upload completed, refreshing data');
    
    // Refresh libraries to update song counts
    await fetchLibraries();
    
    // Refresh playlists (in case new songs added)
    await fetchPlaylists();
    
    // Emit event to notify other components
    eventBus.emit(EVENTS.SONG_UPLOADED);
    
    // Close drawer after 2 seconds to let user see success toast
    if (onDrawerClose) {
      setTimeout(() => {
        onDrawerClose();
      }, 2000);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    
    if (selectedFiles.length === 0) return;

    const newFiles: FileUploadItem[] = selectedFiles.map((file) => ({
      file,
      status: "pending" as const,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (item: FileUploadItem, index: number): Promise<void> => {
    // Update status to uploading
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, status: "uploading" as const } : f
      )
    );

    const { file } = item;

    // Calculate file hash and upload
    const hash = await calculateFileHash(file);
    const data = await api.main.upload.uploadFile(libraryId, file, hash);
    const songTitle = data.song.title || file.name;

    // Update status to success
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index
          ? { ...f, status: "success" as const, songTitle }
          : f
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

      // Track success/error counts during upload
      let successCount = 0;
      let errorCount = 0;

      // Upload files sequentially to avoid overwhelming the server
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        if (item.status === "pending" || item.status === "error") {
          try {
            await uploadFile(item, i);
            successCount++;
          } catch (err) {
            errorCount++;
            // Update status to error
            const errorMessage = err instanceof Error ? err.message : I18n.error.uploadErrorGeneric;
            setFiles((prev) =>
              prev.map((f, idx) =>
                idx === i
                  ? { ...f, status: "error" as const, error: errorMessage }
                  : f
              )
            );
            logger.error("Upload failed", { fileName: item.file.name, error: err });
          }
        } else if (item.status === "success") {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: I18n.success.title,
          description: `${I18n.upload.form.successUploadedCount}${successCount}${I18n.upload.form.successUploadedSuffix}`,
        });
      }

      if (errorCount > 0) {
        toast({
          title: I18n.error.title,
          description: `${errorCount}${I18n.upload.form.errorUploadedSuffix}`,
          variant: "destructive",
        });
      }

      // Refresh libraries data after showing toast
      if (successCount > 0) {
        await handleUploadSuccess();
      }
    } finally {
      setUploading(false);
    }
  };

  const uploadingCount = files.filter((f) => f.status === "uploading").length;
  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  // Hide selector if targetLibraryId is provided (from library detail page) or only one library
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
          <Button
            variant="outline"
            onClick={() => {
              if (onDrawerClose) onDrawerClose();
              // Navigation to libraries page handled by parent
            }}
          >
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
          <Select
            value={libraryId}
            onValueChange={setLibraryId}
            disabled={uploading}
          >
            <SelectTrigger id="library">
              <SelectValue placeholder={I18n.upload.form.libraryOptionFallback} />
            </SelectTrigger>
            <SelectContent>
              {libraryOptions.map((library) => (
                <SelectItem key={library.id} value={library.id}>
                  {library.name} ({library.songCount}
                  {I18n.upload.form.librarySongSuffix})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormDescription>
            {I18n.upload.form.selectLibraryPlaceholder}
          </FormDescription>
        </VStack>
      )}

        <VStack gap="xs">
        <Label htmlFor="file">{I18n.upload.form.selectFilesLabel}</Label>
        <Input
          ref={fileInputRef}
          id="file"
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          multiple
          disabled={uploading}
        />
        <FormDescription>
          {I18n.upload.form.multiFileHelper}
        </FormDescription>
        </VStack>

        {files.length > 0 && (
        <VStack gap="sm">
          <HStack justify="between" align="center">
            <Text variant="h6" className="text-sm font-medium">
              {I18n.upload.form.selectedFilesTitle} ({files.length})
            </Text>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAllFiles}
              disabled={uploading}
            >
              {I18n.upload.form.clearAllButton}
            </Button>
          </HStack>

          <VStack gap="xs" className="max-h-96 overflow-y-auto">
            {files.map((item, index) => (
              <HStack
                key={index}
                gap="sm"
                align="center"
                className="rounded-lg border bg-card p-3 text-sm"
              >
                <div className="shrink-0" role="img" aria-label="Status icon">
                  {item.status === "pending" && (
                    <Music className="h-5 w-5 text-muted-foreground" />
                  )}
                  {item.status === "uploading" && (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  )}
                  {item.status === "success" && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  {item.status === "error" && (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>

                <VStack gap="xs" className="flex-1 min-w-0">
                  <Text variant="body" className="font-medium truncate">
                    {item.songTitle || item.file.name}
                  </Text>
                  <Text variant="caption" color="muted">
                    {(item.file.size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                  {item.error && (
                    <Text variant="caption" color="destructive">{item.error}</Text>
                  )}
                </VStack>

                {item.status === "pending" && !uploading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    {I18n.upload.form.removeButton}
                  </Button>
                )}
              </HStack>
            ))}
          </VStack>

          {(successCount > 0 || errorCount > 0) && (
            <HStack gap="md" className="text-sm">
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
      )}
      </VStack>

      {/* Fixed bottom buttons */}
      <HStack gap="sm" className="mt-4 pt-4 border-t bg-background">
        <Button type="submit" disabled={files.length === 0 || !libraryId || uploading}>
          {uploading
            ? `${I18n.upload.form.uploadingLabel} (${uploadingCount}/${files.length})`
            : I18n.upload.form.uploadButton}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={clearAllFiles}
          disabled={uploading || files.length === 0}
        >
          {I18n.upload.form.resetButton}
        </Button>
      </HStack>
    </form>
  );
}
