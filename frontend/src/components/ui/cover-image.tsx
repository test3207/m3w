/**
 * Cover Image Component with offline fallback support
 * 
 * Key design:
 * - Uses crossOrigin="anonymous" to enable CORS requests
 * - This allows Service Worker to intercept and cache the response
 * - On error, shows fallback icon (cover not cached or doesn't exist)
 */

import { useState } from "react";
import { Music, ListMusic, Library } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cover type determines the fallback icon */
export const CoverType = {
  Song: "song",
  Playlist: "playlist",
  Library: "library",
} as const;

export type CoverTypeValue = typeof CoverType[keyof typeof CoverType];

/** Size variants for the cover image */
export const CoverSize = {
  SM: "sm",
  MD: "md",
  LG: "lg",
  XL: "xl",
} as const;

export type CoverSizeValue = typeof CoverSize[keyof typeof CoverSize];

interface CoverImageProps {
  /** Cover image URL (e.g., /api/songs/:id/cover) */
  src: string | null | undefined;
  /** Alt text for accessibility */
  alt: string;
  /** Type of content - determines fallback icon */
  type?: CoverTypeValue;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: CoverSizeValue;
}

const sizeClasses: Record<CoverSizeValue, string> = {
  [CoverSize.SM]: "h-10 w-10",
  [CoverSize.MD]: "h-12 w-12", 
  [CoverSize.LG]: "h-24 w-24",
  [CoverSize.XL]: "h-48 w-48",
};

const iconSizes: Record<CoverSizeValue, string> = {
  [CoverSize.SM]: "h-4 w-4",
  [CoverSize.MD]: "h-6 w-6",
  [CoverSize.LG]: "h-10 w-10",
  [CoverSize.XL]: "h-16 w-16",
};

function FallbackIcon({ type, size }: { type: CoverTypeValue; size: CoverSizeValue }) {
  const iconClass = cn(iconSizes[size], "text-muted-foreground/30");
  
  switch (type) {
    case CoverType.Playlist:
      return <ListMusic className={iconClass} aria-hidden="true" />;
    case CoverType.Library:
      return <Library className={iconClass} aria-hidden="true" />;
    case CoverType.Song:
    default:
      return <Music className={iconClass} aria-hidden="true" />;
  }
}

export function CoverImage({
  src,
  alt,
  type = CoverType.Song,
  className,
  size = CoverSize.MD,
}: CoverImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const showFallback = !src || hasError;

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        sizeClasses[size],
        className
      )}
    >
      {!showFallback ? (
        <>
          <img
            key={src}
            src={src}
            alt={alt}
            crossOrigin="anonymous"
            loading="lazy"
            decoding="async"
            className={cn(
              "h-full w-full object-cover transition-opacity duration-200",
              isLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
          {/* Show fallback icon while loading */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <FallbackIcon type={type} size={size} />
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
          <FallbackIcon type={type} size={size} />
        </div>
      )}
    </div>
  );
}
