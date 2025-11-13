"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { I18n } from "@/locales/i18n";
import { logger } from "@/lib/logger-client";
import { calculateFileHash } from "@/lib/utils/hash";
import { api } from "@/services";
import type { LibraryOption } from "@/types/models";
import { CheckCircle2, XCircle, Loader2, Music } from "lucide-react";

interface UploadSongFormProps {
  libraries: LibraryOption[];
  onUploadSuccess?: () => void | Promise<void>;
}

interface FileUploadItem {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress?: number;
  error?: string;
  songTitle?: string;
}

export function UploadSongForm({ libraries, onUploadSuccess }: UploadSongFormProps) {
  const { toast } = useToast();
  const [libraryId, setLibraryId] = useState<string>(libraries[0]?.id ?? "");
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

    // 1. Calculate file hash
    logger.info("Calculating file hash...", { fileName: file.name });
    const hash = await calculateFileHash(file);
    logger.info("File hash calculated", { hash, fileName: file.name });

    // 2. Upload to backend (metadata will be extracted automatically)
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

    console.log('[UploadSongForm] File upload success, set status to success:', { fileName: file.name, songTitle, index });
    logger.info("File uploaded successfully", { fileName: file.name, songTitle });
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

      console.log('[UploadSongForm] Upload complete:', { successCount, errorCount, hasCallback: !!onUploadSuccess });

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
      if (successCount > 0 && onUploadSuccess) {
        console.log('[UploadSongForm] Calling onUploadSuccess');
        await onUploadSuccess();
        console.log('[UploadSongForm] onUploadSuccess completed');
      }
    } finally {
      setUploading(false);
    }
  };

  const uploadingCount = files.filter((f) => f.status === "uploading").length;
  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="library">{I18n.upload.form.selectLibraryLabel}</Label>
        <select
          id="library"
          value={libraryId}
          onChange={(event) => setLibraryId(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          disabled={uploading}
        >
          {libraries.length === 0 ? (
            <option value="">{I18n.upload.form.libraryOptionFallback}</option>
          ) : null}
          {libraries.map((library) => (
            <option key={library.id} value={library.id}>
              {library.name} ({library.songCount}
              {I18n.upload.form.librarySongSuffix})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {I18n.upload.form.selectLibraryPlaceholder}
        </p>
      </div>

      <div className="space-y-2">
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
        <p className="text-xs text-muted-foreground">
          {I18n.upload.form.multiFileHelper}
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {I18n.upload.form.selectedFilesTitle} ({files.length})
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAllFiles}
              disabled={uploading}
            >
              {I18n.upload.form.clearAllButton}
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {files.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm"
              >
                <div className="shrink-0">
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

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {item.songTitle || item.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(item.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {item.error && (
                    <p className="text-xs text-destructive mt-1">{item.error}</p>
                  )}
                </div>

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
              </div>
            ))}
          </div>

          {(successCount > 0 || errorCount > 0) && (
            <div className="flex gap-4 text-sm">
              {successCount > 0 && (
                <span className="text-green-600">
                  ✓ {successCount} {I18n.upload.form.successLabel}
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-destructive">
                  ✗ {errorCount} {I18n.upload.form.errorLabel}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
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
      </div>
    </form>
  );
}
