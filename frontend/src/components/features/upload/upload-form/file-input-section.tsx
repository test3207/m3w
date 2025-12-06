/**
 * File and folder input selectors
 */

import { useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { HStack, VStack } from "@/components/ui/stack";
import { FormDescription } from "@/components/ui/form-description";
import { FolderOpen, Music } from "lucide-react";
import { I18n } from "@/locales/i18n";
import { filterAudioFiles, isFolderSelectionSupported } from "@/lib/utils/audio-filter";
import { useToast } from "@/components/ui/use-toast";
import { UploadStatus, type FileUploadItem } from "./types";

interface FileInputSectionProps {
  uploading: boolean;
  onFilesSelected: (files: FileUploadItem[]) => void;
}

export function FileInputSection({ uploading, onFilesSelected }: FileInputSectionProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  
  const folderSelectionSupported = useMemo(() => isFolderSelectionSupported(), []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    
    if (selectedFiles.length === 0) return;

    const newFiles: FileUploadItem[] = selectedFiles.map((file) => ({
      file,
      status: UploadStatus.Pending,
    }));

    onFilesSelected(newFiles);
  };

  const handleFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    
    if (selectedFiles.length === 0) return;

    const { audioFiles, skippedCount } = filterAudioFiles(selectedFiles);
    
    if (audioFiles.length === 0) {
      toast({
        title: I18n.error.title,
        description: I18n.upload.form.noAudioInFolder,
        variant: "destructive",
      });
      return;
    }

    const newFiles: FileUploadItem[] = audioFiles.map((file) => ({
      file,
      status: UploadStatus.Pending,
    }));

    onFilesSelected(newFiles);

    // Show feedback about discovered files
    const description = skippedCount > 0
      ? `${I18n.upload.form.foundAudioFiles.replace("{0}", String(audioFiles.length))} (${I18n.upload.form.skippedNonAudio.replace("{0}", String(skippedCount))})`
      : I18n.upload.form.foundAudioFiles.replace("{0}", String(audioFiles.length));
    
    toast({
      title: I18n.success.title,
      description,
    });
    
    // Reset folder input to allow re-selecting the same folder
    if (folderInputRef.current) {
      folderInputRef.current.value = "";
    }
  };

  return (
    <VStack gap="xs">
      <Label>{I18n.upload.form.selectFilesLabel}</Label>
      <HStack gap="sm" className="w-full">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          multiple
          disabled={uploading}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1"
          aria-label={I18n.upload.form.selectFilesLabel}
        >
          <Music className="h-4 w-4 mr-2" aria-hidden="true" />
          {I18n.upload.form.selectFilesLabel}
        </Button>
        {folderSelectionSupported && (
          <>
            {/* Hidden folder input */}
            <input
              ref={folderInputRef}
              type="file"
              onChange={handleFolderChange}
              disabled={uploading}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              // @ts-expect-error - webkitdirectory is a non-standard attribute
              webkitdirectory=""
              directory=""
              multiple
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
              className="flex-1"
              aria-label={I18n.upload.form.selectFolderLabel}
            >
              <FolderOpen className="h-4 w-4 mr-2" aria-hidden="true" />
              {I18n.upload.form.selectFolderLabel}
            </Button>
          </>
        )}
      </HStack>
      <FormDescription>
        {folderSelectionSupported
          ? I18n.upload.form.folderHelper
          : I18n.upload.form.multiFileHelper}
      </FormDescription>
    </VStack>
  );
}
