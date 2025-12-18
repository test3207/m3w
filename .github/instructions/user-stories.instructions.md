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
│ (no account)│  Full features    │  Full features    │
├─────────────┼───────────────────┼───────────────────┤
│   Auth      │  Part 1: Online   │  Part 3: Offline  │
│(has account)│  Full features    │  READ-ONLY        │
└─────────────┴───────────────────┴───────────────────┘

Transition:
├── Guest → Auth: Part 2.5: Account Binding & Data Migration
```

### Document Structure

| Part | Title | User Type | Focus |
|------|-------|-----------|-------|
| **Part 1** | Online Experience | Auth + Online | Core features (✅ **Complete**) |
| **Part 2** | Guest Mode (Local-Only) | Guest | Pure local player (✅ **Complete**) |
| **Part 2.5** | Guest to Auth Migration | Guest → Auth | Account binding (❌ **Not Started**) |
| **Part 3** | Auth Offline Experience | Auth + Offline | Read-only cache (🟡 **Partial**: cache-on-play works, no UI) |
| **Part 4** | Cross-Device Sync | Auth | Backend is source (✅ **Complete**: no sync needed) |

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

**Viewing Library Songs** (Progressive Loading):
```
1. Enter a Library → Songs start loading automatically
2. First batch (100 songs) appears immediately
3. Remaining songs load in background (3 concurrent requests)
4. Progress shown at bottom: "Loading 300/850..."
5. User can scroll and interact with loaded songs immediately
6. No manual "Load More" button needed
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
- [ ] Progressive loading for large libraries (auto-paginate)

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

**Context**: Authenticated user loses network connection. App degrades to **read-only mode** using cached data.

**Design Decision**: Auth users get read-only offline experience (not full offline editing). This dramatically simplifies the architecture by avoiding complex sync logic.

**Related Issues**: #87 (Epic 5)

### Story 3.1: Offline Detection & UI Feedback

**Goal**: User is clearly informed when offline and understands the read-only limitation.

**Flow**:
```
1. Network disconnects (navigator.onLine = false OR backend unreachable)
2. UI updates:
   - Network indicator changes to "Offline"
   - Toast: "You're offline. Browsing cached data (read-only)."
3. Feature availability:
   ┌─────────────────────────────────────┐
   │ Feature         │ Online │ Offline │
   ├─────────────────────────────────────┤
   │ Play cached     │   ✓    │    ✓    │
   │ Play uncached   │   ✓    │    ✗*   │
   │ Browse library  │   ✓    │    ✓**  │
   │ Browse playlist │   ✓    │    ✓**  │
   │ Create library  │   ✓    │    ✗    │
   │ Create playlist │   ✓    │    ✗    │
   │ Edit playlist   │   ✓    │    ✗    │
   │ Upload songs    │   ✓    │    ✗    │
   │ Delete songs    │   ✓    │    ✗    │
   └─────────────────────────────────────┘
   * Auto-skip to next cached song
   ** Only if metadata cached locally
   All write operations disabled with clear feedback
```

**Write Operation Handling**:
```
When user attempts a write operation while offline:
1. Button/action appears disabled (grayed out)
2. Tooltip: "Connect to internet to make changes"
3. If somehow triggered → Toast: "You're offline. This action requires internet."
4. No data modification occurs
```

**Acceptance Criteria**:
- [x] Network status indicator in UI
- [x] Dual detection: navigator.onLine + backend ping
- [ ] Clear indication of read-only mode
- [ ] All write buttons disabled when offline
- [ ] Helpful tooltip on disabled buttons
- [ ] Toast feedback when write attempted offline

---

### Story 3.2: Offline Playback (Read-Only)

**Goal**: User can play previously cached songs while offline.

**Prerequisite**: Songs must be cached (via cache-on-play or manual download).

**Flow**:
```
1. User is offline
2. Opens a Library or Playlist (from cache)
3. Song list shows:
   - Cached songs: Normal appearance, playable
   - Uncached songs: Dimmed with "cloud" badge
4. Click cached song → Plays from Cache Storage
5. Click uncached song → Toast: "This song isn't downloaded"
   → Auto-skip to next cached song in queue
6. Playback works normally (seek, progress, etc.)
```

**Uncached Song Auto-Skip**:
```
When playing a queue with mixed cached/uncached songs:
1. Player attempts to play next song
2. If uncached and offline → Auto-skip to next cached song
3. Show debounced toast: "Skipped [N] songs (not downloaded)"
4. If no cached songs remaining → Stop playback
```

**Acceptance Criteria**:
- [x] Cached songs playable offline
- [x] Service Worker serves audio from Cache Storage
- [x] Range request support for seeking
- [ ] Visual distinction for cached vs uncached songs
- [ ] Auto-skip uncached songs with toast feedback
- [ ] Graceful handling when no cached songs available

---

### Story 3.3: Cached Data Browsing (Read-Only)

**Goal**: User can browse their libraries and playlists using cached metadata.

**How Caching Works**:
```
When online and user navigates:
1. GET /api/libraries → Response cached to IndexedDB
2. GET /api/playlists → Response cached to IndexedDB
3. GET /api/libraries/:id/songs → Response cached to IndexedDB

When offline:
1. Router detects offline → Routes to IndexedDB cache
2. User sees last-cached data
3. All data is read-only
```

**Flow**:
```
1. User goes offline
2. Opens Libraries tab → Shows cached libraries
3. Opens a Library → Shows cached songs
4. Opens Playlists tab → Shows cached playlists
5. All data reflects last online state
6. No "pull to refresh" (would fail anyway)
7. Banner: "Viewing cached data. Connect to see latest."
```

**Acceptance Criteria**:
- [ ] Libraries list from IndexedDB cache
- [ ] Playlists list from IndexedDB cache
- [ ] Songs list from IndexedDB cache
- [ ] Clear indication that data may be stale
- [ ] No refresh attempts when offline

---

### Story 3.4: Proactive Caching

**Goal**: User controls which content is available offline.

**Caching Mechanisms**:

| Mechanism | Trigger | What's Cached |
|-----------|---------|---------------|
| Cache-on-Play | Play any song | Audio file |
| Cache-on-Navigate | Visit any page | Metadata (libraries, playlists, songs) |
| Manual Download | User clicks "Download" | Entire library's audio files |
| Cache-on-Upload | Upload completes | Audio file (already in memory) |

**Manual Library Download**:
```
1. Open Library detail → More menu (⋮)
2. Click "Download for Offline"
3. Progress indicator shows download status
4. All songs in library cached when complete
5. Library card shows "Downloaded" badge
```

**Settings Page**:
```
Settings → Storage:
┌─────────────────────────────────────┐
│ Offline Storage                     │
├─────────────────────────────────────┤
│ Downloaded: 156 songs (4.2 GB)      │
│                                     │
│ Auto-download:                      │
│   ○ Off (manual only)               │
│   ○ On WiFi only                    │
│   ○ Always                          │
│                                     │
│ [Clear All Cached Audio]            │
└─────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] Cache-on-play for streamed songs
- [ ] Cache-on-upload for newly uploaded songs
- [ ] Manual "Download for Offline" per library
- [ ] Visual indicator for downloaded libraries/songs
- [ ] Auto-download settings (off/wifi/always)
- [ ] Storage management UI

---

## Part 4: Cross-Device Sync

**Context**: Authenticated user uses M3W on multiple devices. Backend is the **single source of truth**.

**Design Decision**: No complex sync protocol. Backend always wins. Each device fetches latest on navigation.

### Story 4.1: Multi-Device Data Consistency

**Goal**: User sees consistent data across all devices.

**How It Works**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    Simple Sync Model                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Device A (Online):                                              │
│    1. User creates playlist "Road Trip"                          │
│    2. POST /api/playlists → Server stores it                    │
│    3. Done. No sync needed.                                      │
│                                                                  │
│  Device B (Online, later):                                       │
│    1. User opens Playlists page                                  │
│    2. GET /api/playlists → Returns all playlists                │
│    3. "Road Trip" appears (fetched fresh from server)           │
│                                                                  │
│  No sync protocol. Just normal REST API calls.                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Insight**: Since Auth offline is read-only, there's never local-only data to sync. Every write goes directly to backend.

**Flow**:
```
1. User logs in on Device B
2. Navigates to Libraries → GET /api/libraries (fresh from server)
3. Clicks a Library → GET /api/libraries/:id/songs (fresh)
4. All data always current (no stale cache issues for writes)
5. IndexedDB updated with latest for offline reading
```

**Acceptance Criteria**:
- [x] All writes go directly to backend
- [x] All reads fetch from backend when online
- [x] No dedicated sync mechanism needed
- [ ] IndexedDB cache updated after each fetch
- [ ] Pull-to-refresh for manual update

---

### Story 4.2: Preferences Sync

**Goal**: User preferences are consistent across devices.

**Synced Preferences** (stored in backend):
| Preference | Synced |
|------------|--------|
| Shuffle mode | ✅ |
| Repeat mode | ✅ |

**Local-Only Settings** (device-specific):
| Setting | Why Local |
|---------|-----------|
| Auto-download (off/wifi/always) | Network varies by device |
| Downloaded libraries | Storage varies by device |
| Language | User may want different per device |

**Flow**:
```
1. User enables shuffle on Phone
2. PUT /api/user/preferences { shuffle: true }
3. User opens app on Tablet
4. GET /api/user/preferences → { shuffle: true }
5. Tablet shows shuffle enabled
```

**Acceptance Criteria**:
- [x] Shuffle/repeat synced via backend
- [ ] Auto-download setting stays local
- [ ] Downloaded content stays local
- [ ] Preferences API endpoint

---

## Technical Architecture

### Core Design: Read-Through Cache with Offline Fallback

M3W uses a simple architecture where **backend is always the source of truth** for Auth users. IndexedDB serves as a read-only cache for offline access.

**Key Principles**:
1. **Backend is Source of Truth** - All writes go directly to backend (Auth users)
2. **IndexedDB is Read Cache** - Stores backend responses for offline access
3. **Guest Mode is Local-Only** - Full IndexedDB CRUD, no backend involvement
4. **No Sync Protocol** - Auth offline is read-only, no dirty tracking needed

### Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    M3W Simplified Architecture                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                        Frontend                                 │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                                                                 │ │
│  │   User Action ──► Router ──┬──► Backend API (Auth + Online)   │ │
│  │                            │     │                              │ │
│  │                            │     ▼                              │ │
│  │                            │   Cache to IndexedDB               │ │
│  │                            │                                    │ │
│  │                            ├──► IndexedDB Read (Auth + Offline)│ │
│  │                            │     (Read-only, cached data)       │ │
│  │                            │                                    │ │
│  │                            └──► OfflineProxy (Guest, any state)│ │
│  │                                  (Full CRUD, local storage)     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Router Layer Design

The frontend Router handles three scenarios:

```typescript
async function routeRequest(endpoint: string, method: string, data?: any) {
  // Scenario 1: Guest user → Always use OfflineProxy (full CRUD)
  if (isGuest()) {
    return offlineProxy.handle(endpoint, method, data);
  }
  
  // Scenario 2: Auth + Online → Use Backend API
  if (isOnline()) {
    const result = await backendApi.call(endpoint, method, data);
    
    // Cache GET responses to IndexedDB for offline access
    if (method === 'GET') {
      await cacheToIndexedDB(endpoint, result.data);
    }
    
    return result;
  }
  
  // Scenario 3: Auth + Offline → Read-only from cache
  if (method !== 'GET') {
    // Block write operations when offline
    throw new OfflineWriteError('You are offline. Connect to make changes.');
  }
  
  return readFromCache(endpoint);
}
```

#### Behavior Matrix

| User Type | Network | Read | Write |
|-----------|---------|------|-------|
| Guest | Any | OfflineProxy (IndexedDB) | OfflineProxy (IndexedDB) |
| Auth | Online | Backend → Cache | Backend |
| Auth | Offline | Cache (IndexedDB) | ❌ Blocked |

---

### OfflineProxy: Shared Read, Guest-Only Write

OfflineProxy is split into read and write operations:

```typescript
// Read operations: Used by both Guest and Auth Offline
const readOperations = {
  getLibraries: () => db.libraries.toArray(),
  getLibrary: (id) => db.libraries.get(id),
  getLibrarySongs: (libraryId) => db.songs.where('libraryId').equals(libraryId).toArray(),
  getPlaylists: () => db.playlists.toArray(),
  getPlaylist: (id) => db.playlists.get(id),
  getPlaylistSongs: (playlistId) => /* ... */,
};

// Write operations: Guest only (Auth users blocked when offline)
const writeOperations = {
  createLibrary: (name) => db.libraries.add({ id: `local_${uuid()}`, name, ... }),
  deleteLibrary: (id) => db.libraries.delete(id),
  createPlaylist: (name) => db.playlists.add({ id: `local_${uuid()}`, name, ... }),
  addSongToPlaylist: (playlistId, songId) => /* ... */,
  // ... other mutations
};

// Combined for Guest mode
export const offlineProxy = {
  ...readOperations,
  ...writeOperations,
};

// Auth Offline only uses read operations
export const offlineReadProxy = readOperations;
```

---

### Caching Strategy

#### When to Cache (Auth Users)

```
Online Navigation:
┌─────────────────────────────────────────────────────────┐
│  User visits page → GET from backend → Cache response   │
│                                                         │
│  Libraries page:   GET /api/libraries → cache           │
│  Library detail:   GET /api/libraries/:id/songs → cache │
│  Playlists page:   GET /api/playlists → cache           │
│  Playlist detail:  GET /api/playlists/:id/songs → cache │
└─────────────────────────────────────────────────────────┘

The cache is always the "last seen online state".
```

#### IndexedDB Schema

```typescript
// Simple cache structure (no sync flags needed for Auth)
interface LibraryCache {
  id: string;
  name: string;
  songCount: number;
  coverUrl?: string;
  // No _isDirty, _isLocalOnly - Auth is read-only offline
}

interface PlaylistCache {
  id: string;
  name: string;
  songIds: string[];
  // No sync tracking
}

interface SongCache {
  id: string;
  libraryId: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  coverUrl?: string;
}
```

#### Audio File Caching

Audio files use Cache Storage API (separate from metadata):

| Trigger | Behavior |
|---------|----------|
| **Cache-on-play** | Stream → Cache after complete |
| **Manual download** | User clicks "Download Library" → Batch cache |
| **Cache-on-upload** | Upload complete → Immediately cache locally |

---

### UI Handling for Offline State

#### Disabling Write Operations

```typescript
function CreatePlaylistButton() {
  const { isGuest, isOnline } = useAuth();
  const canWrite = isGuest || isOnline;
  
  return (
    <Button 
      onClick={canWrite ? handleCreate : undefined}
      disabled={!canWrite}
      title={!canWrite ? 'Connect to internet to create' : undefined}
    >
      <Plus className="h-4 w-4" />
      Create Playlist
    </Button>
  );
}
```

#### Offline Banner

```typescript
function OfflineBanner() {
  const { isOnline, isGuest } = useAuth();
  
  if (isGuest || isOnline) return null;
  
  return (
    <div className="bg-yellow-100 text-yellow-800 px-4 py-2 text-sm">
      You're offline. Viewing cached data (read-only).
    </div>
  );
}
```

---

### Songs Progressive Loading

Songs are loaded progressively using automatic pagination:

```typescript
async function loadAllSongs(libraryId: string) {
  const PAGE_SIZE = 100;
  const CONCURRENCY = 3;
  let allSongs: Song[] = [];
  
  // First request to get total
  const first = await api.libraries.getSongs(libraryId, { page: 1, pageSize: PAGE_SIZE });
  allSongs = first.data;
  
  const totalPages = Math.ceil(first.pagination.total / PAGE_SIZE);
  
  // Concurrent loading for remaining pages
  for (let i = 2; i <= totalPages; i += CONCURRENCY) {
    const batch = Array.from(
      { length: Math.min(CONCURRENCY, totalPages - i + 1) },
      (_, j) => api.libraries.getSongs(libraryId, { page: i + j, pageSize: PAGE_SIZE })
    );
    
    const results = await Promise.all(batch);
    results.forEach(r => allSongs.push(...r.data));
  }
  
  return allSongs;
}
```

---

### Data Limits

| Entity | Limit | Rationale |
|--------|-------|-----------|
| Libraries per user | 50 | Sufficient for most use cases |
| Playlists per user | 50 | Sufficient for most use cases |
| Songs per Library | 1000 | Performance and UX balance |
| Songs per Playlist | 1000 | Performance and UX balance |

---

### Backend API (Unchanged)

The existing RESTful API remains unchanged:

```
GET    /api/libraries              - List all libraries
POST   /api/libraries              - Create library
GET    /api/libraries/:id          - Get library
PUT    /api/libraries/:id          - Update library
DELETE /api/libraries/:id          - Delete library
GET    /api/libraries/:id/songs    - List songs in library

GET    /api/playlists              - List all playlists
POST   /api/playlists              - Create playlist
GET    /api/playlists/:id          - Get playlist
PUT    /api/playlists/:id          - Update playlist
DELETE /api/playlists/:id          - Delete playlist

GET    /api/songs/:id/stream       - Stream audio file
GET    /api/songs/:id/cover        - Get cover image

GET    /api/user/preferences       - Get user preferences
PUT    /api/user/preferences       - Update preferences
```

No changes needed for the simplified offline architecture.

---

## Issue Mapping

### Epic 5: Auth User Offline (#87)

| Story | Description |
|-------|-------------|
| Story 3.1 | Offline detection & UI feedback |
| Story 3.2 | Offline playback (read-only) |
| Story 3.3 | Cached data browsing (read-only) |
| Story 3.4 | Proactive caching |

### Other Related Issues

| Story | Related Issues |
|-------|----------------|
| Story 2.3 | #50 (Storage Quota UI), #51 (Cache Management) |
| Story 2.5.1, 2.5.2 | #33 (Guest to Auth Migration), #129 (ID Mapping) |
| Story 3.4 | #124 (Cache After Upload) |
| Story 4.2 | #106 (Preferences Sync) |

---

## Acceptance Criteria Summary

### Completed (✅)

| Part | Stories | Status |
|------|---------|--------|
| Part 1 | 1.1 - 1.5 | ✅ All complete |
| Part 2 | 2.1 - 2.2 | ✅ Complete |
| Part 4 | 4.1 - 4.2 | ✅ Complete (no sync needed - backend is source) |

### In Progress (🟡)

| Part | Stories | Status |
|------|---------|--------|
| Part 2 | 2.3 | Storage quota UI needed (#50, #51) |
| Part 3 | 3.2 | Cache-on-play works; need offline UI indicators |

### Not Started (❌)

| Part | Stories | Dependencies |
|------|---------|--------------|
| Part 2.5 | 2.5.1, 2.5.2 | #33, #129 (Epic 8) |
| Part 3 | 3.1, 3.3, 3.4 | Offline UI and proactive caching |

---

## Out of Scope (Future Enhancements)

- ❌ Auth offline write operations (full sync)
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
- Epic 5 (Auth Offline): https://github.com/test3207/m3w/issues/87

---

**Document Version**: v3.0  
**Last Updated**: 2025-12-11
