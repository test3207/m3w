/**
 * FullPlayer Progress Bar Component
 * 
 * Accessible seek bar with keyboard navigation support.
 */

import { Text } from "@/components/ui/text";
import { Stack } from "@/components/ui/stack";
import { I18n } from "@/locales/i18n";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

/** Format duration in seconds to human-readable string (e.g., "3:45" or "1:23:45") */
function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) {
    return "0:00";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function ProgressBar({ currentTime, duration, onSeek }: ProgressBarProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    onSeek(newTime);
  };

  const handleProgressKeyDown = (e: React.KeyboardEvent) => {
    if (duration <= 0) return;

    let newTime: number;
    const step = duration * 0.05; // 5% step
    const largeStep = duration * 0.1; // 10% step for PageUp/PageDown

    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        newTime = Math.max(0, currentTime - step);
        break;
      case "ArrowRight":
      case "ArrowUp":
        newTime = Math.min(duration, currentTime + step);
        break;
      case "PageDown":
        newTime = Math.max(0, currentTime - largeStep);
        break;
      case "PageUp":
        newTime = Math.min(duration, currentTime + largeStep);
        break;
      case "Home":
        newTime = 0;
        break;
      case "End":
        newTime = duration;
        break;
      default:
        return;
    }

    e.preventDefault();
    onSeek(newTime);
  };

  return (
    <div>
      <div
        role="slider"
        aria-orientation="horizontal"
        aria-label={I18n.player.progress.ariaLabel}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatDuration(currentTime)} / ${formatDuration(duration)}`}
        tabIndex={0}
        className="h-1.5 w-full cursor-pointer rounded-full bg-secondary hover:h-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        onClick={handleProgressClick}
        onKeyDown={handleProgressKeyDown}
      >
        <div
          className="h-full rounded-full bg-primary transition-all pointer-events-none"
          style={{ width: `${progress}%` }}
        />
      </div>
      <Stack direction="horizontal" justify="between" className="mt-2">
        <Text as="span" variant="caption" color="muted">
          {formatDuration(currentTime)}
        </Text>
        <Text as="span" variant="caption" color="muted">
          {formatDuration(duration)}
        </Text>
      </Stack>
    </div>
  );
}
