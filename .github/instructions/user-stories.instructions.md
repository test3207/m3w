# User Stories Instruction

## Metadata

**Created**: 2025-11-18  
**Last Updated**: 2025-12-10  
**Status**: Active

---

## Overview

This document defines all user stories and product goals for M3W. Stories are organized by **user type** and **network state** to provide clear boundaries and avoid overlap.

### User Type × Network State Matrix

```
┌─────────────┬───────────────────────────────────────┐
│             │           Network State               │
│ User Type   ├───────────────────┬───────────────────┤
│             │      Online       │      Offline      │
├─────────────┼───────────────────┼───────────────────┤
│   Guest     │  Part 2: Local    │  Part 2: Local    │
│ (no account)│  (No difference)  │  (No difference)  │
├─────────────┼───────────────────┼───────────────────┤
│   Auth      │  Part 1: Online   │  Part 3: Offline  │
│(has account)│  Part 4: Sync     │  Degradation      │
└─────────────┴───────────────────┴───────────────────┘

Transition:
├── Guest → Auth: Part 2.5: Account Binding & Data Migration
```

### Document Structure

| Part | Title | User Type | Focus |
|------|-------|-----------|-------|
| **Part 1** | Online Experience | Auth + Online | Core features (✅ Complete) |
| **Part 2** | Guest Mode (Local-Only) | Guest | Pure local player (✅ Complete) |
| **Part 2.5** | Guest to Auth Migration | Guest → Auth | Account binding & data merge |
| **Part 3** | Auth Offline Experience | Auth + Offline | Offline degradation & recovery |
| **Part 4** | Cross-Device Sync | Auth | Multi-device data consistency |

---

## Core Design Principles

### 1. Multi-Library Architecture
- Users can create multiple Libraries (music collections)
- Each Library is an independent music collection
- Future feature: Share Libraries with other users (not in current scope)
- Default Library is auto-created and **cannot be deleted**

### 2. Library vs Playlist Separation
```
Library
  ├─ User's music file collections
  ├─ Multiple Libraries allowed (e.g., "My Music", "Work Music", "Classical")
  ├─ Each Library independently managed
  ├─ Songs can exist in multiple Libraries (by design - for sharing)
  └─ Future: Can be shared with other users

Playlist
  ├─ Cross-Library playback queues
  ├─ User-created and managed
  ├─ Can contain songs from different Libraries
  ├─ Default Playlist "Favorites" - cannot be deleted
  └─ Playing from Library auto-generates temporary Playlist

Song
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
- **Chinese songs**: Sort by Pinyin
- **Default sort**: Date added (newest first)

### 6. Library Cover Image
- Use the **last added song's album cover** as Library cover
- No custom Library cover upload (keep it simple)

---

## Part 1: Online Experience (Auth + Online) ✅ Complete

**Context**: Authenticated user with stable network connection. This is the primary use case.

### Story 1.1: First-Time User (Cold Start)

**Goal**: New user signs in and uploads their first song

**Flow**:
```
1. Open app → Welcome page (not logged in)
2. Click "Get Started" → GitHub OAuth sign-in
3. Sign-in success → Redirect to main interface
   └─ Backend auto-creates:
      - "Default Library" (isDefault: true, canDelete: false)
      - "Favorites" Playlist (isDefault: true, canDelete: false)

4. User sees mobile-first UI with 3-tab bottom navigation
5. Navigate to "Libraries" Tab → See "Default Library" card
6. Click Library card → Empty state + "Upload Songs" button
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

### Story 1.2: Managing Multiple Libraries

**Goal**: User creates and manages multiple music collections

**Flow**:

**Creating New Library**:
```
1. In "Libraries" Tab → Click floating "+" button
2. Enter Library name (e.g., "Work Music")
3. Create success → New Library appears in list
4. Click to enter → Upload songs
```

**Switching Between Libraries**:
```
1. In "Libraries" Tab → See all Library cards:
   - Default Library (234 songs) [cover]
   - Work Music (56 songs) [cover]
   - Workout Music (89 songs) [cover]
2. Click any Library → View songs in that Library
```

**Playing from Library**:
```
1. Enter a Library → See song list
2. Click "Play All" → Start playing (creates linked playlist)
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

### Story 1.3: Managing Playlists (Cross-Library)

**Goal**: User creates and manages playlists with songs from different Libraries

**Flow**:

**Creating Playlist**:
```
1. In "Playlists" Tab → Click floating "+"
2. Enter name (e.g., "Late Night Drive")
3. Create success → Empty Playlist appears
```

**Adding Songs to Playlist**:
```
1. Enter any Library → Long press on song
2. Popup menu → "Add to Playlist"
3. Select target Playlist (or create new)
4. Add success
```

**Playing Playlist**:
```
1. In "Playlists" Tab → Click Playlist
2. Enter detail → Click "Play All" or single song
3. Playback queue = songs in Playlist (may come from different Libraries)
4. In Playlist detail, show song source: "From: Work Music"
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
- [x] "Favorites" Playlist cannot be deleted

---

### Story 1.4: Daily Playback Experience

**Goal**: User opens app and plays music seamlessly

**Flow**:
```
1. Open app → Auto-enter last viewed page
   - If previous playback exists → Mini Player shows last played song (paused)
   - If no history → Mini Player hidden

2. Mobile UI Components:

   Bottom Navigation (fixed 3 tabs):
     - Libraries
     - Playlists
     - Settings

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
       ├─ Add to Favorites
       ├─ Add to Playlist
       ├─ Shuffle
       └─ Repeat (off / one / all)
     - Swipe down → View Play Queue
     - Tap outside → Close to Mini Player

3. Play Queue Drawer (swipe up from Full Player):
   ┌─────────────────────────────────────┐
   │ Play Queue (12 songs)  [Clear][Save]│
   ├─────────────────────────────────────┤
   │ Now playing from: Work Music Library │
   ├─────────────────────────────────────┤
   │ [Cover] Song 1 - Artist 1  [⋮] ← Now│
   │ [Cover] Song 2 - Artist 2  [⋮]     │
   │ [Cover] Song 3 - Artist 3  [⋮]     │
   └─────────────────────────────────────┘
   - Shows queue source (Library or Playlist)
   - Tap to switch songs
   - Delete from queue
   - Bottom buttons: "Clear Queue" "Save as Playlist"
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

### Story 1.5: Uploading New Songs

**Goal**: User uploads songs to a specific Library

**Flow**:

**Upload from Library**:
```
1. Enter a Library → Click "Upload Songs" button
2. Upload drawer appears (current Library pre-selected)
3. Select files (multi-select supported)
4. Auto-extract Metadata → Show preview
5. User can manually edit: Title, Artist, Album
6. Click "Start Upload"
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

## Part 2: Guest Mode (Local-Only) ✅ Complete

**Context**: User without account, or user choosing to use app offline-first. All data stored locally in browser. No server interaction.

**Key Characteristics**:
- No authentication required
- All data in IndexedDB + Cache Storage
- Network state irrelevant (always "local")
- Feature parity with Auth mode (except sync)

### Story 2.1: Guest Entry (Zero Friction)

**Goal**: User opens the app and starts using it immediately without an account.

**Flow**:
```
1. Open app → Sign-in page
2. Click "Offline Mode" button
3. System initializes Guest session:
   └─ authStore sets user to Guest identity
   └─ Router switches to OfflineProxy mode
   └─ IndexedDB initialized with schema
   └─ Auto-creates local default resources:
      - "Local Library"
      - "Favorites"
4. User lands on Dashboard
5. UI identical to logged-in state
```

**Acceptance Criteria**:
- [x] "Offline Mode" button on Sign-in page
- [x] No network requests to backend API
- [x] authStore handles Guest state correctly
- [x] Default local library and playlist created in IndexedDB
- [x] Settings page shows "Guest Mode - Local Storage Only"

---

### Story 2.2: Local Music Management

**Goal**: Guest user manages Libraries, Playlists, and Songs locally.

**Flow**:
```
1. Create Library/Playlist → Stored in IndexedDB
2. Import songs → Audio cached in Cache Storage, metadata in IndexedDB
3. Play songs → Served from Cache Storage via Service Worker
4. Edit metadata → Updated in IndexedDB
5. Delete songs → Removed from both IndexedDB and Cache Storage
6. All data persists across browser restarts
```

**Key Differences from Auth Mode**:
| Feature | Auth Mode | Guest Mode |
|---------|-----------|------------|
| Storage | Server (MinIO) | Cache Storage API |
| Metadata | PostgreSQL | IndexedDB |
| Upload text | "Upload Songs" | "Import Songs" |
| Sync | Available | N/A |
| Cross-device | Yes | No |

**Acceptance Criteria**:
- [x] CRUD operations work via OfflineProxy
- [x] Data persists across browser restarts
- [x] Cover art extracted from audio files locally
- [x] Service Worker handles Range requests for seek
- [x] Player preferences and progress persistence
- [ ] Storage quota warning before import (Issue #50)

---

### Story 2.3: Guest Limitations & Feedback

**Goal**: User understands Guest mode limitations clearly.

**UI Indicators**:
```
Settings Page:
┌─────────────────────────────────────┐
│ Account                             │
├─────────────────────────────────────┤
│ 👤 Guest Mode                       │
│    Local storage only, no sync      │
│                                     │
│ [Sign in with GitHub]               │
│    Sign in to sync across devices   │
└─────────────────────────────────────┘

Storage Section:
┌─────────────────────────────────────┐
│ Local Storage                       │
├─────────────────────────────────────┤
│ ██████████░░░░░░░░░░ 5.2 GB / 60 GB│
│                                     │
│ Audio files: 4.8 GB (234 songs)     │
│ Cover images: 0.3 GB                │
│ Metadata: 0.1 GB                    │
│                                     │
│ [Request Persistent Storage][Clear] │
└─────────────────────────────────────┘
```

**Acceptance Criteria**:
- [x] Settings clearly shows Guest mode status
- [ ] Storage usage breakdown displayed (Issue #50)
- [ ] "Request Persistent Storage" button (Issue #50)
- [ ] Cache cleanup option (Issue #51)

---

## Part 2.5: Guest to Auth Migration

**Context**: Guest user decides to create an account and wants to keep their local data.

**Related Issues**: #33, #129, #131 (Epic 8)

### Story 2.5.1: Migration Decision

**Goal**: Guest user is prompted about their data when signing in.

**Flow**:
```
1. Guest user clicks "Sign in with GitHub" in Settings
2. Complete GitHub OAuth flow
3. System detects existing local data:
   - X libraries, Y playlists, Z songs
4. Migration prompt appears:
   ┌─────────────────────────────────────┐
   │ Local Data Detected                 │
   ├─────────────────────────────────────┤
   │ You have 3 libraries, 5 playlists,  │
   │ and 234 songs stored locally.       │
   │                                     │
   │ Choose how to proceed:              │
   │                                     │
   │ [Merge to Account]                  │
   │   Upload local data to server       │
   │                                     │
   │ [Keep Local]                        │
   │   Sign in but keep local data       │
   │   separate (can merge later)        │
   │                                     │
   │ [Discard Local Data]                │
   │   Clear local data, use account data│
   └─────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] Detect pre-existing guest data on login
- [ ] Show data summary (counts)
- [ ] Three-option migration prompt
- [ ] "Keep Local" allows coexistence (complex, may be V2)

---

### Story 2.5.2: Data Migration Execution

**Goal**: Guest data is merged into authenticated account.

**Flow** (when user chooses "Merge to Account"):
```
1. Show migration progress:
   ┌─────────────────────────────────────┐
   │ Migrating data...                   │
   ├─────────────────────────────────────┤
   │ ████████░░░░░░░░░░░░ 40%           │
   │                                     │
   │ ✓ Libraries: 3/3                    │
   │ ✓ Playlists: 5/5                    │
   │ ⋯ Songs: 94/234                     │
   │                                     │
   │ Estimated time remaining: 3 min     │
   └─────────────────────────────────────┘

2. For each local entity:
   a. Upload to server (songs: upload audio file)
   b. Server returns new server ID
   c. Update local ID mapping (localId → serverId)
   d. Mark as synced

3. Handle conflicts:
   - Same-name library/playlist: Prompt user to rename or merge
   - Duplicate song (by hash): Skip upload, link to existing

4. Migration complete:
   ┌─────────────────────────────────────┐
   │ ✓ Migration Complete                │
   ├─────────────────────────────────────┤
   │ Migrated:                           │
   │ • 3 libraries                       │
   │ • 5 playlists                       │
   │ • 234 songs                         │
   │                                     │
   │ Your data is now synced to cloud    │
   │                                     │
   │ [Done]                              │
   └─────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] Batch upload mechanism for songs
- [ ] ID mapping: local ID → server ID (#129)
- [ ] Playlist references updated after song ID changes
- [ ] Conflict resolution for name collisions
- [ ] Partial failure recovery (resume from last point)
- [ ] Progress indication with ETA

---

## Part 3: Auth Offline Experience

**Context**: Authenticated user loses network connection or is in offline environment. App should degrade gracefully and recover when back online.

**Related Issues**: #87 (Epic 5), #131 (Epic 8)

### Story 3.1: Offline Detection & UI Feedback

**Goal**: User is clearly informed when offline and what features are available.

**Flow**:
```
1. Network disconnects (navigator.onLine = false OR backend unreachable)
2. UI updates:
   - Network indicator changes to "Offline"
   - Toast: "Network disconnected, some features limited"
3. Feature availability:
   ┌─────────────────────────────────────┐
   │ Feature         │ Online │ Offline │
   ├─────────────────────────────────────┤
   │ Play cached     │   ✓    │    ✓    │
   │ Play uncached   │   ✓    │    ✗*   │
   │ Browse library  │   ✓    │    ✓**  │
   │ Create library  │   ✓    │    ✓*** │
   │ Create playlist │   ✓    │    ✓*** │
   │ Upload songs    │   ✓    │    ✓*** │
   │ Delete songs    │   ✓    │    ✓*** │
   └─────────────────────────────────────┘
   * Auto-skip to next cached song, toast with debounce
   ** If metadata cached locally
   *** Queued for sync when online
```

**Uncached Song Auto-Skip Behavior**:
```
When playing a queue with mixed cached/uncached songs:
1. Player attempts to play next song
2. If uncached and offline → Auto-skip to next cached song
3. Show debounced toast: "Skipped [N] songs (network required)"
   - Debounce: One toast per user interaction (play/next/prev)
   - Accumulate skipped count during single skip sequence
4. If no cached songs remaining → Stop playback, show "No cached songs available"
```

**Acceptance Criteria**:
- [x] Network status indicator in UI
- [x] Dual detection: navigator.onLine + backend ping
- [ ] Clear indication of cached vs uncached content
- [ ] Uncached songs show disabled state with "Network required" badge
- [ ] Auto-skip uncached songs when offline with debounced toast
- [ ] Create library/playlist works offline (queued for sync)
- [ ] Upload songs works offline (stored locally, queued for sync)

---

### Story 3.2: Offline Playback

**Goal**: User can play previously cached songs while offline.

**Prerequisite**: Songs must be cached (via Story 3.4 or Story 4.3).

**Flow**:
```
1. User is offline
2. Opens a Library or Playlist
3. Song list shows:
   - Cached songs: Normal appearance, playable
   - Uncached songs: Normal appearance with "cloud" badge (still clickable)
4. Click cached song → Plays from Cache Storage
5. Click uncached song → Auto-skip to next cached song (per Story 3.1)
6. Service Worker intercepts request → Returns cached audio
7. Playback works normally (seek, progress, etc.)
```

**Acceptance Criteria**:
- [x] Cached songs playable offline
- [x] Service Worker serves audio from Cache Storage
- [x] Range request support for seeking
- [x] Visual badge indicating cached/uncached status
- [ ] Uncached songs auto-skip when offline (per Story 3.1)

---

### Story 3.3: Offline Mutations (State-Based Sync)

**Goal**: User can make changes offline that sync when back online.

**Flow**:
```
1. User is offline
2. User creates a new playlist "My Collection"
3. System:
   - Creates playlist in IndexedDB immediately
   - Marks entity with sync flags: _isDirty=true, _isLocalOnly=true
   - UI shows playlist normally (with sync pending indicator)
4. User continues making changes (add songs, reorder, etc.)
   - Each mutation updates IndexedDB and sets _isDirty=true
5. Network reconnects
6. Sync triggers (on reconnect / app foreground / timer):
   a. PUSH: Find all dirty entities, send current state to server
   b. Server returns IDs for new entities (localId → serverId mapping)
   c. PULL: Fetch latest server state, merge into local
   d. Clear sync flags (_isDirty=false, _isLocalOnly=false)
7. UI updates: sync indicator disappears
```

**Key Design**: State-based sync, NOT request replay
- We sync the **current state** of entities, not a log of operations
- Multiple offline edits to the same entity = one sync operation
- Conflict resolution happens at entity level (server-wins default)

**Supported Offline Mutations**:
| Mutation | Offline Behavior |
|----------|------------------|
| Create Library | IndexedDB + _isLocalOnly |
| Edit Library | IndexedDB + _isDirty |
| Delete Library | IndexedDB + _isDeleted (except Default Library) |
| Create Playlist | IndexedDB + _isLocalOnly |
| Edit Playlist | IndexedDB + _isDirty |
| Delete Playlist | IndexedDB + _isDeleted (except Favorites) |
| Add to Playlist | IndexedDB + _isDirty |
| Remove from Playlist | IndexedDB + _isDirty |
| Reorder Playlist | IndexedDB + _isDirty |
| Delete Song | IndexedDB + _isDeleted |
| Upload Song | Cache Storage + IndexedDB + _isLocalOnly |

**Note**: Default Library and Favorites Playlist (auto-created on init) have `canDelete: false` and cannot be deleted in both online and offline modes.

**Acceptance Criteria**:
- [ ] All mutations work offline via IndexedDB
- [ ] Dirty tracking with sync flags (_isDirty, _isLocalOnly, _isDeleted)
- [ ] Sync indicator on entities with pending changes
- [ ] State-based push on reconnect (not request replay)
- [ ] ID mapping for locally-created entities
- [ ] Server-wins conflict resolution

---

### Story 3.4: Proactive Caching

**Goal**: User controls which libraries are cached for offline use.

**Cache Strategy Overview**:
```
┌─────────────────────────────────────────────────────────────┐
│ Layer           │ Setting              │ Behavior           │
├─────────────────────────────────────────────────────────────┤
│ Backend Global  │ cacheAllEnabled      │ Sync across devices│
│                 │ (default: false)     │ when enabled       │
├─────────────────────────────────────────────────────────────┤
│ Frontend Global │ Download Timing      │ WiFi-only / Always │
│                 │                      │ / Manual           │
├─────────────────────────────────────────────────────────────┤
│ Frontend Library│ Manual cache button  │ Cache this library │
│                 │ (per-library)        │ regardless of above│
├─────────────────────────────────────────────────────────────┤
│ Automatic       │ Cache-on-play        │ Always enabled     │
└─────────────────────────────────────────────────────────────┘

Key behaviors:
- Backend default: NO auto-cache (conservative, save bandwidth)
- Backend cacheAllEnabled=true → Honor frontend Download Timing
- Frontend can always manually cache any library
- Played songs always cached automatically
```

**Flow**:

**Manual Library Cache**:
```
1. Open Library detail → More menu (⋮)
2. Click "Download for Offline"
3. Progress indicator shows download status
4. All songs in library cached when complete
5. Works regardless of backend cacheAllEnabled setting
```

**Global Cache Setting**:
```
Settings → Offline Settings:
┌─────────────────────────────────────┐
│ Download Timing                     │
├─────────────────────────────────────┤
│   ○ WiFi only (default)             │
│   ○ Any network                     │
│   ○ Manual only                     │
│                                     │
│ Cache All Libraries                 │
│   [x] Enabled                       │
│       (Synced to account, downloads │
│       all libraries when timing     │
│       allows)                       │
│                                     │
│ Storage: 156/234 songs cached       │
└─────────────────────────────────────┘
```

**Cache on Upload** (Issue #124):
```
When uploading in online mode:
1. Upload file to server
2. Immediately cache locally (file already in memory)
3. Song available offline instantly after upload
```

**Cache-on-Play** (Always enabled):
```
When playing an uncached song online:
1. Stream from server
2. Cache audio file after playback completes
3. Song available offline for next play
```

**Acceptance Criteria**:
- [ ] Backend cacheAllEnabled preference synced (#106)
- [ ] Frontend Download Timing control (WiFi-only / Always / Manual)
- [ ] Manual "Download for Offline" per library
- [ ] Cache-on-play for streamed songs
- [ ] Cache immediately after upload (#124)
- [ ] Download respects timing when backend cacheAllEnabled
- [ ] Cache status indicator on libraries

---

## Part 4: Cross-Device Sync

**Context**: Authenticated user uses M3W on multiple devices. Data should be consistent across devices.

**Related Issues**: #106, #124, #131 (Epic 8)

### Story 4.1: Initial Sync (New Device)

**Goal**: User logs in on a new device and sees all their data.

**Flow**:
```
1. User logs in on Device B (already has account with data on Device A)
2. Initial sync triggers:
   - Pull all libraries from server (includes cacheOverride setting)
   - Pull all playlists from server
   - Pull all song metadata from server
   - Pull player preferences from server (includes cacheAllEnabled)
3. UI shows data immediately
4. Audio files downloaded based on cache policy (4-layer hierarchy):
   - For each library: evaluate shouldCacheLibrary()
   - If true and canDownloadNow(): queue background download
5. User can browse all content
6. Playing uncached song → Stream from server → Cache after playback
```

**Acceptance Criteria**:
- [x] Metadata synced on login
- [x] Libraries, playlists, songs visible
- [ ] Preferences synced (shuffle, repeat, cacheAllEnabled) (#106)
- [ ] Backend library cacheOverride setting synced
- [ ] Audio download respects 4-layer cache policy
- [ ] Download timing respected (WiFi-only / Always / Manual)
- [ ] Cache-on-play for streamed songs

---

### Story 4.2: Ongoing Sync (Multi-Device)

**Goal**: Changes on one device appear on other devices.

**Flow**:
```
Device A (Online):
1. User creates new playlist "Road Trip"
2. Adds 10 songs to playlist
3. Changes sync to server immediately

Device B (Online, app open):
1. Periodic sync check (every 5 minutes)
2. Detects new playlist
3. Downloads metadata
4. Playlist appears in UI

Device B (Online, app reopened):
1. Full metadata sync on app start
2. All changes from Device A visible
```

**Pull-to-Refresh**:
```
Supported Pages:
┌─────────────────────────────────────────────────────────┐
│ Page              │ Sync Scope                          │
├─────────────────────────────────────────────────────────┤
│ Libraries list    │ Full: all libraries + preferences   │
│ Library detail    │ Incremental: songs in this library  │
│ Playlists list    │ Full: all playlists                 │
│ Playlist detail   │ Incremental: songs + order          │
└─────────────────────────────────────────────────────────┘

Not supported: Settings, Full Player (not list pages)

Trigger Conditions (to avoid conflict with normal scroll):
- Only triggers when list is at top (scrollTop === 0)
- Requires pull distance > threshold (e.g., 60px)
- Visual indicator appears during pull to signal refresh intent

Interaction:
1. User pulls down on list → Loading indicator appears
2. Sync completes → Indicator disappears, list updates
3. Sync fails → Toast: "Sync failed" or "Network unavailable"
4. Offline mode → Pull still triggers, shows "Network unavailable"
```

**Sync Triggers**:
- App start/foreground
- Every 5 minutes while active
- Pull-to-refresh gesture
- After local mutation

**Acceptance Criteria**:
- [x] Push changes to server on mutation
- [x] Pull changes on app start
- [ ] Pull-to-refresh on list pages (Libraries, Playlists, details)
- [ ] Periodic background sync (5 minutes)
- [ ] Sync indicator during refresh
- [ ] Appropriate error feedback when offline

---

### Story 4.3: Sync Conflict Resolution

**Goal**: Conflicts between devices are resolved gracefully.

**Conflict Resolution Strategy**: Server-Wins (Push-First)
```
The same Push → Pull flow handles all conflicts:

Device A (connects first):
1. Push local changes → Success (server updated)
2. Pull server state → Normal merge

Device B (connects later):
1. Push local changes → Fail (version conflict)
2. Discard local conflicting changes
3. Pull server state → Overwrite local with server version
4. Toast: "Changes synced from another device"

Result: Whoever pushes first wins, others get overwritten.
```

**Conflict Scenarios**:

1. **Playlist Modified on Two Devices**:
   ```
   Device A: Adds 3 songs to playlist "Road Trip"
   Device B: Removes 2 songs from playlist "Road Trip"
   
   Resolution: First to push wins
   - Device A pushes first → Server has A's version
   - Device B pushes → Conflict detected → Pull A's version
   - Device B's changes discarded
   ```

2. **Playlist Deleted vs Modified**:
   ```
   Device A: Deletes playlist "Road Trip"
   Device B: Adds song to playlist "Road Trip"
   
   Resolution: First to push wins
   - If A pushes first → Playlist deleted on both
   - If B pushes first → Playlist exists with new song
   - Toast on losing device: "Playlist 'Road Trip' was deleted on another device"
   ```

3. **Library Order Changed**:
   ```
   Device A: Reorders libraries to [C, A, B]
   Device B: Reorders libraries to [B, C, A]
   
   Resolution: First to push wins on order field
   ```

**Note**: Song rename conflicts do not exist (edit metadata not supported).

**Acceptance Criteria**:
- [x] Server-Wins default strategy
- [ ] Push failure triggers automatic pull
- [ ] Local changes discarded on conflict
- [ ] Toast feedback for sync from other device

---

### Story 4.4: Preferences Sync

**Goal**: User preferences are consistent across devices.

**Synced Preferences**:
| Preference | Current | Target |
|------------|---------|--------|
| Shuffle mode | ✅ Synced | ✅ Done |
| Repeat mode | ✅ Synced | ✅ Done |
| cacheAllEnabled | ❌ Local only | ✅ Sync (#106) |
| Language | ❌ Local only | ❓ TBD (may follow device) |

**Note**: Volume is not synced (device-specific, not provided in our app).

**Local-Only Settings** (device-specific, NOT synced):
- Download Timing (WiFi-only / Always / Manual)
- Per-library manual cache status

**Flow**:
```
1. User enables "Cache All Libraries" on Device A
2. Preference syncs to server (cacheAllEnabled = true)
3. Device B pulls preferences on next sync
4. Device B sees cacheAllEnabled = true
5. Device B honors its local Download Timing setting
6. If Download Timing allows → Start background download
```

**Example Scenario**:
```
Device A (Phone, cellular):
- cacheAllEnabled = true (from server)
- Download Timing = WiFi only
- Result: Waits for WiFi before downloading

Device B (Tablet, home WiFi):
- cacheAllEnabled = true (from server)
- Download Timing = Always
- Result: Starts downloading immediately
```

**Acceptance Criteria**:
- [x] Shuffle/Repeat mode synced
- [ ] Backend API for cacheAllEnabled preference (#106)
- [ ] cacheAllEnabled synced across devices
- [ ] Download Timing remains device-local
- [ ] Manual library cache remains device-local

---

## Technical Architecture

### Core Design: Piggyback Sync

M3W uses a **Piggyback Sync** architecture: every API call carries sync data bidirectionally, eliminating the need for dedicated sync endpoints or scheduled sync tasks.

**Key Principles**:
1. **No dedicated sync** - Sync happens naturally with every API call
2. **Backend is Source of Truth** - IndexedDB is a cache for offline/performance
3. **First-Push-Wins** - For conflicts, whoever pushes first wins
4. **Operation-Based Merge** - Playlist song order preserved via operation log
5. **Global Delete** - Deletions cascade across all devices

### Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      M3W Piggyback Sync Architecture                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                        Frontend                                 │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                                                                 │ │
│  │   User Action ──────────────────────────────────────────────►  │ │
│  │       │                                                         │ │
│  │       ▼                                                         │ │
│  │   ┌─────────────────┐      ┌─────────────────┐                 │ │
│  │   │  IndexedDB      │◄────►│  API Call       │                 │ │
│  │   │  (cache/offline)│      │  + _sync payload│                 │ │
│  │   └─────────────────┘      └────────┬────────┘                 │ │
│  │                                     │                           │ │
│  └─────────────────────────────────────┼───────────────────────────┘ │
│                                        │                             │
│                    ┌───────────────────┴───────────────────┐        │
│                    │                                       │        │
│                    ▼ Online                                ▼ Offline│
│           ┌────────────────────┐              ┌────────────────────┐│
│           │   Backend API      │              │  OfflineProxy      ││
│           │   (Hono + Prisma)  │              │  (IndexedDB only)  ││
│           └─────────┬──────────┘              └────────────────────┘│
│                     │                                               │
│                     ▼                                               │
│           ┌────────────────────┐                                    │
│           │  PostgreSQL        │                                    │
│           │  (Source of Truth) │                                    │
│           └────────────────────┘                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Sync Protocol

#### Request Format (Every API Call)

```typescript
interface ApiRequestWithSync<T> {
  // Original request payload
  ...payload: T;
  
  // Sync metadata (optional, present when dirty data exists)
  _sync?: {
    dirty?: {
      libraries?: Library[];
      playlists?: Playlist[];
      songs?: Song[];
      operations?: PlaylistOperation[];  // For order changes
      deletions?: {
        libraryIds?: string[];
        playlistIds?: string[];
        songIds?: string[];
      };
    };
  };
}
```

#### Response Format (Every API Response)

```typescript
interface ApiResponseWithSync<T> {
  success: boolean;
  data: T;                    // Requested data (always latest)
  pagination?: {              // For paginated endpoints
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  _sync?: {
    idMappings?: {            // For newly created entities
      localId: string;
      serverId: string;
    }[];
  };
}
```

#### Sync Flow

```
Every API Call:

┌──────────────────────────────────────────────────────────────────┐
│  1. Frontend collects dirty data from IndexedDB                  │
│     - Entities with _isDirty, _isLocalOnly, or _isDeleted       │
│     - Unsynced PlaylistOperations                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. API Request with _sync payload                               │
│     POST /api/playlists                                          │
│     {                                                            │
│       name: "New Playlist",                                      │
│       _sync: {                                                   │
│         dirty: {                                                 │
│           libraries: [{ id: 'local_xxx', name: 'My Lib', ... }] │
│         }                                                        │
│       }                                                          │
│     }                                                            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. Backend processes:                                           │
│     a. Apply dirty changes (First-Push-Wins)                    │
│     b. Process main request                                      │
│     c. Return latest data + ID mappings                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. Frontend receives response:                                  │
│     a. Update local IDs from idMappings                         │
│     b. Cache response.data in IndexedDB                         │
│     c. Clear synced dirty flags                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### Entity Tracking Schema

```typescript
// Sync tracking fields for IndexedDB entities
interface SyncTrackingFields {
  _isDirty?: boolean;       // Has local changes pending sync
  _isDeleted?: boolean;     // Soft deleted, pending server delete
  _isLocalOnly?: boolean;   // Created locally, no server ID yet
}

// Playlist operation log (for order preservation)
interface PlaylistOperation {
  id: string;               // UUID
  playlistId: string;
  type: 'ADD' | 'REMOVE' | 'MOVE';
  songId: string;
  position?: number;        // Target position for ADD/MOVE
  timestamp: number;        // For ordering operations
  synced: boolean;          // Has been sent to server
}
```

### ID Mapping (Local → Server)

When a locally-created entity gets a server ID:

```typescript
async function updateEntityId(
  table: 'libraries' | 'playlists' | 'songs',
  localId: string,
  serverId: string
): Promise<void> {
  await db.transaction('rw', [db.libraries, db.playlists, db.songs, db.playlistSongs], async () => {
    // 1. Update the entity itself
    await db[table].update(localId, { id: serverId });
    
    // 2. Cascade update references
    if (table === 'libraries') {
      await db.songs.where('libraryId').equals(localId)
        .modify({ libraryId: serverId });
    }
    if (table === 'songs') {
      await db.playlistSongs.where('songId').equals(localId)
        .modify({ songId: serverId });
    }
    if (table === 'playlists') {
      await db.playlistSongs.where('playlistId').equals(localId)
        .modify({ playlistId: serverId });
    }
  });
}
```

---

### Data Limits

To keep sync payloads manageable:

| Entity | Limit | Rationale |
|--------|-------|-----------|
| Libraries per user | 50 | Sufficient for most use cases |
| Playlists per user | 50 | Sufficient for most use cases |
| Songs per Library | 1000 | Performance and UX balance |
| Songs per Playlist | 1000 | Performance and UX balance |

---

### Songs Progressive Loading

Songs are loaded progressively using automatic pagination, providing seamless UX even with large libraries.

#### Frontend Implementation

```typescript
function SongList({ libraryId }: { libraryId: string }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });

  useEffect(() => {
    loadAllSongs();
  }, [libraryId]);

  async function loadAllSongs() {
    setLoading(true);
    let page = 1;
    let allSongs: Song[] = [];
    let hasMore = true;

    // Automatic continuous loading with concurrency
    const CONCURRENCY = 3;
    const PAGE_SIZE = 100;

    // First request to get total
    const first = await api.libraries.getSongs(libraryId, { page: 1, pageSize: PAGE_SIZE });
    allSongs = first.data;
    setSongs(allSongs);
    setProgress({ loaded: allSongs.length, total: first.pagination.total });

    const totalPages = Math.ceil(first.pagination.total / PAGE_SIZE);

    // Concurrent loading for remaining pages
    for (let i = 2; i <= totalPages; i += CONCURRENCY) {
      const batch = [];
      for (let j = i; j < i + CONCURRENCY && j <= totalPages; j++) {
        batch.push(api.libraries.getSongs(libraryId, { page: j, pageSize: PAGE_SIZE }));
      }

      const results = await Promise.all(batch);
      results.forEach(r => {
        allSongs = [...allSongs, ...r.data];
      });

      setSongs(allSongs);  // Update UI progressively
      setProgress({ loaded: allSongs.length, total: first.pagination.total });
    }

    setLoading(false);
  }

  return (
    <div>
      {songs.map(song => <SongItem key={song.id} song={song} />)}
      {loading && (
        <div className="text-center text-muted-foreground py-2">
          Loading {progress.loaded} / {progress.total}...
        </div>
      )}
    </div>
  );
}
```

#### User Experience

```
User clicks Library with 850 songs:

0.0s  → Show cached songs (if any) + Loading indicator
0.3s  → Display 1-100 songs (Loading 100/850...)
0.3s  → Concurrent requests for pages 2, 3, 4
0.6s  → Display 1-400 songs (Loading 400/850...)
0.9s  → Display 1-700 songs (Loading 700/850...)
1.1s  → Display all 850 songs ✓

User can scroll and interact with loaded songs immediately.
No manual "Load More" required.
```

#### Backend API

```typescript
// GET /api/libraries/:id/songs?page=1&pageSize=100
interface SongsResponse {
  success: true;
  data: Song[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  _sync?: {
    idMappings?: { localId: string; serverId: string }[];
  };
}
```

---

### Cache Strategy

#### Cache Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Cache Decision Flow                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Should cache library X?                                             │
│                                                                      │
│  1. Was library manually cached?                                     │
│     └─ YES → Cache (user explicit intent)                           │
│                                                                      │
│  2. Is cacheAllEnabled = true? (backend setting, synced)            │
│     └─ NO → Don't auto-cache (default behavior)                     │
│     └─ YES ↓                                                        │
│                                                                      │
│  3. Check Download Timing (frontend setting, local-only):           │
│     ├─ "Manual only" → Don't auto-cache                             │
│     ├─ "WiFi only" → Cache if on WiFi                               │
│     └─ "Always" → Cache immediately                                 │
│                                                                      │
│  4. Cache-on-play (always enabled):                                  │
│     └─ Playing uncached song online → Cache after stream complete   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Settings Storage

| Setting | Storage | Sync | Default |
|---------|---------|------|---------|
| `cacheAllEnabled` | Backend (user prefs) | ✅ Cross-device | `false` |
| `downloadTiming` | Frontend (localStorage) | ❌ Device-local | `"wifi-only"` |
| `libraryCacheStatus[id]` | Frontend (IndexedDB) | ❌ Device-local | `false` |

#### Service Worker Implementation

```typescript
// Audio cache strategy: Cache-first with Range support
const AUDIO_CACHE = 'm3w-audio-v1';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Match: /api/songs/:id/stream OR /guest/songs/:id/stream
  if (url.pathname.match(/\/(api|guest)\/songs\/[^/]+\/stream/)) {
    event.respondWith(handleAudioRequest(event.request));
  }
});

async function handleAudioRequest(request: Request): Promise<Response> {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  
  if (cached) {
    // Handle Range requests from cache
    const range = request.headers.get('Range');
    if (range) {
      return createRangeResponse(cached, range);
    }
    return cached;
  }
  
  // Not cached: fetch from network (will fail if offline)
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache-on-play: store for future offline use
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Network error while offline
    throw new Error('Song not available offline');
  }
}

async function createRangeResponse(cached: Response, range: string): Promise<Response> {
  const blob = await cached.blob();
  const [, start, end] = range.match(/bytes=(\d+)-(\d*)/) || [];
  const startNum = parseInt(start, 10);
  const endNum = end ? parseInt(end, 10) : blob.size - 1;
  
  const slice = blob.slice(startNum, endNum + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      'Content-Range': `bytes ${startNum}-${endNum}/${blob.size}`,
      'Content-Length': String(slice.size),
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
    },
  });
}
```

---

### Offline Mutation Handling

#### Supported Offline Operations

| Operation | Offline Behavior | Sync Flags |
|-----------|------------------|------------|
| Create Library | IndexedDB + local ID | `_isLocalOnly=true` |
| Edit Library | IndexedDB update | `_isDirty=true` |
| Delete Library* | Soft delete | `_isDeleted=true` |
| Create Playlist | IndexedDB + local ID | `_isLocalOnly=true` |
| Edit Playlist | IndexedDB update | `_isDirty=true` |
| Delete Playlist* | Soft delete | `_isDeleted=true` |
| Add to Playlist | IndexedDB update | `_isDirty=true` |
| Remove from Playlist | IndexedDB update | `_isDirty=true` |
| Reorder Playlist | IndexedDB update | `_isDirty=true` |
| Delete Song | Soft delete | `_isDeleted=true` |
| Upload Song | Cache Storage + IndexedDB | `_isLocalOnly=true` |

*Note: Default Library and Favorites Playlist have `canDelete: false` and cannot be deleted.

#### Offline Upload Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Offline Upload Flow                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User selects files for upload (offline)                         │
│                                                                      │
│  2. For each file:                                                   │
│     a. Extract metadata (music-metadata-browser)                    │
│     b. Extract cover art if present                                 │
│     c. Generate local ID: `local_${crypto.randomUUID()}`            │
│     d. Store audio in Cache Storage                                 │
│     e. Store metadata in IndexedDB with sync flags:                 │
│        { ..., _isLocalOnly: true, _isDirty: false }                 │
│                                                                      │
│  3. Song immediately playable locally                               │
│                                                                      │
│  4. When online + sync triggers:                                     │
│     a. Upload audio file to server                                  │
│     b. Server returns { songId, fileHash }                          │
│     c. updateEntityId('songs', localId, songId)                     │
│     d. Clear sync flags                                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Playback: Auto-Skip Uncached Songs

When offline and attempting to play an uncached song:

```typescript
interface AutoSkipState {
  skippedCount: number;
  lastToastTime: number;
}

async function playNext(queue: Song[], currentIndex: number, state: AutoSkipState): Promise<void> {
  const TOAST_DEBOUNCE_MS = 3000;
  
  for (let i = currentIndex + 1; i < queue.length; i++) {
    const song = queue[i];
    const isCached = await isAudioCached(song.id);
    
    if (isCached || navigator.onLine) {
      // Can play this song
      if (state.skippedCount > 0) {
        const now = Date.now();
        if (now - state.lastToastTime > TOAST_DEBOUNCE_MS) {
          toast.info(`Skipped ${state.skippedCount} song(s) (network required)`);
          state.lastToastTime = now;
        }
        state.skippedCount = 0;
      }
      await playSong(song);
      return;
    }
    
    // Song not cached and offline: skip
    state.skippedCount++;
  }
  
  // No playable songs remaining
  if (state.skippedCount > 0) {
    toast.warning(`No cached songs available (${state.skippedCount} skipped)`);
  }
  stopPlayback();
}

async function isAudioCached(songId: string): Promise<boolean> {
  const cache = await caches.open('m3w-audio-v1');
  const cached = await cache.match(`/api/songs/${songId}/stream`);
  return !!cached;
}
```

---

### Pull-to-Refresh Implementation

#### Trigger Conditions

```typescript
interface PullToRefreshConfig {
  threshold: number;        // Minimum pull distance (60px)
  maxPull: number;          // Maximum visual pull (120px)
  resistance: number;       // Pull resistance factor (0.4)
}

function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleTouchStart = (e: TouchEvent) => {
    // Only enable if scrolled to top
    if (containerRef.current?.scrollTop !== 0) return;
    // ... capture start position
  };
  
  const handleTouchMove = (e: TouchEvent) => {
    // Apply resistance and update pullDistance
    // Show visual indicator when pullDistance > threshold
  };
  
  const handleTouchEnd = async () => {
    if (pullDistance > config.threshold) {
      setIsPulling(true);
      try {
        await onRefresh();
      } catch (error) {
        if (!navigator.onLine) {
          toast.error('Network unavailable');
        } else {
          toast.error('Sync failed');
        }
      }
      setIsPulling(false);
    }
    setPullDistance(0);
  };
  
  return { containerRef, isPulling, pullDistance };
}
```

#### Page-Specific Sync Scope

| Page | Pull-to-Refresh | Sync Scope |
|------|-----------------|------------|
| Libraries List | ✅ | All libraries + preferences |
| Library Detail | ✅ | Songs in this library only |
| Playlists List | ✅ | All playlists |
| Playlist Detail | ✅ | Songs + order in this playlist |
| Settings | ❌ | N/A |
| Full Player | ❌ | N/A |

---

### Conflict Resolution Algorithm

```typescript
async function syncEntity<T extends SyncTrackingFields>(
  entity: T,
  table: string,
  serverVersion?: T
): Promise<SyncResult> {
  // PUSH phase
  if (entity._isLocalOnly) {
    const result = await api.post(`/api/${table}`, entity);
    if (result.success) {
      await updateEntityId(table, entity.id, result.data.id);
      return { status: 'created', newId: result.data.id };
    }
    // Conflict: same entity created on another device (rare)
    return { status: 'conflict', resolution: 'pull' };
  }
  
  if (entity._isDeleted) {
    const result = await api.delete(`/api/${table}/${entity.id}`);
    if (result.success || result.status === 404) {
      // 404 = already deleted on server, that's fine
      await db[table].delete(entity.id);
      return { status: 'deleted' };
    }
    return { status: 'conflict', resolution: 'pull' };
  }
  
  if (entity._isDirty) {
    const result = await api.put(`/api/${table}/${entity.id}`, entity);
    if (result.success) {
      return { status: 'updated' };
    }
    if (result.status === 409) {
      // Conflict: modified on another device
      // Server-Wins: discard local, pull server version
      toast.info('Changes synced from another device');
      return { status: 'conflict', resolution: 'pull' };
    }
  }
  
  return { status: 'unchanged' };
}
```

---

### Backend API Design

#### Piggyback Sync Integration

All existing RESTful endpoints remain unchanged but gain sync capabilities:

**Request Enhancement** (all endpoints):
```typescript
// Every request can optionally include dirty data
POST /api/playlists
{
  name: "My Playlist",           // Original payload
  _sync: {                       // Optional sync payload
    dirty: {
      libraries: [...],          // Pending local changes
      playlists: [...],
      songs: [...],
      operations: [...],         // Playlist order operations
      deletions: { ... }
    }
  }
}
```

**Response Enhancement** (all endpoints):
```typescript
// Every response returns latest data + sync metadata
{
  success: true,
  data: { ... },                 // Always latest from server
  pagination: { ... },           // For paginated endpoints
  _sync: {
    idMappings: [                // For newly created entities
      { localId: 'local_xxx', serverId: 'abc123' }
    ]
  }
}
```

#### Delete Semantics (Global Delete)

Deletions propagate across all devices:

```typescript
// DELETE /api/libraries/:id
// Deletes: Library + all Songs in Library + Audio files

// DELETE /api/playlists/:id  
// Deletes: Playlist only (Songs remain in their Libraries)

// DELETE /api/songs/:id
// Deletes: Song + Audio file + removes from all Playlists
```

**Note**: Default Library and Favorites Playlist have `canDelete: false`.

#### Songs Pagination Endpoint

```typescript
// GET /api/libraries/:id/songs?page=1&pageSize=100
{
  success: true,
  data: Song[],
  pagination: {
    page: 1,
    pageSize: 100,
    total: 850,
    hasMore: true
  },
  _sync: {
    idMappings: [...]  // If dirty songs were pushed
  }
}
```

---

#### Conflict Handling in API

All mutating endpoints support First-Push-Wins conflict resolution:

```typescript
// Frontend wrapper for API calls with sync
async function apiCallWithSync<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  payload?: any
): Promise<T> {
  // 1. Collect dirty data from IndexedDB
  const dirtyData = await collectDirtyData();
  
  // 2. Make API call with _sync payload
  const response = await fetch(endpoint, {
    method,
    body: JSON.stringify({
      ...payload,
      ...(dirtyData.hasChanges && { _sync: { dirty: dirtyData } })
    })
  });
  
  const result = await response.json();
  
  // 3. Process sync response
  if (result._sync?.idMappings) {
    for (const { localId, serverId } of result._sync.idMappings) {
      await updateEntityId(localId, serverId);
    }
  }
  
  // 4. Update IndexedDB with server response
  await cacheResponseData(result.data);
  
  // 5. Clear synced dirty flags
  if (dirtyData.hasChanges) {
    await clearDirtyFlags(dirtyData);
  }
  
  return result.data;
}
```

#### User Preferences Endpoint

**GET /api/user/preferences**:

```typescript
// Response
{
  success: true,
  data: {
    shuffle: boolean,
    repeat: 'off' | 'one' | 'all',
    cacheAllEnabled: boolean,
    // Future: language preference
  }
}
```

**PUT /api/user/preferences**:

```typescript
// Request
PUT /api/user/preferences
{
  shuffle: true,
  repeat: 'all',
  cacheAllEnabled: true
}

// Response
{
  success: true,
  data: { ... }
}
```

**Backend Implementation**:

```typescript
// backend/src/routes/user.ts
app.get('/api/user/preferences', async (c) => {
  const userId = c.get('userId');
  
  const prefs = await prisma.userPreferences.findUnique({
    where: { userId }
  });
  
  // Return defaults if not exists
  return c.json({
    success: true,
    data: prefs ?? {
      shuffle: false,
      repeat: 'off',
      cacheAllEnabled: false
    }
  });
});

app.put('/api/user/preferences', async (c) => {
  const userId = c.get('userId');
  const { shuffle, repeat, cacheAllEnabled } = await c.req.json();
  
  const prefs = await prisma.userPreferences.upsert({
    where: { userId },
    update: { shuffle, repeat, cacheAllEnabled },
    create: { userId, shuffle, repeat, cacheAllEnabled }
  });
  
  return c.json({ success: true, data: prefs });
});
```

**Schema for UserPreferences**:

```prisma
model UserPreferences {
  id              String  @id @default(cuid())
  userId          String  @unique
  shuffle         Boolean @default(false)
  repeat          String  @default("off")  // 'off' | 'one' | 'all'
  cacheAllEnabled Boolean @default(false)
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

#### Conflict Detection Summary

| Scenario | Detection Method | Response |
|----------|------------------|----------|
| Update entity | Compare `version` field | 409 with server data |
| Delete entity | Compare `version` in query | 409 if modified |
| Delete already deleted | 404 | Client treats as success |
| Create duplicate | Unique constraint | 409 or merge logic |

#### Client-Side Handling

```typescript
// Frontend: Handle 409 conflict
async function updateLibrary(library: Library): Promise<Library> {
  const result = await api.put(`/api/libraries/${library.id}`, {
    name: library.name,
    version: library.version
  });
  
  if (result.status === 409) {
    // Conflict: server has newer version
    const serverData = result.data.serverData;
    
    // Server-Wins: discard local, use server version
    await db.libraries.put(serverData);
    toast.info('Changes synced from another device');
    
    return serverData;
  }
  
  if (result.success) {
    // Update local with new version
    await db.libraries.put(result.data);
    return result.data;
  }
  
  throw new Error(result.error);
}
```

---

## Issue Mapping

### Epic 8: Unified Offline Sync Architecture (#131)

| Story | Related Issues |
|-------|----------------|
| Story 2.5.1 | #33 (Guest to Auth Migration) |
| Story 2.5.2 | #129 (ID Conflict Resolution) |
| Story 3.3 | #48 (State-based Sync) |
| Story 3.4 | #124 (Cache After Upload) |
| Story 4.1 | #106 (Preferences Sync) |
| Story 4.4 | #106 (Preferences Sync) |

### Other Related Issues

| Story | Related Issues |
|-------|----------------|
| Story 2.3 | #50 (Storage Quota UI), #51 (Cache Management) |
| Story 3.4 | #92 (Cache All Library Setting) |

---

## Acceptance Criteria Summary

### Completed (✅)

| Part | Stories | Status |
|------|---------|--------|
| Part 1 | 1.1 - 1.5 | ✅ All complete |
| Part 2 | 2.1 - 2.2 | ✅ Core complete |

### In Progress (🟡)

| Part | Stories | Blockers |
|------|---------|----------|
| Part 2 | 2.3 | #50, #51 |

### Not Started (❌)

| Part | Stories | Dependencies |
|------|---------|--------------|
| Part 2.5 | 2.5.1, 2.5.2 | #129, #33 |
| Part 3 | 3.1 - 3.4 | #124, Epic 8 design |
| Part 4 | 4.1 - 4.4 | #106, Epic 8 implementation |

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
- Epic 8: https://github.com/test3207/m3w/issues/131

---

**Document Version**: v2.1  
**Last Updated**: 2025-12-10
