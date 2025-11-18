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
  const loadPlaybackProgress = usePlayerStore((state) => state.loadPlaybackProgress);
  const savePlaybackProgress = usePlayerStore((state) => state.savePlaybackProgress);
  const hasSong = currentSong !== null;

  // Load playback progress on mount (once)
  useEffect(() => {
    loadPlaybackProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save progress before page unload (using fetch with keepalive for reliability)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Get latest state directly from store
      const state = usePlayerStore.getState();
      if (state.currentSong) {
        state.savePlaybackProgressSync(); // Use keepalive for guaranteed delivery
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // Empty deps - listener always uses latest store state

  // Save progress when song changes (immediate) or periodically while playing
  useEffect(() => {
    if (!currentSong || !isPlaying) {
      return;
    }

    // Immediate save on song change
    savePlaybackProgress();

    // Set up interval for periodic saves while playing
    const interval = setInterval(() => {
      // Always save, don't check currentTime here (it's captured in closure)
      savePlaybackProgress();
    }, 5000); // Save every 5 seconds while playing

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id, isPlaying]);

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
