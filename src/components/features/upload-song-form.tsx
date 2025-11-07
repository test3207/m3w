"use client";

import { useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ERROR_MESSAGES, UI_TEXT } from "@/locales/messages";

interface LibraryOption {
  id: string;
  name: string;
  description: string | null;
  songCount: number;
}

interface UploadSongFormProps {
  libraries: LibraryOption[];
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

export function UploadSongForm({ libraries }: UploadSongFormProps) {
  const [libraryId, setLibraryId] = useState<string>(
    libraries[0]?.id ?? ""
  );
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
      setStatus({ type: "error", message: ERROR_MESSAGES.noAudioFileSelected });
      return;
    }

    if (!libraryId) {
      setStatus({ type: "error", message: ERROR_MESSAGES.noLibrarySelected });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("libraryId", libraryId);

    if (title.trim()) formData.append("title", title.trim());
    if (artist.trim()) formData.append("artist", artist.trim());
    if (album.trim()) formData.append("album", album.trim());
    if (albumArtist.trim()) formData.append("albumArtist", albumArtist.trim());
    if (genre.trim()) formData.append("genre", genre.trim());
    if (composer.trim()) formData.append("composer", composer.trim());
    if (year.trim()) formData.append("year", year.trim());
    if (trackNumber.trim()) formData.append("trackNumber", trackNumber.trim());
    if (discNumber.trim()) formData.append("discNumber", discNumber.trim());
    if (coverUrl.trim()) formData.append("coverUrl", coverUrl.trim());

    try {
      setSubmitting(true);
      setStatus(null);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        const message = result?.error ?? ERROR_MESSAGES.uploadFailed;
        setStatus({ type: "error", message });
        return;
      }

      const fallbackTitle = title.trim().length > 0 ? title.trim() : file.name;
      const songTitle: string =
        result.data?.song?.title ?? fallbackTitle;
      const duration: number | null = result.data?.upload?.metadata?.duration ?? null;
      const bitrate: number | null = result.data?.upload?.metadata?.bitrate ?? null;

      setStatus({
        type: "success",
        message: `${UI_TEXT.uploadForm.successPrefix}${songTitle}${UI_TEXT.uploadForm.successSuffix}${selectedLibraryName || UI_TEXT.uploadForm.successFallbackLibrary}`,
        details: {
          songTitle,
          libraryName: selectedLibraryName || "",
          duration,
          bitrate,
        },
      });

      resetForm();
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: ERROR_MESSAGES.uploadErrorGeneric });
    } finally {
      setSubmitting(false);
    }
  };

  const isReady = Boolean(file && libraryId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="library">{UI_TEXT.uploadForm.selectLibraryLabel}</Label>
        <select
          id="library"
          value={libraryId}
          onChange={(event) => setLibraryId(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {libraries.length === 0 ? (
            <option value="">{UI_TEXT.uploadForm.libraryOptionFallback}</option>
          ) : null}
          {libraries.map((library) => (
            <option key={library.id} value={library.id}>
              {library.name}（{library.songCount}{UI_TEXT.uploadForm.librarySongSuffix}）
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {UI_TEXT.uploadForm.selectLibraryPlaceholder}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">{UI_TEXT.uploadForm.selectFileLabel}</Label>
        <Input
          ref={fileInputRef}
          id="file"
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          required
        />
        <p className="text-xs text-muted-foreground">
          {UI_TEXT.uploadForm.fileHelper}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">{UI_TEXT.uploadForm.titleLabel}</Label>
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={UI_TEXT.uploadForm.titlePlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="artist">{UI_TEXT.uploadForm.artistLabel}</Label>
          <Input
            id="artist"
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
            placeholder={UI_TEXT.uploadForm.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="album">{UI_TEXT.uploadForm.albumLabel}</Label>
          <Input
            id="album"
            value={album}
            onChange={(event) => setAlbum(event.target.value)}
            placeholder={UI_TEXT.uploadForm.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="albumArtist">{UI_TEXT.uploadForm.albumArtistLabel}</Label>
          <Input
            id="albumArtist"
            value={albumArtist}
            onChange={(event) => setAlbumArtist(event.target.value)}
            placeholder={UI_TEXT.uploadForm.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="genre">{UI_TEXT.uploadForm.genreLabel}</Label>
          <Input
            id="genre"
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
            placeholder={UI_TEXT.uploadForm.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="composer">{UI_TEXT.uploadForm.composerLabel}</Label>
          <Input
            id="composer"
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            placeholder={UI_TEXT.uploadForm.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="year">{UI_TEXT.uploadForm.yearLabel}</Label>
          <Input
            id="year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            placeholder={UI_TEXT.uploadForm.yearPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trackNumber">{UI_TEXT.uploadForm.trackNumberLabel}</Label>
          <Input
            id="trackNumber"
            value={trackNumber}
            onChange={(event) => setTrackNumber(event.target.value)}
            placeholder={UI_TEXT.uploadForm.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discNumber">{UI_TEXT.uploadForm.discNumberLabel}</Label>
          <Input
            id="discNumber"
            value={discNumber}
            onChange={(event) => setDiscNumber(event.target.value)}
            placeholder={UI_TEXT.uploadForm.optionalPlaceholder}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="coverUrl">{UI_TEXT.uploadForm.coverLabel}</Label>
          <Textarea
            id="coverUrl"
            value={coverUrl}
            onChange={(event) => setCoverUrl(event.target.value)}
            placeholder={UI_TEXT.uploadForm.coverPlaceholder}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!isReady || submitting}>
          {submitting ? UI_TEXT.uploadForm.uploadingLabel : UI_TEXT.uploadForm.uploadButton}
        </Button>
        <Button type="button" variant="ghost" onClick={resetForm} disabled={submitting}>
          {UI_TEXT.uploadForm.resetButton}
        </Button>
      </div>

      {status?.type === "success" ? (
        <div className="rounded-lg border border-green-500/40 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p>{status.message}</p>
          <div className="mt-2 text-xs text-green-800">
            <p>
              {UI_TEXT.uploadForm.successDurationPrefix}
              {status.details.duration 
                ? `${status.details.duration}${UI_TEXT.uploadForm.durationUnit}` 
                : UI_TEXT.uploadForm.successDurationFallback}
            </p>
            <p>
              {UI_TEXT.uploadForm.successBitratePrefix}
              {status.details.bitrate 
                ? `${status.details.bitrate}${UI_TEXT.uploadForm.bitrateUnit}` 
                : UI_TEXT.uploadForm.successBitrateFallback}
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
