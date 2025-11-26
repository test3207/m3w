import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SongSortOption } from '@m3w/shared';

interface UIState {
  // Sidebar (desktop)
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;

  // Modals
  isUploadModalOpen: boolean;
  isCreateLibraryModalOpen: boolean;
  isCreatePlaylistModalOpen: boolean;

  // Mobile UI
  isUploadDrawerOpen: boolean;
  isPlayQueueDrawerOpen: boolean;
  isFullPlayerOpen: boolean;
  isAddToPlaylistSheetOpen: boolean;

  // Sorting
  currentSortOption: SongSortOption;

  // Theme
  theme: 'light' | 'dark' | 'system';

  // Language
  language: 'en' | 'zh-CN';
}

interface UIActions {
  // Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebarCollapse: () => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;

  // Modals
  openUploadModal: () => void;
  closeUploadModal: () => void;
  openCreateLibraryModal: () => void;
  closeCreateLibraryModal: () => void;
  openCreatePlaylistModal: () => void;
  closeCreatePlaylistModal: () => void;

  // Mobile UI
  openUploadDrawer: () => void;
  closeUploadDrawer: () => void;
  openPlayQueueDrawer: () => void;
  closePlayQueueDrawer: () => void;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
  openAddToPlaylistSheet: () => void;
  closeAddToPlaylistSheet: () => void;

  // Sorting
  setSortOption: (option: SongSortOption) => void;

  // Theme
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Language
  setLanguage: (language: 'en' | 'zh-CN') => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Initial state
      isSidebarOpen: true,
      isSidebarCollapsed: false,
      isUploadModalOpen: false,
      isCreateLibraryModalOpen: false,
      isCreatePlaylistModalOpen: false,
      isUploadDrawerOpen: false,
      isPlayQueueDrawerOpen: false,
      isFullPlayerOpen: false,
      isAddToPlaylistSheetOpen: false,
      currentSortOption: 'date-desc',
      theme: 'system',
      language: 'en',

      // Sidebar actions
      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

      toggleSidebarCollapse: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      setSidebarCollapsed: (isCollapsed) => set({ isSidebarCollapsed: isCollapsed }),

      // Modal actions
      openUploadModal: () => set({ isUploadModalOpen: true }),
      closeUploadModal: () => set({ isUploadModalOpen: false }),

      openCreateLibraryModal: () => set({ isCreateLibraryModalOpen: true }),
      closeCreateLibraryModal: () => set({ isCreateLibraryModalOpen: false }),

      openCreatePlaylistModal: () => set({ isCreatePlaylistModalOpen: true }),
      closeCreatePlaylistModal: () => set({ isCreatePlaylistModalOpen: false }),

      // Mobile UI actions
      openUploadDrawer: () => set({ isUploadDrawerOpen: true }),
      closeUploadDrawer: () => set({ isUploadDrawerOpen: false }),

      openPlayQueueDrawer: () => set({ isPlayQueueDrawerOpen: true }),
      closePlayQueueDrawer: () => set({ isPlayQueueDrawerOpen: false }),

      openFullPlayer: () => set({ isFullPlayerOpen: true }),
      closeFullPlayer: () => set({ isFullPlayerOpen: false }),

      openAddToPlaylistSheet: () => set({ isAddToPlaylistSheetOpen: true }),
      closeAddToPlaylistSheet: () => set({ isAddToPlaylistSheetOpen: false }),

      // Sorting actions
      setSortOption: (option) => set({ currentSortOption: option }),

      // Theme actions
      setTheme: (theme) => {
        set({ theme });
        // Apply theme to document
        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },

      // Language actions
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        theme: state.theme,
        language: state.language,
      }),
    }
  )
);
