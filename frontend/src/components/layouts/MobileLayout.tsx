/**
 * Mobile Layout Component
 * Main layout for mobile-first design with bottom navigation and mini player
 */

import { useEffect } from 'react';
import { usePlayerStore } from '@/stores/playerStore';
import { BottomNavigation } from '@/components/features/navigation/BottomNavigation';
import { MiniPlayer, FullPlayer, PlayQueueDrawer } from '@/components/features/player';
import { FloatingActionButton } from '@/components/features/navigation/FloatingActionButton';
import { UploadDrawer } from '@/components/features/upload/UploadDrawer';

interface MobileLayoutProps {
  children: React.ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const loadPlaybackProgress = usePlayerStore((state) => state.loadPlaybackProgress);
  const savePlaybackProgress = usePlayerStore((state) => state.savePlaybackProgress);
  const hasSong = currentSong !== null;

  // Load playback progress on mount (once)
  useEffect(() => {
    loadPlaybackProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save progress when playing or when time changes significantly
  useEffect(() => {
    if (currentSong && isPlaying && currentTime > 0) {
      savePlaybackProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id, currentTime, isPlaying]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Main content area */}
      <main className="flex-1 overflow-auto pb-16 md:pb-20">
        {/* Add extra padding if mini player is showing */}
        <div className={hasSong ? 'pb-20' : ''}>
          {children}
        </div>
      </main>

      {/* Mini Player (floating above bottom nav) */}
      {hasSong && <MiniPlayer />}

      {/* Bottom Navigation */}
      <BottomNavigation />

      {/* Floating Action Button (Upload) */}
      <FloatingActionButton />

      {/* Full Player Overlay */}
      <FullPlayer />

      {/* Play Queue Drawer */}
      <PlayQueueDrawer />

      {/* Upload Drawer */}
      <UploadDrawer />
    </div>
  );
}
