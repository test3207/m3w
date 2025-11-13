/**
 * Mobile Layout Component
 * Main layout for mobile-first design with header, bottom navigation and mini player
 */

import { useEffect } from 'react';
import { usePlayerStore } from '@/stores/playerStore';
import { MobileHeader } from '@/components/layouts/mobile-header';
import { BottomNavigation } from '@/components/features/navigation/bottom-navigation';
import { MiniPlayer, FullPlayer, PlayQueueDrawer } from '@/components/features/player';
import { FloatingActionButton } from '@/components/features/navigation/floating-action-button';
import { UploadDrawer } from '@/components/features/upload/upload-drawer';

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
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top Header with status indicators (56px) */}
      <MobileHeader />

      {/* Main content area - fixed height excluding header and bottom elements */}
      <main 
        className="overflow-hidden"
        style={{
          height: hasSong 
            ? 'calc(100vh - 56px - 64px - 72px)' // viewport - header - bottom nav - mini player
            : 'calc(100vh - 56px - 64px)' // viewport - header - bottom nav
        }}
      >
        {children}
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
