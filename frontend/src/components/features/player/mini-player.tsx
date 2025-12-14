/**
 * Mini Player Component
 * Compact player displayed above bottom navigation
 */

import { Play, Pause, SkipForward } from "lucide-react";
import { CoverImage, CoverType, CoverSize } from "@/components/ui/cover-image";
import { usePlayerStore } from "@/stores/playerStore";
import { I18n } from "@/locales/i18n";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

export function MiniPlayer() {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
  const next = usePlayerStore((state) => state.next);
  const openFullPlayer = useUIStore((state) => state.openFullPlayer);

  if (!currentSong) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={I18n.player.miniPlayer.openFullPlayer}
      className="fixed bottom-16 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80"
      onClick={openFullPlayer}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFullPlayer();
        }
      }}
    >
      <div className="flex h-18 items-center gap-3 px-4 py-2">
        {/* Album Cover */}
        <CoverImage
          src={currentSong.coverUrl}
          alt={currentSong.title}
          type={CoverType.Song}
          size={CoverSize.MD}
          className="shrink-0"
        />

        {/* Song Info */}
        <div className="flex-1 overflow-hidden">
          <p className="truncate font-medium text-sm">{currentSong.title}</p>
          <p className="truncate text-xs text-muted-foreground">{currentSong.artist}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              "hover:bg-accent transition-colors"
            )}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              "hover:bg-accent transition-colors"
            )}
            aria-label="Next"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Safe area inset for iOS devices */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
