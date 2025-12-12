/**
 * Library Action Bar
 * Action buttons for library detail page (play, download, upload, sort)
 */

import { Button } from "@/components/ui/button";
import { Play, Upload, Download, ListMusic, ArrowUpDown } from "lucide-react";
import { I18n } from "@/locales/i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SongSortOption } from "@m3w/shared";

interface LibraryActionBarProps {
  songsCount: number;
  isSelectionMode: boolean;
  isDownloading: boolean;
  showDownloadButton: boolean;
  canWrite: boolean;
  disabledReason?: string;
  sortOption: SongSortOption;
  onPlayAll: () => void;
  onDownloadAll: () => void;
  onUpload: () => void;
  onEnterSelectionMode: () => void;
  onSortChange: (option: SongSortOption) => void;
}

export function LibraryActionBar({
  songsCount,
  isSelectionMode,
  isDownloading,
  showDownloadButton,
  canWrite,
  disabledReason,
  sortOption,
  onPlayAll,
  onDownloadAll,
  onUpload,
  onEnterSelectionMode,
  onSortChange,
}: LibraryActionBarProps) {
  return (
    <div className="mb-4 flex gap-2">
      <Button
        onClick={onPlayAll}
        disabled={songsCount === 0 || isSelectionMode}
        className="flex-1"
      >
        <Play className="mr-2 h-4 w-4" />
        {I18n.libraries.detail.playAll}
      </Button>

      {showDownloadButton && (
        <Button
          variant="outline"
          disabled={songsCount === 0 || isSelectionMode || isDownloading}
          onClick={onDownloadAll}
          title={I18n.libraries.detail.cache.downloadAll}
        >
          <Download className="h-4 w-4" />
        </Button>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={!canWrite ? 0 : undefined}>
              <Button
                variant="outline"
                disabled={isSelectionMode || !canWrite}
                onClick={onUpload}
              >
                <Upload className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          {disabledReason && (
            <TooltipContent>
              <p>{disabledReason}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <Button
        variant="outline"
        disabled={songsCount === 0 || isSelectionMode}
        onClick={onEnterSelectionMode}
      >
        <ListMusic className="h-4 w-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={isSelectionMode}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onSortChange("date-desc")}>
            {sortOption === "date-desc" && "✓ "}
            {I18n.libraries.detail.sort.dateDesc}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("date-asc")}>
            {sortOption === "date-asc" && "✓ "}
            {I18n.libraries.detail.sort.dateAsc}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("title-asc")}>
            {sortOption === "title-asc" && "✓ "}
            {I18n.libraries.detail.sort.titleAsc}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("title-desc")}>
            {sortOption === "title-desc" && "✓ "}
            {I18n.libraries.detail.sort.titleDesc}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("artist-asc")}>
            {sortOption === "artist-asc" && "✓ "}
            {I18n.libraries.detail.sort.artistAsc}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("album-asc")}>
            {sortOption === "album-asc" && "✓ "}
            {I18n.libraries.detail.sort.albumAsc}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
