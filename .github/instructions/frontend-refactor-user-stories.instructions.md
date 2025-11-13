# Frontend Refactor User Stories

## Metadata

**Created**: 2025-11-12  
**Last Updated**: 2025-11-12  
**Status**: Design Phase - Ready for Implementation

## Overview

This document defines the user stories and design decisions for the M3W frontend refactor. The goal is to create a mobile-first music player experience with intuitive navigation and clear separation between Libraries (music collections) and Playlists (playback queues).

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

## User Stories (Mobile-First)

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

4. User sees onboarding guide: "上传你的第一首歌到音乐库"
5. Click bottom Tab "音乐库" → See "默认音乐库" card
6. Click Library card → Empty state + "上传歌曲" button
7. Click upload → Upload drawer appears (Library pre-selected)
8. Select files → Auto-extract Metadata → Upload
9. Upload complete → Song appears in Library
10. Click song → Start playing (auto-generate temporary Playlist = all songs in Library)
```

**Acceptance Criteria**:
- [ ] Default Library auto-created on first sign-in
- [ ] Default Library cannot be deleted (UI shows disabled state)
- [ ] Favorites Playlist auto-created
- [ ] Upload flow pre-selects current Library
- [ ] Metadata auto-extracted and displayed for editing
- [ ] Playing from Library creates temporary queue

---

### Story 2: Managing Multiple Libraries

**Goal**: User creates and manages multiple music collections

**Flow**:

**Creating New Library**:
```
1. In "音乐库" Tab → Click top "+" button
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
2. Click "播放全部" → Auto-generate temporary Playlist (all songs in Library)
3. Or click single song → Play from that song, queue = all Library songs (starting from clicked song)
4. In "正在播放" page → Show "当前播放自：工作音乐"
```

**Duplicate Songs Across Libraries** (By Design):
```
1. Same song file can exist in multiple Libraries
2. Example: "Song A" in both "默认音乐库" and "工作音乐"
3. When playing, shows source Library
4. File storage: Deduplicated by hash (backend handles this)
```

**Acceptance Criteria**:
- [ ] Create new Library with custom name
- [ ] Library list shows song count
- [ ] Library cover = last added song's album cover
- [ ] Play from Library generates temporary queue
- [ ] Queue shows source Library name
- [ ] Same song can exist in multiple Libraries

---

### Story 3: Managing Playlists (Cross-Library)

**Goal**: User creates and manages playlists with songs from different Libraries

**Flow**:

**Creating Playlist**:
```
1. In "播放列表" Tab → Click "创建新播放列表"
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

Method 2 - From Now Playing:
```
1. In "正在播放" page → Click "添加到播放列表" button
2. Select Playlist
```

Method 3 - Search in Playlist:
```
1. Enter Playlist detail → Click "添加歌曲"
2. Search all songs across all Libraries
3. Filter by Library (optional)
4. Check songs → Add
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

**Sorting Options**:
```
In Library or Playlist detail → Click sort button:
- 添加时间 (默认) - Date added (newest first)
- 标题 A-Z - Title ascending (Pinyin for Chinese)
- 标题 Z-A - Title descending
- 歌手 A-Z - Artist ascending
- 专辑 A-Z - Album ascending
```

**Acceptance Criteria**:
- [ ] Create custom Playlists
- [ ] Add songs from any Library to any Playlist
- [ ] Playlist shows song source Library
- [ ] Drag & drop reordering in Playlist
- [ ] Sort by multiple criteria (date, title, artist, album)
- [ ] Chinese song titles sorted by Pinyin
- [ ] "我喜欢的音乐" Playlist cannot be deleted

---

### Story 4: Daily Playback Experience

**Goal**: User opens app and plays music seamlessly

**Flow**:
```
1. Open app → Auto-enter "正在播放" Tab
   - If previous playback exists → Show last played song (paused state)
   - If no history → Show empty state + quick actions

2. In "正在播放" page:

   Mini Player (bottom bar, always visible):
     ┌─────────────────────────────────────┐
     │ [Cover] Song - Artist    [▶] [→]  │
     │ ▬▬▬▬▬●▬▬▬▬▬▬▬ 2:15 / 4:30         │
     └─────────────────────────────────────┘
     - Click to expand → Full Player
     - Visible on all pages (except Welcome, SignIn)

   Full Player (tap to expand):
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
     - Swipe down to bottom → Close full screen

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
   - Drag to reorder
   - Delete from queue
   - Bottom buttons: "清空队列" "保存为播放列表"
```

**Acceptance Criteria**:
- [ ] Mini Player always visible (except public pages)
- [ ] Tap to expand Full Player
- [ ] Full Player shows detailed song info
- [ ] Swipe gestures work smoothly
- [ ] Play Queue shows source (Library/Playlist)
- [ ] Save current queue as new Playlist
- [ ] Resume last playback on app reopen

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

**Upload from Global FAB (Floating Action Button)**:
```
1. On any page → Click global "+" FAB (bottom-right)
2. Upload drawer appears
3. Select target Library (dropdown selector)
4. Rest of flow same as above
```

**Upload Drawer UI**:
```
┌─────────────────────────────────────┐
│ 上传歌曲                    [关闭]  │
├─────────────────────────────────────┤
│ 选择音乐库                           │
│ [ 工作音乐 ▼ ]                      │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │   点击选择文件或拖拽到此处       │ │
│ │   支持：MP3, FLAC, WAV, AAC     │ │
│ └─────────────────────────────────┘ │
│                                      │
│ 已选择文件：                         │
│ ┌─────────────────────────────────┐ │
│ │ song1.mp3  [编辑] [删除]        │ │
│ │ 标题：Song 1                     │ │
│ │ 歌手：Artist 1                   │ │
│ │ 专辑：Album 1                    │ │
│ │ ▬▬▬▬▬▬▬●▬▬▬▬ 45%               │ │
│ └─────────────────────────────────┘ │
│                                      │
│ [开始上传]                           │
└─────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] Upload must specify target Library
- [ ] Multi-file upload supported
- [ ] Metadata auto-extracted from files
- [ ] User can edit Metadata before upload
- [ ] Upload progress displayed
- [ ] Background upload (can close drawer)
- [ ] Auto-refresh Library after upload

---

## Key Data Flows

### 1. Playing from Library → Temporary Queue

```typescript
// User clicks "播放全部" in Library detail
const playLibrary = async (libraryId: string) => {
  // 1. Fetch all songs in Library
  const songs = await api.libraries.getSongs(libraryId);
  
  // 2. Create temporary playback queue
  playerStore.setQueue(songs, 0); // Start from first song
  playerStore.setQueueSource('library', libraryId);
  
  // 3. Start playback
  playerStore.play();
};

// User clicks a specific song in Library
const playSongFromLibrary = async (libraryId: string, songId: string) => {
  // 1. Fetch all songs in Library
  const songs = await api.libraries.getSongs(libraryId);
  
  // 2. Find clicked song's index
  const startIndex = songs.findIndex(s => s.id === songId);
  
  // 3. Set queue (start from clicked song)
  playerStore.setQueue(songs, startIndex);
  playerStore.setQueueSource('library', libraryId);
  
  // 4. Play
  playerStore.play();
};
```

### 2. Playlist vs Temporary Queue

```typescript
// Playlist (Persistent)
interface Playlist {
  id: string;
  name: string;
  songIds: string[]; // Order maintained by frontend
  isDefault: boolean; // true for "我喜欢的音乐"
  canDelete: boolean; // false for default
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Current Play Queue (Temporary)
interface PlayerQueue {
  songs: Song[];
  currentIndex: number;
  source: 'library' | 'playlist' | 'all';
  sourceId: string | null; // Library ID or Playlist ID
  sourceName: string | null; // Display name
}

// Save current queue as Playlist
const saveQueueAsPlaylist = async (name: string) => {
  const { queue } = playerStore;
  
  await playlistStore.createPlaylist({
    name,
    songIds: queue.map(s => s.id),
  });
  
  toast.success(`已保存为播放列表：${name}`);
};
```

### 3. Sorting Logic

```typescript
// Sort options
type SortOption = 
  | 'date-desc'      // 添加时间 (newest first) - DEFAULT
  | 'date-asc'       // 添加时间 (oldest first)
  | 'title-asc'      // 标题 A-Z (Pinyin for Chinese)
  | 'title-desc'     // 标题 Z-A
  | 'artist-asc'     // 歌手 A-Z
  | 'album-asc';     // 专辑 A-Z

// Pinyin sorting for Chinese
import pinyin from 'pinyin';

const sortSongs = (songs: Song[], option: SortOption): Song[] => {
  const sorted = [...songs];
  
  switch (option) {
    case 'title-asc':
      return sorted.sort((a, b) => {
        const aTitle = getPinyinSort(a.title);
        const bTitle = getPinyinSort(b.title);
        return aTitle.localeCompare(bTitle);
      });
    
    case 'title-desc':
      return sorted.sort((a, b) => {
        const aTitle = getPinyinSort(a.title);
        const bTitle = getPinyinSort(b.title);
        return bTitle.localeCompare(aTitle);
      });
    
    case 'artist-asc':
      return sorted.sort((a, b) => {
        const aArtist = getPinyinSort(a.artist);
        const bArtist = getPinyinSort(b.artist);
        return aArtist.localeCompare(bArtist);
      });
    
    case 'date-desc':
    default:
      return sorted.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
};

const getPinyinSort = (text: string): string => {
  // Convert Chinese to Pinyin for sorting
  const pinyinArray = pinyin(text, { style: pinyin.STYLE_NORMAL });
  return pinyinArray.flat().join('').toLowerCase();
};
```

---

## Design Decisions Summary

| Topic | Decision | Rationale |
|-------|----------|-----------|
| **Default Library** | Auto-created, named "默认音乐库", cannot be deleted | Ensures users always have a place to store music |
| **Default Playlist** | Auto-created, named "我喜欢的音乐", cannot be deleted | Common use case, saves setup time |
| **Library Cover** | Last added song's album cover | Simple, no extra upload needed |
| **Duplicate Songs** | Allowed across Libraries | Supports use case: shared + private collections |
| **Song Info Source** | File Metadata only (ID3 tags) | Keep it simple, no external dependencies |
| **Playlist Ordering** | Frontend maintains order array | Simple implementation, no backend complexity |
| **Sorting** | Multiple options + Pinyin for Chinese | User preference, proper Chinese support |
| **Upload Target** | Must select Library | Clear ownership, organized storage |

---

## Out of Scope (Future Enhancements)

- ❌ Library sharing with other users
- ❌ External metadata API integration (Last.fm, MusicBrainz)
- ❌ Smart playlists (auto-generated based on criteria)
- ❌ Lyrics integration
- ❌ Audio equalizer
- ❌ Social features (comments, likes)
- ❌ Collaborative playlists

---

## References

- Main project context: `.github/instructions/project-context.instructions.md`
- API changes documentation: `.github/instructions/frontend-refactor-api-changes.instructions.md`
- Development standards: `.github/instructions/development-standards.instructions.md`

---

**Document Version**: v1.0  
**Last Updated**: 2025-11-12
