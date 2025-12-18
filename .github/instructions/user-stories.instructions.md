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

**Key Flow**: GitHub OAuth → Backend auto-creates Default Library + Favorites Playlist → Mobile UI with 3-tab nav → Upload with metadata extraction → Play

**Acceptance Criteria**: Default Library/Favorites created, upload pre-selects Library, metadata auto-extracted, mobile-first UI

---

### Story 1.2: Managing Multiple Libraries

**Goal**: User creates and manages multiple music collections

**Key Features**: Create Library → Progressive loading (100/batch, 3 concurrent) → Play from Library → Mini/Full Player

**Acceptance Criteria**: Custom Library names, song count/cover display, play creates linked playlist, progressive loading

---

### Story 1.3: Managing Playlists (Cross-Library)

**Goal**: User creates and manages playlists with songs from different Libraries

**Key Features**: Create Playlist → Add songs from any Library → Show song source → Drag & drop reorder → Sort (date/title/artist/album, Pinyin for Chinese)

**Acceptance Criteria**: Cross-Library playlists, source display, reordering, sorting with Pinyin, Favorites cannot be deleted

---

### Story 1.4: Daily Playback Experience

**Goal**: User opens app and plays music seamlessly

**Key Components**: Bottom Nav (Libraries/Playlists/Settings) → Mini Player (floating, always visible) → Full Player (cover, controls, actions) → Play Queue Drawer (source, reorder, save as playlist)

**Acceptance Criteria**: Mini Player persistence, expand to Full Player, swipe gestures, queue management, resume playback with progress

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

## Technical Summary

- **Auth Online**: Backend is source of truth, IndexedDB caches GET responses
- **Auth Offline**: Read-only from IndexedDB cache, all writes blocked
- **Guest Mode**: Full CRUD in IndexedDB, no backend involved
- **Audio Cache**: Cache Storage API with Range request support
- **Limits**: 50 libraries, 50 playlists, 1000 songs per container

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
