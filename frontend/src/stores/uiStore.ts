import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SongSortOption } from "@m3w/shared";

// Song info for add-to-playlist sheet
export interface SelectedSongInfo {
  id: string;
  title: string;
}

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
  
  // Upload target library
  uploadTargetLibraryId: string | null;
  
  // Selection mode for batch operations
  isSelectionMode: boolean;
  selectedSongs: SelectedSongInfo[];
  
  // Single song for quick "Add to Playlist" action (when NOT in selection mode)
  selectedSongForPlaylist: SelectedSongInfo | null;

  // Sorting
  currentSortOption: SongSortOption;

  // Theme
  theme: "light" | "dark" | "system";

  // Language
  language: "en" | "zh-CN";
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
  openUploadDrawer: (libraryId?: string) => void;
  closeUploadDrawer: () => void;
  openPlayQueueDrawer: () => void;
  closePlayQueueDrawer: () => void;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
  
  // Selection mode
  enterSelectionMode: (initialSong?: SelectedSongInfo) => void;
  exitSelectionMode: () => void;
  toggleSongSelection: (song: SelectedSongInfo) => void;
  selectAllSongs: (songs: SelectedSongInfo[]) => void;
  deselectAllSongs: () => void;
  isSongSelected: (songId: string) => boolean;
  
  // Add to playlist sheet
  openAddToPlaylistSheet: (song?: SelectedSongInfo) => void;
  closeAddToPlaylistSheet: () => void;

  // Sorting
  setSortOption: (option: SongSortOption) => void;

  // Theme
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Language
  setLanguage: (language: "en" | "zh-CN") => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
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
      uploadTargetLibraryId: null,
      isSelectionMode: false,
      selectedSongs: [],
      selectedSongForPlaylist: null,
      currentSortOption: "date-desc",
      theme: "system",
      language: "en",

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
      openUploadDrawer: (libraryId?: string) => set({ 
        isUploadDrawerOpen: true,
        uploadTargetLibraryId: libraryId || null,
      }),
      closeUploadDrawer: () => set({ 
        isUploadDrawerOpen: false,
        uploadTargetLibraryId: null,
      }),

      openPlayQueueDrawer: () => set({ isPlayQueueDrawerOpen: true }),
      closePlayQueueDrawer: () => set({ isPlayQueueDrawerOpen: false }),

      openFullPlayer: () => set({ isFullPlayerOpen: true }),
      closeFullPlayer: () => set({ isFullPlayerOpen: false }),

      // Selection mode actions
      enterSelectionMode: (initialSong?: SelectedSongInfo) => set({
        isSelectionMode: true,
        selectedSongs: initialSong ? [initialSong] : [],
      }),
      
      exitSelectionMode: () => set({
        isSelectionMode: false,
        selectedSongs: [],
      }),
      
      toggleSongSelection: (song: SelectedSongInfo) => set((state) => {
        const isSelected = state.selectedSongs.some(s => s.id === song.id);
        if (isSelected) {
          return { selectedSongs: state.selectedSongs.filter(s => s.id !== song.id) };
        } else {
          return { selectedSongs: [...state.selectedSongs, song] };
        }
      }),
      
      selectAllSongs: (songs: SelectedSongInfo[]) => set({ selectedSongs: songs }),
      
      deselectAllSongs: () => set({ selectedSongs: [] }),
      
      isSongSelected: (songId: string) => {
        return get().selectedSongs.some(s => s.id === songId);
      },

      // Add to playlist actions
      openAddToPlaylistSheet: (song?: SelectedSongInfo) => set({ 
        isAddToPlaylistSheetOpen: true, 
        selectedSongForPlaylist: song || null,
      }),
      closeAddToPlaylistSheet: () => set({ 
        isAddToPlaylistSheetOpen: false, 
        selectedSongForPlaylist: null,
      }),

      // Sorting actions
      setSortOption: (option) => set({ currentSortOption: option }),

      // Theme actions
      setTheme: (theme) => {
        set({ theme });
        // Apply theme to document
        if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      },

      // Language actions
      setLanguage: (language) => set({ language }),
    }),
    {
      name: "ui-storage",
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        theme: state.theme,
        language: state.language,
      }),
    }
  )
);
