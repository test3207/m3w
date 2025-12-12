/**
 * Library Selection Mode Header
 * Header bar shown when in multi-select mode
 */

import { Button } from "@/components/ui/button";
import { X, CheckSquare, ListMusic } from "lucide-react";
import { I18n } from "@/locales/i18n";
import type { SelectedSongInfo } from "@/stores/uiStore";

interface SelectionModeHeaderProps {
  selectedSongs: SelectedSongInfo[];
  onExit: () => void;
  onSelectAll: () => void;
  onAddToPlaylist: () => void;
}

export function SelectionModeHeader({
  selectedSongs,
  onExit,
  onSelectAll,
  onAddToPlaylist,
}: SelectionModeHeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-primary p-4 text-primary-foreground shadow-md border-b border-primary-foreground/20">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:bg-primary-foreground/20"
          onClick={onExit}
        >
          <X className="h-5 w-5" />
        </Button>
        <span className="font-medium">
          {I18n.libraries.detail.selection.selectedCount.replace("{0}", String(selectedSongs.length))}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-primary-foreground hover:bg-primary-foreground/20"
          onClick={onSelectAll}
        >
          <CheckSquare className="mr-1 h-4 w-4" />
          {I18n.libraries.detail.selection.selectAll}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={selectedSongs.length === 0}
          onClick={onAddToPlaylist}
        >
          <ListMusic className="mr-1 h-4 w-4" />
          {I18n.libraries.detail.selection.addToPlaylist}
        </Button>
      </div>
    </div>
  );
}
