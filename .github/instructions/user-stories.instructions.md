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

## Part 2: Standalone Offline Experience (Phase 1 Design)

**Concept**: A fully functional local music player that requires **zero** server interaction. This is the "Guest Mode" or "Local Mode".

### Story 6: Guest Entry (Zero Friction)

**Goal**: User opens the app and starts using it immediately without an account.

**Flow**:
1.  **Entry**: On the Sign-in page, user clicks "Offline Mode" (离线使用).
2.  **Initialization**:
    - System initializes a `Guest` session (no token).
    - Router switches to `OfflineProxy` mode.
    - Auto-creates local resources in IndexedDB: "Local Library" and "Favorites".
3.  **Landing**: User lands on the Dashboard, UI is identical to logged-in state but strictly local.

**Acceptance Criteria**:
- [x] "Offline Mode" button on Sign-in page.
- [x] No network requests sent to backend API.
- [x] `authStore` handles Guest state correctly.
- [x] Default local library and playlist created in IndexedDB.

### Story 7: Local Resource Management

**Goal**: Guest user manages Libraries and Playlists locally.

**Flow**:
1.  **Create**: User creates a "Gym Playlist" or "Work Library".
2.  **Storage**: Data is stored **only** in browser IndexedDB.
3.  **Persistence**: Data survives browser restarts.
4.  **Isolation**: These resources have `userId: 'guest'` and are invisible to other users (if multiple people used the same browser).

**Acceptance Criteria**:
- [x] CRUD operations for Libraries/Playlists work via `OfflineProxy`.
- [x] Data persists across reloads.

### Story 8: Local File Import

**Goal**: Guest user adds music to their local library.

**Context**: In Offline Mode, we don't "upload" to a server. We "import" to the browser.

**Flow**:
1.  **Action**: User clicks "Import Songs" (replaces "Upload" text in Guest Mode).
2.  **Processing**:
    - Files selected from device.
    - Metadata extracted in-browser (`music-metadata-browser`).
    - Audio file cached in Cache Storage API via Service Worker.
    - Cover art extracted and cached locally.
    - Metadata stored in IndexedDB.
3.  **Result**: Song appears in Local Library immediately.

**Acceptance Criteria**:
- [x] File import stores audio in Cache Storage API.
- [x] Metadata stored in IndexedDB.
- [x] Cover art cached via Service Worker.
- [ ] Storage quota checked before import.
- [ ] Progress bar reflects local processing speed.

---

## Part 3: Account Binding (Phase 2 Design)

**Concept**: Bridging the gap. A Guest user decides to sign up/in to a Self-hosted server and wants to keep their data.

### Story 9: Guest to Account Migration

**Goal**: Guest user logs in and merges local data to the server.

**Flow**:
1.  **Trigger**: Guest user clicks "Sign In" in Settings.
2.  **Authentication**: User completes GitHub OAuth flow.
3.  **Decision Prompt**:
    - "We found local data. What would you like to do?"
    - Option A: **Merge to Account** (Upload local songs/playlists to server).
    - Option B: **Keep Local Only** (Stay as local data, separate from account - *Complex, maybe V2*).
    - Option C: **Discard** (Clear guest data).
4.  **Execution (Merge)**:
    - Background process uploads local songs to Server.
    - Creates corresponding Libraries/Playlists on Server.
    - Updates local IndexedDB IDs to match new Server IDs.
5.  **Completion**: User is now fully "Online" with their previous data.

**Acceptance Criteria**:
- [ ] Detect pre-existing guest data on login.
- [ ] Migration UI/Wizard.
- [ ] Batch upload mechanism for migration.

---

## Part 4: Temporary Offline Experience (Phase 3 Design)

**Concept**: The "Classic" offline mode. An Online (Self-hosted) user loses internet connection or wants to save data for travel.

### Story 10: Transparent Caching (Online -> Local)

**Goal**: Online user's content is automatically available offline.

**Flow**:
1.  **Passive Cache**: When playing a song online, it is cached to IndexedDB/Cache API.
2.  **Active Download**: User clicks "Download" on a Playlist/Library.
3.  **Sync**: Metadata (text) is synced periodically to IndexedDB.

**Acceptance Criteria**:
- [ ] Audio files cached on play.
- [ ] Metadata synced locally.

### Story 11: Offline Fallback (Roaming)

**Goal**: Seamless transition when network drops.

**Flow**:
1.  **Event**: Network disconnects.
2.  **UI Update**: "Offline" badge appears.
3.  **Router Switch**: API requests fallback to `OfflineProxy` (Read-Only for server data, or Queue for mutations).
4.  **Playback**:
    - Cached songs play normally.
    - Uncached songs show disabled state.

**Acceptance Criteria**:
- [ ] Graceful degradation when offline.
- [ ] Clear indication of what is playable.

---

## Key Data Flows│                                      │
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

### Story 12: Guest Mode (Offline First)

**Goal**: Enable immediate, full-featured app usage without requiring an account or internet connection.

**Context**:
Currently, the app requires GitHub login to start. This creates friction for users who just want to play local files or test the app. Guest Mode allows the app to function as a purely local music player.

**Flow**:

1.  **Guest Entry**:
    - On the Sign-In page, user sees a "Use Offline" (离线使用) button.
    - Clicking it bypasses OAuth and initializes a "Guest Session".

2.  **System Initialization (Invisible to User)**:
    - `AuthStore` sets user to a local Guest identity.
    - `Router` switches to **Offline Mode**, directing ALL API requests to the `OfflineProxy`.
    - `OfflineProxy` initializes a local database (IndexedDB) if not present.
    - Default resources are created locally: "Local Library" (Default) and "Favorites".

3.  **The Guest Experience**:
    - **Interface**: Identical to the logged-in experience.
    - **Upload**: Files are processed locally; metadata extracted in browser; audio cached in Cache Storage.
    - **Playback**: Full player features work (queue, loop, shuffle, seek with Range requests).
    - **Persistence**: Data survives browser restarts (metadata in IndexedDB, audio in Cache Storage).

4.  **Limitations & Feedback**:
    - **Sync**: Disabled. Settings page shows "Guest Mode - Local Only".
    - **Network**: App behaves as if "Offline" regarding server communication, but "Online" for local operations.

5.  **Transition to Account (Future Scope)**:
    - User clicks "Sign In" in Settings.
    - Prompt: "Switching to account will hide guest data" (MVP) or "Merge data" (Future).

**Acceptance Criteria**:
- [x] "Offline Mode" button on Sign-in page
- [x] Guest user identity managed in AuthStore
- [x] Router intercepts API calls and directs to Offline Proxy
- [x] Offline Proxy handles "guest" userId
- [x] Full feature set available locally (Create Library, Upload, Play)
- [x] No server calls made in Guest Mode
- [x] Cover art extraction from audio files
- [x] HMR fixes and proper initialization
- [x] IndexedDB v2 with linkedLibraryId index
- [x] Audio files cached in Cache Storage API
- [x] Service Worker with Range request support for seek
- [x] Player preferences and progress persistence

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

1. **Service Worker**: Custom implementation with token injection (Vite PWA Plugin injectManifest strategy)
2. **IndexedDB**: Dexie for metadata storage (libraries, playlists, songs, preferences, progress)
3. **Cache Storage API**: For audio/cover file caching with Range request support
4. **Background Sync API**: For offline mutations (planned)
5. **Storage Quota API**: For quota management (Issue #50)

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

**Document Version**: v1.1  
**Last Updated**: 2025-11-20
