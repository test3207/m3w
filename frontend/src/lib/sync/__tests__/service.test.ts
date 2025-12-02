/**
 * SyncService Tests
 * Tests for the unified background sync service
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncService } from '../service';

// Mock dependencies
vi.mock('../../db/schema', () => ({
  db: {
    libraries: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
    playlists: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
          delete: vi.fn(() => Promise.resolve()),
        })),
      })),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
    songs: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
          modify: vi.fn(() => Promise.resolve()),
        })),
      })),
      put: vi.fn(),
      delete: vi.fn(),
    },
    playlistSongs: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
          modify: vi.fn(() => Promise.resolve()),
          delete: vi.fn(() => Promise.resolve()),
        })),
      })),
      put: vi.fn(),
      delete: vi.fn(),
    },
  },
  getDirtyCount: vi.fn(() => Promise.resolve(0)),
  markSynced: vi.fn((entity) => ({ ...entity, _isDirty: false })),
  updateEntityId: vi.fn(() => Promise.resolve()),
}));

vi.mock('../metadata-sync', () => ({
  syncMetadata: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('@/services', () => ({
  api: {
    main: {
      libraries: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      playlists: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  },
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/locales/i18n', () => ({
  I18n: {
    sync: {
      conflictsResolved: 'Sync completed with conflicts',
      serverWins: 'conflicts resolved',
    },
  },
}));

vi.mock('../../logger-client', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock.store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageMock.store[key]; }),
  clear: vi.fn(() => { localStorageMock.store = {}; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('SyncService', () => {
  let syncService: SyncService;

  beforeEach(() => {
    syncService = new SyncService();
    localStorageMock.clear();
    vi.clearAllMocks();
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    syncService.stop();
  });

  describe('start/stop', () => {
    it('should start the sync service without throwing', () => {
      expect(() => syncService.start()).not.toThrow();
    });

    it('should not start twice', async () => {
      const { logger } = await import('../../logger-client');
      
      syncService.start();
      syncService.start();
      
      expect(logger.info).toHaveBeenCalledWith('Sync service already running');
    });

    it('should stop the sync service', () => {
      syncService.start();
      syncService.stop();
      // No error thrown means success
    });
  });

  describe('sync conditions', () => {
    it('should NOT sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      
      const result = await syncService.sync();
      
      expect(result.pushed.libraries).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should NOT sync for guest user', async () => {
      localStorageMock.setItem('auth-storage', JSON.stringify({
        state: { isGuest: true },
      }));
      
      const result = await syncService.sync();
      expect(result.pushed.libraries).toBe(0);
    });

    it('should skip if already syncing', async () => {
      // Start a sync
      const syncPromise = syncService.sync();
      
      // Try to start another sync immediately
      const result = await syncService.sync();
      
      expect(result.pushed.libraries).toBe(0);
      
      await syncPromise;
    });
  });

  describe('sync triggers', () => {
    it('should register online event listener on start', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      
      syncService.start();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    });

    it('should register visibilitychange listener on start', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      
      syncService.start();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('should remove listeners on stop', () => {
      const removeWindowListenerSpy = vi.spyOn(window, 'removeEventListener');
      const removeDocListenerSpy = vi.spyOn(document, 'removeEventListener');
      
      syncService.start();
      syncService.stop();
      
      expect(removeWindowListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeDocListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('getQueueSize', () => {
    it('should return dirty count', async () => {
      const { getDirtyCount } = await import('../../db/schema');
      vi.mocked(getDirtyCount).mockResolvedValue(5);
      
      const size = await syncService.getQueueSize();
      
      expect(size).toBe(5);
    });
  });

  describe('isSyncInProgress', () => {
    it('should return false when not syncing', () => {
      expect(syncService.isSyncInProgress).toBe(false);
    });
  });
});
