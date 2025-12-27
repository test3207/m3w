/**
 * Library Store
 * Manages music libraries state with Zustand
 */

import { create } from "zustand";
import { api } from "@/services";
import { logger } from "@/lib/logger-client";
import { useAuthStore } from "@/stores/authStore";
import { isDefaultLibrary } from "@/lib/shared";
import type { Library } from "@m3w/shared";

/** Get current userId for logging */
const getUserId = () => useAuthStore.getState().user?.id;

interface LibraryState {
  libraries: Library[];
  currentLibrary: Library | null;
  isLoading: boolean;
  error: string | null;
}

interface LibraryActions {
  // Fetch operations
  fetchLibraries: () => Promise<void>;
  fetchLibraryById: (id: string) => Promise<Library | null>;
  setCurrentLibrary: (library: Library | null) => void;

  // CRUD operations
  createLibrary: (name: string) => Promise<Library | null>;
  deleteLibrary: (id: string) => Promise<boolean>;

  // Computed getters
  getDefaultLibrary: () => Library | null;
  canDeleteLibrary: (id: string) => boolean;

  // Reset
  reset: () => void;
}

type LibraryStore = LibraryState & LibraryActions;

const initialState: LibraryState = {
  libraries: [],
  currentLibrary: null,
  isLoading: false,
  error: null,
};

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  ...initialState,

  // Fetch all libraries
  fetchLibraries: async () => {
    logger.debug("[LibraryStore][fetchLibraries]", "fetchLibraries called");
    set({ isLoading: true, error: null });
    try {
      const libraries = await api.main.libraries.list();
      logger.debug("[LibraryStore][fetchLibraries]", "Fetched libraries", { raw: { count: libraries.length } });

      // Update libraries and refresh currentLibrary if it exists
      set((state) => {
        let updatedCurrentLibrary = state.currentLibrary;

        // If there's a currentLibrary, update it with fresh data from the list
        if (state.currentLibrary) {
          const freshLibrary = libraries.find(lib => lib.id === state.currentLibrary?.id);
          if (freshLibrary) {
            updatedCurrentLibrary = freshLibrary;
          }
        }

        logger.debug("[LibraryStore][fetchLibraries]", "Setting new libraries array");
        return {
          libraries,
          currentLibrary: updatedCurrentLibrary,
          isLoading: false,
        };
      });

      logger.info("[LibraryStore][fetchLibraries]", `Fetched ${libraries.length} libraries`, { userId: getUserId() });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch libraries";
      logger.error("[LibraryStore][fetchLibraries]", "Failed to fetch libraries", error, { userId: getUserId() });
      set({ error: errorMessage, isLoading: false });
    }
  },

  // Fetch library by ID and set as current
  fetchLibraryById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const library = await api.main.libraries.getById(id);
      set({ currentLibrary: library, isLoading: false });

      logger.info("[LibraryStore][fetchLibraryById]", `Fetched library: ${library.name}`, { userId: getUserId(), raw: { libraryId: id } });
      return library;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch library";
      logger.error("[LibraryStore][fetchLibraryById]", "Failed to fetch library", error, { userId: getUserId(), raw: { libraryId: id } });
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  // Set current library
  setCurrentLibrary: (library) => {
    set({ currentLibrary: library });
  },

  // Create new library
  createLibrary: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const newLibrary = await api.main.libraries.create({ name });

      // Add to list and set as current
      set((state) => ({
        libraries: [...state.libraries, newLibrary],
        currentLibrary: newLibrary,
        isLoading: false,
      }));

      logger.info("[LibraryStore][createLibrary]", `Created library: ${name}`, { userId: getUserId(), raw: { libraryId: newLibrary.id } });
      return newLibrary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create library";
      logger.error("[LibraryStore][createLibrary]", "Failed to create library", error, { userId: getUserId(), raw: { name } });
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  // Delete library
  deleteLibrary: async (id: string) => {
    const { canDeleteLibrary } = get();

    // Check if library can be deleted
    if (!canDeleteLibrary(id)) {
      logger.warn("[LibraryStore][deleteLibrary]", "Cannot delete default library", { userId: getUserId(), raw: { libraryId: id } });
      set({ error: "Cannot delete default library" });
      return false;
    }

    set({ isLoading: true, error: null });
    try {
      await api.main.libraries.delete(id);

      // Remove from list and clear current if it was deleted
      set((state) => ({
        libraries: state.libraries.filter((lib) => lib.id !== id),
        currentLibrary: state.currentLibrary?.id === id ? null : state.currentLibrary,
        isLoading: false,
      }));

      logger.info("[LibraryStore][deleteLibrary]", "Deleted library", { userId: getUserId(), raw: { libraryId: id } });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete library";
      logger.error("[LibraryStore][deleteLibrary]", "Failed to delete library", error, { userId: getUserId(), raw: { libraryId: id } });
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  // Get default library (optimized with ID check)
  getDefaultLibrary: () => {
    const { libraries } = get();
    return libraries.find((lib) => isDefaultLibrary(lib)) || null;
  },

  // Check if library can be deleted (check isDefault flag)
  canDeleteLibrary: (id: string) => {
    const { libraries } = get();
    const library = libraries.find((lib) => lib.id === id);
    if (!library) return false;
    // Default library cannot be deleted
    if (isDefaultLibrary(library)) return false;
    return library.canDelete ?? false;
  },

  // Reset store
  reset: () => {
    set(initialState);
  },
}));
