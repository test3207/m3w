# User Stories Instruction

## Metadata

**Created**: 2025-11-18  
**Last Updated**: 2025-11-18  
**Status**: Active

---

## Overview

This document defines all user stories and product goals for M3W. It covers both online and offline user experiences, serving as the single source of truth for product requirements and design decisions.

---

## Core Design Principles

### 1. Multi-Library Architecture
- Users can create multiple Libraries (music collections)
- Each Library is an independent music collection
- Future feature: Share Libraries with other users (not in current scope)
- Default Library is auto-created and **cannot be deleted**

### 2. Library vs Playlist Separation
```
Library (音乐库)
  ├─ User's music file collections
  ├─ Multiple Libraries allowed (e.g., "My Music", "Work Music", "Classical")
  ├─ Each Library independently managed
  ├─ Songs can exist in multiple Libraries (by design - for sharing)
  └─ Future: Can be shared with other users

Playlist (播放列表)
  ├─ Cross-Library playback queues
  ├─ User-created and managed
  ├─ Can contain songs from different Libraries
  ├─ Default Playlist "我喜欢的音乐" (Favorites) - cannot be deleted
  └─ Playing from Library auto-generates temporary Playlist

Song (歌曲)
  ├─ Belongs to a Library
  ├─ Information from file Metadata (ID3 tags only - no external API)
  ├─ Can exist in multiple Libraries (same file, different Libraries)
  └─ Can be added to multiple Playlists
```

### 3. Metadata-Only Song Information
- Song information extracted **only** from file Metadata (ID3 tags)
- No external API integration (Last.fm, MusicBrainz, etc.)
- User can manually edit: Title, Artist, Album

### 4. Upload Requirements
- Every upload **must** specify target Library
- Default selection: Current Library or Default Library
- Multi-file upload supported

### 5. Sorting and Ordering
- **Playlists**: User-defined order (drag & drop), saved by frontend
- **Libraries**: Support alphabetical sorting (A-Z, Z-A)
- **Chinese songs**: Sort by Pinyin (拼音排序)
- **Default sort**: Date added (newest first)

### 6. Library Cover Image
- Use the **last added song's album cover** as Library cover
- No custom Library cover upload (keep it simple)

---

## Part 1: Online Experience (✅ Completed)

### Story 1: First-Time User (Cold Start)

**Goal**: New user signs in and uploads their first song

**Flow**:
```
1. Open app → Welcome page (not logged in)
2. Click "开始使用" → GitHub OAuth sign-in
3. Sign-in success → Redirect to main interface
   └─ Backend auto-creates:
      - "默认音乐库" (Default Library, isDefault: true, canDelete: false)
      - "我喜欢的音乐" (Favorites Playlist, isDefault: true, canDelete: false)

4. User sees mobile-first UI with 3-tab bottom navigation
5. Navigate to "音乐库" Tab → See "默认音乐库" card
6. Click Library card → Empty state + "上传歌曲" button
7. Click upload → Upload drawer appears (Library pre-selected)
8. Select files → Auto-extract Metadata → Upload
9. Upload complete → Song appears in Library
10. Click song → Start playing
```

**Acceptance Criteria**:
- [x] Default Library auto-created on first sign-in
- [x] Default Library cannot be deleted (UI shows disabled state)
- [x] Favorites Playlist auto-created
- [x] Upload flow pre-selects current Library
- [x] Metadata auto-extracted and displayed for editing
- [x] Mobile-first UI with bottom navigation

---

### Story 2: Managing Multiple Libraries

**Goal**: User creates and manages multiple music collections

**Flow**:

**Creating New Library**:
```
1. In "音乐库" Tab → Click floating "+" button
2. Enter Library name (e.g., "工作音乐")
3. Create success → New Library appears in list
4. Click to enter → Upload songs
```

**Switching Between Libraries**:
```
1. In "音乐库" Tab → See all Library cards:
   - 默认音乐库 (234 首歌曲) [封面图]
   - 工作音乐 (56 首歌曲) [封面图]
   - 健身音乐 (89 首歌曲) [封面图]
2. Click any Library → View songs in that Library
```

**Playing from Library**:
```
1. Enter a Library → See song list
2. Click "播放全部" → Start playing (creates linked playlist)
3. Or click single song → Play from that song
4. Mini Player shows at bottom
5. Tap Mini Player → Expand to Full Player
```

**Acceptance Criteria**:
- [x] Create new Library with custom name
- [x] Library list shows song count and cover
- [x] Library cover = last added song's album cover
- [x] Play from Library creates/updates linked playlist
- [x] Mini Player and Full Player working

---

### Story 3: Managing Playlists (Cross-Library)

**Goal**: User creates and manages playlists with songs from different Libraries

**Flow**:

**Creating Playlist**:
```
1. In "播放列表" Tab → Click floating "+"
2. Enter name (e.g., "深夜驾车")
3. Create success → Empty Playlist appears
```

**Adding Songs to Playlist**:

Method 1 - From Library:
```
1. Enter any Library → Long press on song
2. Popup menu → "添加到播放列表"
3. Select target Playlist (or create new)
4. Add success
```

Method 2 - From Now Playing (removed in current implementation):
```
Functionality integrated into Full Player actions
```

**Playing Playlist**:
```
1. In "播放列表" Tab → Click Playlist
2. Enter detail → Click "播放全部" or single song
3. Playback queue = songs in Playlist (may come from different Libraries)
4. In Playlist detail, show song source: "来自：工作音乐"
```

**Reordering Playlist Songs**:
```
1. In Playlist detail → Long press drag handle [≡]
2. Drag to reorder
3. Order saved automatically (frontend manages order)
```

**Acceptance Criteria**:
- [x] Create custom Playlists
- [x] Add songs from any Library to any Playlist
- [x] Playlist shows song source Library
- [x] Drag & drop reordering in Playlist
- [x] Sort by multiple criteria (date, title, artist, album)
- [x] Chinese song titles sorted by Pinyin
- [x] "我喜欢的音乐" Playlist cannot be deleted

---

### Story 4: Daily Playback Experience

**Goal**: User opens app and plays music seamlessly

**Flow**:
```
1. Open app → Auto-enter last viewed page
   - If previous playback exists → Mini Player shows last played song (paused)
   - If no history → Mini Player hidden

2. Mobile UI Components:

   Bottom Navigation (固定 3 个 Tab):
     - 音乐库 (Libraries)
     - 播放列表 (Playlists)  
     - 设置 (Settings)

   Mini Player (floating above bottom nav, always visible when song loaded):
     ┌─────────────────────────────────────┐
     │ [Cover] Song - Artist    [▶] [→]  │
     │ ▬▬▬▬▬●▬▬▬▬▬▬▬ 2:15 / 4:30         │
     └─────────────────────────────────────┘
     - Click to expand → Full Player
     - Visible on all authenticated pages

   Full Player (tap Mini Player to expand):
     - Large album cover (with blurred background)
     - Song info: Title, Artist, Album
     - Progress bar + timestamps
     - Playback controls: Previous, Play/Pause, Next
     - Action buttons:
       ├─ Add to Favorites ("我喜欢的音乐")
       ├─ Add to Playlist
       ├─ Shuffle
       └─ Repeat (off / one / all)
     - Swipe down → View Play Queue
     - Tap outside → Close to Mini Player

3. Play Queue Drawer (swipe up from Full Player):
   ┌─────────────────────────────────────┐
   │ 播放队列 (12 首)    [清空] [保存]  │
   ├─────────────────────────────────────┤
   │ 当前播放自：工作音乐 Library         │
   ├─────────────────────────────────────┤
   │ [Cover] Song 1 - Artist 1  [⋮] ← Now│
   │ [Cover] Song 2 - Artist 2  [⋮]     │
   │ [Cover] Song 3 - Artist 3  [⋮]     │
   └─────────────────────────────────────┘
   - Shows queue source (Library or Playlist)
   - Tap to switch songs
   - Delete from queue
   - Bottom buttons: "清空队列" "保存为播放列表"
```

**Acceptance Criteria**:
- [x] Mini Player always visible when song loaded
- [x] Tap to expand Full Player
- [x] Full Player shows detailed song info
- [x] Swipe/tap gestures work smoothly
- [x] Play Queue shows source (Library/Playlist)
- [x] Save current queue as new Playlist
- [x] Resume last playback on app reopen (with progress)

---

### Story 5: Uploading New Songs

**Goal**: User uploads songs to a specific Library

**Flow**:

**Upload from Library**:
```
1. Enter a Library → Click "上传歌曲" button
2. Upload drawer appears (current Library pre-selected)
3. Select files (multi-select supported)
4. Auto-extract Metadata → Show preview
5. User can manually edit: Title, Artist, Album
6. Click "开始上传"
7. Show progress (can close drawer, upload continues in background)
8. Upload complete → Auto-refresh Library list
```

**Upload from Global FAB**:
```
1. On any page → Click floating "+" button (bottom-right)
2. Upload drawer appears
3. Select target Library (dropdown selector)
4. Rest of flow same as above
```

**Acceptance Criteria**:
- [x] Upload must specify target Library
- [x] Multi-file upload supported
- [x] Metadata auto-extracted from files
- [x] User can edit Metadata before upload
- [x] Upload progress displayed
- [x] Background upload (can close drawer)
- [x] Auto-refresh Library after upload

---

## Part 2: Offline Experience (🎯 Current Focus)

### Design Goals

1. **Progressive Enhancement**: App works offline with gracefully degraded features
2. **Transparent Caching**: Users don't need to manually "download" songs
3. **Automatic Sync**: Offline mutations sync automatically when connection restored
4. **Clear Feedback**: UI always shows network/sync status

---

### Story 6: Automatic Offline Caching

**Goal**: Songs are automatically cached for offline playback without user intervention

**Flow**:

**Automatic Cache on Play**:
```
1. User plays a song (online)
2. Audio file automatically cached to IndexedDB
3. Next play (offline or online) loads from cache
4. No user action required
```

**Cache Strategy**:
```
Priority 1: Currently playing song
Priority 2: Next 3 songs in queue
Priority 3: Recently played songs (last 50)
Priority 4: Songs in "我喜欢的音乐" playlist
```

**Cache Management**:
```
1. Settings → Storage Management
2. View cache usage: "已缓存 234 首歌曲 (5.2 GB / 60 GB)"
3. Options:
   - Clear all cache
   - Clear old cache (>30 days not played)
   - Request persistent storage
```

**Acceptance Criteria**:
- [ ] Songs auto-cache on first play
- [ ] Pre-fetch next 3 songs in queue
- [ ] Cache survives browser restart
- [ ] Cache quota monitoring
- [ ] User can clear cache in Settings
- [ ] Persistent storage request prompt

---

### Story 7: Offline Playback

**Goal**: User can play cached songs without internet connection

**Flow**:

**Offline Playback**:
```
1. User goes offline (airplane mode, no WiFi)
2. Network indicator shows "离线" in top bar
3. User navigates to Library or Playlist
4. Cached songs show normal, uncached songs show "未缓存" badge
5. User plays cached song → Works normally
6. User tries to play uncached song → Toast: "此歌曲未缓存，需要网络连接"
7. Queue automatically skips uncached songs when offline
```

**Cache Indicators**:
```
Song List Item:
┌─────────────────────────────────────┐
│ [Cover] Song Title               [✓]│ ← Cached
│         Artist Name              3:45│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ [Cover] Song Title         [云 离线]│ ← Not cached
│         Artist Name              3:45│
└─────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] Network status indicator in UI
- [ ] Cached songs playable offline
- [ ] Uncached songs show clear indicator
- [ ] Auto-skip uncached songs in queue
- [ ] Error message when trying to play uncached
- [ ] No degradation in playback quality

---

### Story 8: Offline Mutations & Sync

**Goal**: User actions offline are queued and synced when connection restored

**Flow**:

**Offline Actions**:
```
1. User goes offline
2. User performs actions:
   - Add song to playlist
   - Remove song from playlist
   - Reorder playlist
   - Update song metadata (title, artist)
   - Create new playlist
   - Delete playlist
3. Each action stored in sync queue (IndexedDB)
4. UI updates optimistically
5. Action shows "待同步" badge
```

**Auto Sync on Reconnect**:
```
1. Network restored
2. Sync indicator shows "正在同步..."
3. Sync queue processed in order
4. On conflict: Server wins, local reverted with notification
5. Sync complete → "同步完成"
```

**Sync Queue Management**:
```
Settings → Sync Status:
┌─────────────────────────────────────┐
│ 待同步操作 (3)                       │
│ ├─ 添加歌曲到 "深夜驾车" (2分钟前)    │
│ ├─ 创建播放列表 "新歌单" (5分钟前)    │
│ └─ 修改歌曲信息 "Song A" (10分钟前)   │
│                                      │
│ [手动同步] [清空队列]                 │
└─────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] Offline mutations queued in IndexedDB
- [ ] UI updates optimistically
- [ ] Auto-sync on network restore
- [ ] Conflict resolution (server wins)
- [ ] Sync queue visible in Settings
- [ ] Manual sync trigger
- [ ] Clear sync queue option

---

### Story 9: Metadata Sync

**Goal**: Library and Playlist metadata always available offline

**Flow**:

**Metadata Caching**:
```
1. On app load (online):
   - Fetch all Libraries metadata
   - Fetch all Playlists metadata
   - Fetch all Songs metadata (without audio files)
   - Store in IndexedDB

2. Periodic refresh (every 5 minutes, online only):
   - Update changed metadata
   - Incremental sync

3. Offline mode:
   - Load metadata from IndexedDB
   - Show last sync time: "最后同步：2分钟前"
```

**Stale Data Handling**:
```
1. Offline for >24 hours
2. Warning banner: "数据可能已过期，请连接网络同步"
3. User can still browse/play cached content
4. On reconnect: Full metadata refresh
```

**Acceptance Criteria**:
- [ ] All metadata cached on app load
- [ ] Metadata survives browser restart
- [ ] Last sync time displayed
- [ ] Stale data warning (>24h)
- [ ] Incremental sync when online
- [ ] Full refresh on reconnect

---

### Story 10: Storage Quota Management

**Goal**: User understands and controls offline storage usage

**Flow**:

**Storage Status**:
```
Settings → 存储管理:
┌─────────────────────────────────────┐
│ 存储使用情况                         │
│                                      │
│ ██████████░░░░░░░░░░ 5.2 GB / 60 GB│
│                                      │
│ 详细信息:                            │
│ ├─ 音频文件: 4.8 GB (234 首)        │
│ ├─ 封面图片: 0.3 GB                 │
│ └─ 元数据: 0.1 GB                   │
│                                      │
│ [请求持久化存储]                     │
│ [清理缓存]                           │
└─────────────────────────────────────┘
```

**Quota Warning**:
```
When storage >80%:
┌─────────────────────────────────────┐
│ ⚠️ 存储空间即将用尽                  │
│                                      │
│ 已使用 52 GB / 60 GB                │
│                                      │
│ 建议操作:                            │
│ • 清理30天未播放的歌曲              │
│ • 删除不需要的播放列表              │
│ • 请求更多存储空间                  │
│                                      │
│ [立即清理] [稍后提醒]                │
└─────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] Storage usage displayed in Settings
- [ ] Breakdown by category (audio/covers/metadata)
- [ ] Request persistent storage option
- [ ] Quota warning at 80%
- [ ] Auto-cleanup suggestions
- [ ] Manual cache cleanup

---

### Story 11: PWA Installation

**Goal**: User installs M3W as a standalone app

**Flow**:

**Install Prompt**:
```
1. User visits M3W (2nd+ visit)
2. Browser shows install prompt
3. User clicks "Install"
4. App icon added to home screen
5. App launches in standalone mode (no browser UI)
```

**Installed App Experience**:
```
1. Launches in full screen
2. No browser address bar
3. Native feel on mobile
4. Works offline by default
5. Background sync when app closed
```

**Acceptance Criteria**:
- [ ] PWA manifest configured
- [ ] Service Worker registered
- [ ] Install prompt appears
- [ ] App installs to home screen
- [ ] Standalone mode works
- [ ] Offline functionality intact

---

## Key Data Flows

### 1. Cache Strategy

```typescript
// Service Worker cache strategy
const CACHE_NAME = 'm3w-v1';

// Cache-first for audio files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.includes('/api/songs/') && url.pathname.includes('/stream')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        
        return fetch(event.request).then((response) => {
          // Cache successful responses
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cloned);
            });
          }
          return response;
        });
      })
    );
  }
});
```

### 2. Sync Queue

```typescript
interface SyncAction {
  id: string;
  type: 'add_song' | 'remove_song' | 'reorder' | 'create_playlist' | 'delete_playlist';
  payload: any;
  timestamp: number;
  retries: number;
}

// Store in IndexedDB
const syncQueue: SyncAction[] = [];

// Process on reconnect
async function processSyncQueue() {
  for (const action of syncQueue) {
    try {
      await executeAction(action);
      removeFromQueue(action.id);
    } catch (error) {
      if (error.status === 409) {
        // Conflict: server wins
        revertLocalChange(action);
        notify('操作已被服务器更新覆盖');
      } else {
        action.retries++;
        if (action.retries > 3) {
          notify('操作同步失败，请手动重试');
        }
      }
    }
  }
}
```

### 3. Metadata Sync

```typescript
interface MetadataCache {
  libraries: Library[];
  playlists: Playlist[];
  songs: Song[];
  lastSync: number;
}

// Initial sync on app load
async function syncMetadata() {
  if (!navigator.onLine) {
    return loadFromIndexedDB();
  }
  
  const [libraries, playlists, songs] = await Promise.all([
    api.main.libraries.list(),
    api.main.playlists.list(),
    api.main.songs.listAll(),
  ]);
  
  await saveToIndexedDB({ libraries, playlists, songs, lastSync: Date.now() });
  
  return { libraries, playlists, songs };
}

// Incremental sync every 5 minutes
setInterval(async () => {
  if (navigator.onLine) {
    const lastSync = await getLastSyncTime();
    const changes = await api.main.sync.getChanges(lastSync);
    await applyChanges(changes);
  }
}, 5 * 60 * 1000);
```

---

## Technical Requirements

### Frontend

1. **Service Worker**: Vite PWA Plugin with Workbox
2. **IndexedDB**: Dexie for structured data
3. **Cache API**: For audio file caching
4. **Background Sync API**: For offline mutations
5. **Storage Quota API**: For quota management

### Backend

1. **Sync Endpoint**: `GET /api/sync/changes?since={timestamp}`
2. **Conflict Resolution**: Last-write-wins with timestamps
3. **Batch Operations**: Accept multiple actions in single request
4. **Idempotency**: All mutations must be idempotent

---

## Out of Scope (Future Enhancements)

- ❌ Library sharing with other users
- ❌ External metadata API integration (Last.fm, MusicBrainz)
- ❌ Smart playlists (auto-generated based on criteria)
- ❌ Lyrics integration
- ❌ Audio equalizer
- ❌ Social features (comments, likes)
- ❌ Collaborative playlists
- ❌ P2P file sharing
- ❌ Cloud backup

---

## References

- Main project context: `.github/instructions/project-context.instructions.md`
- Development standards: `.github/instructions/development-standards.instructions.md`
- API patterns: `.github/instructions/api-patterns.instructions.md`
- i18n system: `.github/instructions/i18n-system.instructions.md`

---

**Document Version**: v1.0  
**Last Updated**: 2025-11-18
