# Frontend Architecture Plan

## Metadata

**Created**: 2025-11-12  
**Status**: Planning Phase  
**Purpose**: Define the new frontend architecture for mobile-first refactor

---

## Current State Analysis

### Existing Structure
```
frontend/src/
├── pages/
│   ├── HomePage.tsx
│   ├── SignInPage.tsx
│   ├── AuthCallbackPage.tsx
│   ├── DashboardPage.tsx
│   ├── LibrariesPage.tsx
│   ├── LibraryDetailPage.tsx
│   ├── PlaylistsPage.tsx
│   ├── PlaylistDetailPage.tsx
│   └── UploadPage.tsx
├── stores/
│   ├── authStore.ts (Zustand - good)
│   ├── playerStore.ts (Zustand - needs update)
│   └── uiStore.ts
├── services/api/
│   └── main/ (已有结构良好的 API 服务层)
└── components/
    ├── ui/ (shadcn/ui 组件)
    ├── features/ (功能组件)
    └── layouts/ (布局组件)
```

### Issues to Fix
1. **路由结构**: 当前所有认证页面在 `/dashboard/*` 下,不符合移动端底部导航习惯
2. **状态管理**: playerStore 需要增加队列来源 (Library/Playlist/All) 和临时队列支持
3. **缺少 Stores**: 没有 libraryStore 和 playlistStore,数据通过 hooks 获取,不利于跨组件共享
4. **上传流程**: UploadPage 是独立页面,应该改为 Drawer/Sheet 组件
5. **移动端 UI**: 缺少底部导航栏、Mini Player、抽屉等移动端组件

---

## New Architecture Design

### 1. Route Structure (移动端优先)

```typescript
// Public routes
/ - HomePage (欢迎页)
/signin - SignInPage (GitHub OAuth)
/auth/callback - AuthCallbackPage (OAuth 回调)

// Authenticated routes (使用底部 Tab 导航)
/now-playing - NowPlayingPage (正在播放 - 默认页)
/libraries - LibrariesPage (音乐库列表)
/libraries/:id - LibraryDetailPage (音乐库详情)
/playlists - PlaylistsPage (播放列表)
/playlists/:id - PlaylistDetailPage (播放列表详情)
/settings - SettingsPage (设置页 - 可选)

// Removed: /dashboard 路由不再需要
// Removed: /dashboard/upload 改为全局 Upload Drawer
```

### 2. Bottom Navigation (移动端核心)

```typescript
// 底部导航栏 (固定 4 个 Tab)
[
  { icon: PlayCircle, label: '正在播放', path: '/now-playing' },
  { icon: Library, label: '音乐库', path: '/libraries' },
  { icon: ListMusic, label: '播放列表', path: '/playlists' },
  { icon: Settings, label: '设置', path: '/settings' },
]

// Mini Player (在所有认证页面底部显示,位于 Tab 上方)
- 仅在 currentSong 存在时显示
- 显示当前歌曲信息、播放/暂停按钮
- 点击展开为 Full Player
```

### 3. State Management (统一 Zustand)

#### authStore.ts (已有,保持不变)
```typescript
interface AuthStore {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  setAuth, clearAuth, refreshAccessToken, etc.
}
```

#### libraryStore.ts (新增)
```typescript
interface LibraryStore {
  libraries: Library[];
  currentLibrary: Library | null;
  isLoading: boolean;
  
  // Actions
  fetchLibraries: () => Promise<void>;
  createLibrary: (name: string) => Promise<Library>;
  deleteLibrary: (id: string) => Promise<void>;
  setCurrentLibrary: (library: Library | null) => void;
  
  // Computed
  defaultLibrary: Library | null; // isDefault === true
  canDeleteLibrary: (id: string) => boolean;
}
```

#### playlistStore.ts (新增)
```typescript
interface PlaylistStore {
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  isLoading: boolean;
  
  // Actions
  fetchPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  reorderPlaylistSongs: (playlistId: string, songIds: string[]) => Promise<void>;
  setCurrentPlaylist: (playlist: Playlist | null) => void;
  
  // Computed
  favoritesPlaylist: Playlist | null; // isDefault === true
  canDeletePlaylist: (id: string) => boolean;
}
```

#### playerStore.ts (重构)
```typescript
interface PlayerStore {
  // Current playback
  currentSong: Song | null;
  queue: Song[];
  currentIndex: number;
  
  // Queue source tracking (NEW)
  queueSource: 'library' | 'playlist' | 'all' | null;
  queueSourceId: string | null; // Library ID or Playlist ID
  queueSourceName: string | null; // 显示名称
  
  // Playback state
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  repeatMode: 'off' | 'one' | 'all';
  isShuffled: boolean;
  
  // Progress
  currentTime: number;
  duration: number;
  
  // Actions
  play, pause, togglePlayPause, stop;
  setQueue, addToQueue, removeFromQueue, clearQueue;
  setQueueSource; // NEW: 设置队列来源
  next, previous, seekTo;
  setVolume, toggleMute, setRepeatMode, toggleShuffle;
  setCurrentTime, setDuration;
  
  // NEW: 从不同来源播放
  playFromLibrary: (libraryId: string, songs: Song[], startIndex?: number) => void;
  playFromPlaylist: (playlistId: string, songs: Song[], startIndex?: number) => void;
  saveQueueAsPlaylist: (name: string) => Promise<void>; // 保存当前队列为播放列表
}
```

#### uiStore.ts (扩展)
```typescript
interface UiStore {
  // Existing
  isSidebarOpen: boolean;
  
  // NEW: Mobile UI state
  isUploadDrawerOpen: boolean;
  isPlayQueueDrawerOpen: boolean;
  isFullPlayerOpen: boolean;
  currentSortOption: SongSortOption; // 当前页面的排序选项
  
  // Actions
  toggleSidebar, closeSidebar;
  openUploadDrawer, closeUploadDrawer;
  openPlayQueueDrawer, closePlayQueueDrawer;
  openFullPlayer, closeFullPlayer;
  setSortOption;
}
```

### 4. Component Structure

#### Core Layout Components

```
components/layouts/
├── RootLayout.tsx
│   └─ Provider wrappers, AuthRefresh, NetworkStatus
├── MobileLayout.tsx (NEW)
│   ├─ BottomNavigation
│   ├─ MiniPlayer (floating above tabs)
│   └─ Children (page content)
├── DesktopLayout.tsx (桌面端布局,可选)
│   ├─ Sidebar
│   ├─ TopBar
│   └─ MainContent
└── DashboardLayout.tsx (已有,可能重构)
```

#### Mobile-First UI Components

```
components/features/
├── player/
│   ├── MiniPlayer.tsx (底部迷你播放器)
│   ├── FullPlayer.tsx (全屏播放器)
│   ├── PlayQueueDrawer.tsx (播放队列抽屉)
│   └── PlaybackControls.tsx (播放控制按钮组)
├── upload/
│   ├── UploadDrawer.tsx (上传抽屉 - 替代 UploadPage)
│   ├── UploadFileList.tsx (文件列表)
│   └── MetadataEditor.tsx (元数据编辑器)
├── library/
│   ├── LibraryCard.tsx (音乐库卡片)
│   ├── LibraryGrid.tsx (卡片网格)
│   ├── SongList.tsx (歌曲列表)
│   ├── SortSelector.tsx (排序选择器)
│   └── EmptyLibraryState.tsx (空状态提示)
├── playlist/
│   ├── PlaylistCard.tsx (播放列表卡片)
│   ├── PlaylistGrid.tsx
│   ├── PlaylistSongList.tsx (支持拖拽排序)
│   └── AddSongToPlaylistSheet.tsx (添加歌曲 Sheet)
└── navigation/
    ├── BottomNavigation.tsx (底部导航栏)
    └── FloatingActionButton.tsx (悬浮上传按钮)
```

### 5. Page Implementation Priority

#### Phase 1: Core Infrastructure (Week 1)
1. ✅ Update API clients to support new backend fields
2. ✅ Create libraryStore and playlistStore
3. ✅ Refactor playerStore with queue source tracking
4. ✅ Implement MobileLayout with BottomNavigation
5. ✅ Update routing structure

#### Phase 2: Core Player (Week 2)
1. ✅ Implement MiniPlayer component
2. ✅ Implement FullPlayer component
3. ✅ Implement PlayQueueDrawer
4. ✅ Update NowPlayingPage

#### Phase 3: Libraries (Week 3)
1. ✅ Refactor LibrariesPage with card grid
2. ✅ Refactor LibraryDetailPage with sort/filter
3. ✅ Implement SongList with actions
4. ✅ Test "Play All" and "Play from Song" flows

#### Phase 4: Playlists (Week 4)
1. ✅ Refactor PlaylistsPage
2. ✅ Refactor PlaylistDetailPage with drag-and-drop
3. ✅ Implement AddSongToPlaylistSheet
4. ✅ Test cross-Library song addition

#### Phase 5: Upload & Polish (Week 5)
1. ✅ Implement UploadDrawer
2. ✅ Add global FAB for upload
3. ✅ Polish mobile UI (responsive, gestures)
4. ✅ Integration testing

---

## API Client Updates

### Required Updates to `frontend/src/services/api/main/resources/`

#### libraries.ts
```typescript
// Add new fields to responses
interface Library {
  id: string;
  name: string;
  userId: string;
  songCount: number;
  coverUrl?: string; // NEW
  isDefault: boolean; // NEW
  canDelete: boolean; // NEW
  createdAt: string;
  updatedAt: string;
}

// Add sort parameter to getSongs
getSongs(libraryId: string, sort?: SongSortOption): Promise<Song[]>
```

#### playlists.ts
```typescript
// Add new fields
interface Playlist {
  id: string;
  name: string;
  userId: string;
  songIds: string[]; // NEW - replaces PlaylistSong join
  songCount: number;
  coverUrl?: string; // NEW
  isDefault: boolean; // NEW
  canDelete: boolean; // NEW
  createdAt: string;
  updatedAt: string;
}

// New endpoint
reorderSongs(playlistId: string, songIds: string[]): Promise<void>
```

#### songs.ts (NEW)
```typescript
// New search endpoint
interface SearchParams {
  q: string;
  libraryId?: string;
  sort?: SongSortOption;
}

search(params: SearchParams): Promise<Song[]>
```

---

## Mobile-First UI Patterns

### 1. Bottom Navigation Pattern
```typescript
// Always visible at bottom (except HomePage, SignInPage)
// Height: 64px + safe-area-inset-bottom
// Icons + Labels
// Active state with color accent
```

### 2. Mini Player Pattern
```typescript
// Floating above bottom nav
// Height: 72px
// Displays: Album cover, Song title, Artist, Play/Pause, Next
// Click to expand to Full Player
// Swipe down to collapse Full Player
```

### 3. Full Player Pattern
```typescript
// Full screen overlay (z-index high)
// Blurred album cover background
// Large album artwork
// Song info (title, artist, album)
// Progress bar + time
// Playback controls (shuffle, prev, play/pause, next, repeat)
// Action buttons (add to favorites, add to playlist)
// Swipe up to view queue
// Swipe down to collapse to Mini Player
```

### 4. Drawer/Sheet Pattern
```typescript
// Slide up from bottom
// Drag handle at top
// Swipe down to close
// Used for:
// - Upload Drawer
// - Play Queue Drawer
// - Add to Playlist Sheet
// - Sort/Filter Sheet
```

### 5. Card Grid Pattern
```typescript
// Library and Playlist cards
// Grid layout: 2 columns on mobile, 3-4 on tablet/desktop
// Each card:
// - Cover image (square)
// - Title
// - Song count
// - Default badge (if isDefault === true)
// - Long press for actions menu
```

### 6. Song List Pattern
```typescript
// Vertical list with items
// Each item:
// - Small album cover (48x48)
// - Song title + Artist
// - Duration
// - Menu button (⋮)
// Long press for quick actions
// Swipe actions (optional)
```

---

## Development Workflow

### Step-by-Step Plan

1. **Update Shared Types** ✅ (Already done in backend phase)
2. **Update API Clients** (Task 12)
   - Update types in `frontend/src/services/api/main/resources/`
   - Add new endpoints (search, reorder)
3. **Create New Stores** (Task 13)
   - `libraryStore.ts`
   - `playlistStore.ts`
   - Refactor `playerStore.ts`
   - Extend `uiStore.ts`
4. **Update Routing** (Task 14)
   - Remove `/dashboard` prefix
   - Add `/now-playing` as default authenticated route
   - Update ProtectedRoute wrapper
5. **Build Mobile Layout** (Task 14)
   - `MobileLayout.tsx`
   - `BottomNavigation.tsx`
   - `FloatingActionButton.tsx`
6. **Implement Player Components** (Task 15)
   - `MiniPlayer.tsx`
   - `FullPlayer.tsx`
   - `PlayQueueDrawer.tsx`
   - `NowPlayingPage.tsx`
7. **Refactor Library Pages** (Task 16)
   - `LibrariesPage.tsx`
   - `LibraryDetailPage.tsx`
   - `LibraryCard.tsx`
   - `SongList.tsx`
8. **Refactor Playlist Pages** (Task 17)
   - `PlaylistsPage.tsx`
   - `PlaylistDetailPage.tsx`
   - `PlaylistCard.tsx`
   - `PlaylistSongList.tsx` (with drag-and-drop)
9. **Implement Upload Drawer** (Task 18)
   - `UploadDrawer.tsx`
   - `UploadFileList.tsx`
   - `MetadataEditor.tsx`
10. **Integration Testing** (Task 19)
    - Test all user flows
    - Test on mobile devices
    - Test offline functionality

---

## Testing Checklist

### User Flow Testing
- [ ] First-time user onboarding (auto-create defaults)
- [ ] Create new Library
- [ ] Upload songs to Library
- [ ] Play from Library (auto-generate queue)
- [ ] Create Playlist
- [ ] Add songs from different Libraries to Playlist
- [ ] Reorder songs in Playlist (drag-and-drop)
- [ ] Play from Playlist
- [ ] View Play Queue
- [ ] Save Queue as Playlist
- [ ] Sort songs (Pinyin for Chinese)
- [ ] Search songs across Libraries
- [ ] Mini Player controls
- [ ] Full Player controls
- [ ] Delete protection (default Library/Playlist)

### Responsive Testing
- [ ] Mobile (375px - iPhone SE)
- [ ] Mobile (390px - iPhone 14)
- [ ] Tablet (768px - iPad)
- [ ] Desktop (1024px+)

### Offline Testing
- [ ] Play cached songs
- [ ] Queue management offline
- [ ] Metadata sync when back online

---

## References

- User Stories: `.github/instructions/frontend-refactor-user-stories.instructions.md`
- API Specification: `.github/instructions/frontend-refactor-api-changes.instructions.md`
- Current Frontend API: `frontend/src/services/api/README.md`

---

**Document Version**: v1.0  
**Last Updated**: 2025-11-12
