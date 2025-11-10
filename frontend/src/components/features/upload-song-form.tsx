"use client";

import { useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { I18n } from "@/locales/i18n";
import { logger } from "@/lib/logger-client";
import { calculateFileHash } from "@/lib/utils/hash";
import { apiClient } from "@/lib/api/client";
import type { LibraryOption } from "@/types/models";

interface UploadSongFormProps {
  libraries: LibraryOption[];
  onUploadSuccess?: () => void | Promise<void>;
}

type UploadStatus =
  | {
      type: "success";
      message: string;
      details: {
        songTitle: string;
        libraryName: string;
        duration: number | null;
        bitrate: number | null;
      };
    }
  | {
      type: "error";
      message: string;
    }
  | null;

export function UploadSongForm({ libraries, onUploadSuccess }: UploadSongFormProps) {
  const { toast } = useToast();
  const [libraryId, setLibraryId] = useState<string>(libraries[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [artist, setArtist] = useState<string>("");
  const [album, setAlbum] = useState<string>("");
  const [albumArtist, setAlbumArtist] = useState<string>("");
  const [genre, setGenre] = useState<string>("");
  const [composer, setComposer] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [trackNumber, setTrackNumber] = useState<string>("");
  const [discNumber, setDiscNumber] = useState<string>("");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [status, setStatus] = useState<UploadStatus>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedLibraryName = useMemo(() => {
    return libraries.find((lib) => lib.id === libraryId)?.name ?? "";
  }, [libraries, libraryId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);

    if (selectedFile && title.trim().length === 0) {
      const defaultTitle = selectedFile.name.replace(/\.[^.]+$/, "");
      setTitle(defaultTitle);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setArtist("");
    setAlbum("");
    setAlbumArtist("");
    setGenre("");
    setComposer("");
    setYear("");
    setTrackNumber("");
    setDiscNumber("");
    setCoverUrl("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setStatus({ type: "error", message: I18n.error.noAudioFileSelected });
      return;
    }

    if (!libraryId) {
      setStatus({ type: "error", message: I18n.error.noLibrarySelected });
      return;
    }

    try {
      setSubmitting(true);
      setStatus(null);

      // 1. 计算文件 hash
      logger.info("Calculating file hash...");
      const hash = await calculateFileHash(file);
      logger.info("File hash calculated", { hash });

      // 2. 准备上传数据
      const formData = new FormData();
      formData.append("file", file);
      formData.append("hash", hash); // 传递 hash 给后端
      formData.append("libraryId", libraryId);

      if (title.trim()) formData.append("title", title.trim());
      if (artist.trim()) formData.append("artist", artist.trim());
      if (album.trim()) formData.append("album", album.trim());
      if (albumArtist.trim())
        formData.append("albumArtist", albumArtist.trim());
      if (genre.trim()) formData.append("genre", genre.trim());
      if (composer.trim()) formData.append("composer", composer.trim());
      if (year.trim()) formData.append("year", year.trim());
      if (trackNumber.trim())
        formData.append("trackNumber", trackNumber.trim());
      if (discNumber.trim()) formData.append("discNumber", discNumber.trim());
      if (coverUrl.trim()) formData.append("coverUrl", coverUrl.trim());

      // 3. 上传到后端
      const result = await apiClient.upload<{ 
        success: boolean; 
        data?: { 
          song?: { 
            title?: string; 
            file?: { duration?: number; bitrate?: number } 
          } 
        };
        error?: string;
      }>('/upload/song', formData);

      if (!result?.success) {
        const message = result?.error ?? I18n.error.uploadFailed;
        setStatus({ type: "error", message });
        toast({
          title: I18n.error.title,
          description: message,
          variant: "destructive",
        });
        return;
      }

      const fallbackTitle = title.trim().length > 0 ? title.trim() : file.name;
      const songTitle: string = result.data?.song?.title ?? fallbackTitle;
      const duration: number | null = result.data?.song?.file?.duration ?? null;
      const bitrate: number | null = result.data?.song?.file?.bitrate ?? null;

      const successMessage = `${I18n.upload.form.successPrefix}${songTitle}${
        I18n.upload.form.successSuffix
      }${selectedLibraryName || I18n.upload.form.successFallbackLibrary}`;

      setStatus({
        type: "success",
        message: successMessage,
        details: {
          songTitle,
          libraryName: selectedLibraryName || "",
          duration,
          bitrate,
        },
      });

      toast({
        title: I18n.success.title,
        description: successMessage,
      });

      resetForm();
      
      // 刷新 libraries 数据
      if (onUploadSuccess) {
        await onUploadSuccess();
      }
    } catch (error) {
      logger.error("Upload failed", error);
      const errorMessage = I18n.error.uploadErrorGeneric;
      setStatus({ type: "error", message: errorMessage });
      toast({
        title: I18n.error.title,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isReady = Boolean(file && libraryId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="library">{I18n.upload.form.selectLibraryLabel}</Label>
        <select
          id="library"
          value={libraryId}
          onChange={(event) => setLibraryId(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
        <Label htmlFor="file">{I18n.upload.form.selectFileLabel}</Label>
        <Input
          ref={fileInputRef}
          id="file"
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          required
        />
        <p className="text-xs text-muted-foreground">
          {I18n.upload.form.fileHelper}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">{I18n.upload.form.titleLabel}</Label>
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={I18n.upload.form.titlePlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="artist">{I18n.upload.form.artistLabel}</Label>
          <Input
            id="artist"
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
            placeholder={I18n.upload.form.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="album">{I18n.upload.form.albumLabel}</Label>
          <Input
            id="album"
            value={album}
            onChange={(event) => setAlbum(event.target.value)}
            placeholder={I18n.upload.form.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="albumArtist">
            {I18n.upload.form.albumArtistLabel}
          </Label>
          <Input
            id="albumArtist"
            value={albumArtist}
            onChange={(event) => setAlbumArtist(event.target.value)}
            placeholder={I18n.upload.form.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="genre">{I18n.upload.form.genreLabel}</Label>
          <Input
            id="genre"
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
            placeholder={I18n.upload.form.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="composer">{I18n.upload.form.composerLabel}</Label>
          <Input
            id="composer"
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            placeholder={I18n.upload.form.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="year">{I18n.upload.form.yearLabel}</Label>
          <Input
            id="year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            placeholder={I18n.upload.form.yearPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trackNumber">
            {I18n.upload.form.trackNumberLabel}
          </Label>
          <Input
            id="trackNumber"
            value={trackNumber}
            onChange={(event) => setTrackNumber(event.target.value)}
            placeholder={I18n.upload.form.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discNumber">{I18n.upload.form.discNumberLabel}</Label>
          <Input
            id="discNumber"
            value={discNumber}
            onChange={(event) => setDiscNumber(event.target.value)}
            placeholder={I18n.upload.form.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="coverUrl">{I18n.upload.form.coverLabel}</Label>
          <Textarea
            id="coverUrl"
            value={coverUrl}
            onChange={(event) => setCoverUrl(event.target.value)}
            placeholder={I18n.upload.form.coverPlaceholder}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!isReady || submitting}>
          {submitting
            ? I18n.upload.form.uploadingLabel
            : I18n.upload.form.uploadButton}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={resetForm}
          disabled={submitting}
        >
          {I18n.upload.form.resetButton}
        </Button>
      </div>

      {status?.type === "success" ? (
        <div className="rounded-lg border border-green-500/40 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p>{status.message}</p>
          <div className="mt-2 text-xs text-green-800">
            <p>
              {I18n.upload.form.successDurationPrefix}
              {status.details.duration
                ? `${status.details.duration}${I18n.upload.form.durationUnit}`
                : I18n.upload.form.successDurationFallback}
            </p>
            <p>
              {I18n.upload.form.successBitratePrefix}
              {status.details.bitrate
                ? `${status.details.bitrate}${I18n.upload.form.bitrateUnit}`
                : I18n.upload.form.successBitrateFallback}
            </p>
          </div>
        </div>
      ) : null}

      {status?.type === "error" ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {status.message}
        </div>
      ) : null}
    </form>
  );
}
