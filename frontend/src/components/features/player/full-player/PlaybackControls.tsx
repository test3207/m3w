/**
 * FullPlayer Controls Component
 * 
 * Primary playback controls (previous, play/pause, next) and
 * secondary controls (shuffle, favorite, repeat).
 */

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Stack } from "@/components/ui/stack";
import {
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
} from "lucide-react";
import { I18n } from "@/locales/i18n";
// Import from specific subpath to avoid pulling Zod into main bundle
import { RepeatMode } from "@m3w/shared/types";

interface PlaybackControlsProps {
  isPlaying: boolean;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  isFavorited: boolean;
  onTogglePlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleFavorite: () => void;
}

export function PlaybackControls({
  isPlaying,
  isShuffled,
  repeatMode,
  isFavorited,
  onTogglePlayPause,
  onPrevious,
  onNext,
  onToggleShuffle,
  onToggleRepeat,
  onToggleFavorite,
}: PlaybackControlsProps) {
  return (
    <>
      {/* Primary Controls */}
      <Stack direction="horizontal" align="center" justify="center" gap="lg">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrevious}
          aria-label={I18n.player.controls.previous}
          className="h-14 w-14 rounded-full border-2"
        >
          <SkipBack className="h-6 w-6" aria-hidden="true" />
        </Button>

        <Button
          variant="default"
          size="icon"
          onClick={onTogglePlayPause}
          aria-label={isPlaying ? I18n.player.controls.pause : I18n.player.controls.play}
          className="h-20 w-20 rounded-full shadow-lg"
        >
          {isPlaying ? (
            <Pause className="h-10 w-10" aria-hidden="true" />
          ) : (
            <Play className="h-10 w-10 translate-x-0.5" aria-hidden="true" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onNext}
          aria-label={I18n.player.controls.next}
          className="h-14 w-14 rounded-full border-2"
        >
          <SkipForward className="h-6 w-6" aria-hidden="true" />
        </Button>
      </Stack>

      {/* Secondary Controls */}
      <Stack direction="horizontal" align="center" justify="around" className="px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleShuffle}
          aria-pressed={isShuffled}
          aria-label={I18n.player.shuffle.label}
          className={isShuffled ? "bg-primary/10 text-primary hover:bg-primary/20" : "hover:bg-accent"}
        >
          <Shuffle className="h-5 w-5 mr-1.5" aria-hidden="true" />
          <Text as="span" variant="caption">
            {I18n.player.shuffle.label}
          </Text>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleFavorite}
          aria-pressed={isFavorited}
          aria-label={isFavorited ? I18n.player.favorite.removeLabel : I18n.player.favorite.addLabel}
          className={isFavorited ? "bg-primary/10 text-primary hover:bg-primary/20" : "hover:bg-accent"}
        >
          <Heart
            className={`h-5 w-5 mr-1.5 ${isFavorited ? "fill-current" : ""}`}
            aria-hidden="true"
          />
          <Text as="span" variant="caption">
            {I18n.player.favorite.label}
          </Text>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleRepeat}
          aria-pressed={repeatMode !== RepeatMode.Off}
          aria-label={I18n.player.repeat.label}
          className={repeatMode !== RepeatMode.Off ? "bg-primary/10 text-primary hover:bg-primary/20" : "hover:bg-accent"}
        >
          <div className="relative">
            <Repeat className="h-5 w-5 mr-1.5" aria-hidden="true" />
            {repeatMode === RepeatMode.One && (
              <Text as="span" variant="caption" className="absolute -top-1 -right-1 text-[10px] font-bold">
                1
              </Text>
            )}
          </div>
          <Text as="span" variant="caption">
            {repeatMode === RepeatMode.Off
              ? I18n.player.repeat.off
              : repeatMode === RepeatMode.All
                ? I18n.player.repeat.all
                : I18n.player.repeat.one}
          </Text>
        </Button>
      </Stack>
    </>
  );
}
