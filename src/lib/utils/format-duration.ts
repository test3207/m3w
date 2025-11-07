export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || Number.isNaN(seconds)) {
    return "--";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}
