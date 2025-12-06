/**
 * Cache Status Icon Component
 * 
 * Displays whether a song is cached for offline playback:
 * - ✓ (check icon): Cached, available offline
 * - ○ (circle icon): Not cached, requires network
 */

import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CacheStatusIconProps {
  isCached: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function CacheStatusIcon({ isCached, className, size = "sm" }: CacheStatusIconProps) {
  const sizeClass = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  
  if (isCached) {
    return (
      <Check 
        className={cn(sizeClass, "text-green-500", className)} 
        aria-label="Cached for offline playback"
      />
    );
  }
  
  return (
    <Circle 
      className={cn(sizeClass, "text-muted-foreground/50", className)} 
      aria-label="Not cached"
    />
  );
}
