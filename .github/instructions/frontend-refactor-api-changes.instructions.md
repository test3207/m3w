# Frontend Refactor API Changes

## Metadata

**Created**: 2025-11-12  
**Last Updated**: 2025-11-12  
**Status**: Design Phase - Pending Implementation

## Overview

This document specifies the required backend API changes to support the frontend refactor. These changes enable multi-Library management, Playlist ordering, and improved user experience.

---

## Database Schema Changes

### 1. Library Table Updates

**Add `isDefault` and `canDelete` fields**:

```prisma
model Library {
  id          String   @id @default(cuid())
  name        String
  userId      String
  isDefault   Boolean  @default(false)  // ← NEW: Mark default library
  canDelete   Boolean  @default(true)   // ← NEW: Prevent deletion
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  songs       Song[]
  
  @@index([userId])
  @@index([userId, isDefault])
}
```

**Migration Notes**:
- Existing Libraries should have `isDefault = false`, `canDelete = true`
- First-time users: Auto-create one Library with `isDefault = true`, `canDelete = false`, `name = "默认音乐库"`

---

### 2. Playlist Table Updates

**Add `isDefault`, `canDelete`, and `songIds` fields**:

```prisma
model Playlist {
  id          String   @id @default(cuid())
  name        String
  userId      String
  songIds     String[] @default([])       // ← NEW: Maintain song order
  isDefault   Boolean  @default(false)    // ← NEW: Mark favorites playlist
  canDelete   Boolean  @default(true)     // ← NEW: Prevent deletion
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([userId, isDefault])
}
```

**Key Changes**:
- Remove `PlaylistSong` join table (replaced by `songIds` array)
- `songIds` array maintains order: `["song1-id", "song2-id", "song3-id"]`
- Frontend handles reordering by updating this array

**Migration Notes**:
- Migrate existing `PlaylistSong` data to `songIds` array
- First-time users: Auto-create one Playlist with `isDefault = true`, `canDelete = false`, `name = "我喜欢的音乐"`

---

### 3. Song Table (No Changes Required)

Current schema is sufficient:

```prisma
model Song {
  id          String   @id @default(cuid())
  title       String
  artist      String
  album       String?
  duration    Int?
  libraryId   String
  fileId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  library     Library  @relation(fields: [libraryId], references: [id], onDelete: Cascade)
  file        File     @relation(fields: [fileId], references: [id])
  
  @@index([libraryId])
  @@index([fileId])
}
```

**Note**: Same song file can exist in multiple Libraries (different `Song` records, same `fileId`)

---

## API Endpoint Changes

### 1. Library API

#### **GET /api/libraries**
**No changes required**

Response:
```typescript
{
  success: true,
  data: [
    {
      id: "lib-123",
      name: "默认音乐库",
      userId: "user-456",
      songCount: 234,
      coverUrl: "https://...", // Last added song's cover
      isDefault: true,
      canDelete: false,
      createdAt: "2025-11-12T10:00:00Z",
      updatedAt: "2025-11-12T10:00:00Z"
    },
    {
      id: "lib-789",
      name: "工作音乐",
      userId: "user-456",
      songCount: 56,
      coverUrl: "https://...",
      isDefault: false,
      canDelete: true,
      createdAt: "2025-11-12T11:00:00Z",
      updatedAt: "2025-11-12T11:00:00Z"
    }
  ]
}
```

**Changes**:
- ✅ Add `isDefault` field
- ✅ Add `canDelete` field
- ✅ Add `coverUrl` (last added song's album cover URL)

---

#### **POST /api/libraries**
**No changes required**

Request:
```typescript
{
  name: "健身音乐"
}
```

Response:
```typescript
{
  success: true,
  data: {
    id: "lib-999",
    name: "健身音乐",
    userId: "user-456",
    songCount: 0,
    coverUrl: null,
    isDefault: false,
    canDelete: true,
    createdAt: "2025-11-12T12:00:00Z",
    updatedAt: "2025-11-12T12:00:00Z"
  }
}
```

---

#### **DELETE /api/libraries/:id**
**Add deletion protection**

Response (if trying to delete default Library):
```typescript
{
  success: false,
  message: "默认音乐库不能删除",
  error: "CANNOT_DELETE_DEFAULT_LIBRARY"
}
```

**Changes**:
- ✅ Check `canDelete` field before deletion
- ✅ Return specific error for default Library

---

#### **GET /api/libraries/:id/songs**
**Add sorting support**

Request Query Params:
```typescript
?sort=date-desc        // Default: newest first
?sort=date-asc         // Oldest first
?sort=title-asc        // Title A-Z (Pinyin for Chinese)
?sort=title-desc       // Title Z-A
?sort=artist-asc       // Artist A-Z
?sort=album-asc        // Album A-Z
```

Response:
```typescript
{
  success: true,
  data: [
    {
      id: "song-123",
      title: "Song Title",
      artist: "Artist Name",
      album: "Album Name",
      duration: 245,
      coverUrl: "https://...",
      streamUrl: "/api/songs/song-123/stream",
      libraryId: "lib-123",
      createdAt: "2025-11-12T10:00:00Z",
      updatedAt: "2025-11-12T10:00:00Z"
    },
    // ... more songs
  ]
}
```

**Changes**:
- ✅ Add `sort` query parameter support
- ✅ Implement Pinyin sorting for Chinese characters (use `node-pinyin` or similar)
- ✅ Default sort: `date-desc`

---

### 2. Playlist API

#### **GET /api/playlists**
**Add default and delete flags**

Response:
```typescript
{
  success: true,
  data: [
    {
      id: "playlist-123",
      name: "我喜欢的音乐",
      userId: "user-456",
      songCount: 12,
      coverUrl: "https://...", // Cover from first 4 songs
      isDefault: true,
      canDelete: false,
      createdAt: "2025-11-12T10:00:00Z",
      updatedAt: "2025-11-12T10:00:00Z"
    },
    {
      id: "playlist-789",
      name: "深夜驾车",
      userId: "user-456",
      songCount: 23,
      coverUrl: "https://...",
      isDefault: false,
      canDelete: true,
      createdAt: "2025-11-12T11:00:00Z",
      updatedAt: "2025-11-12T11:00:00Z"
    }
  ]
}
```

**Changes**:
- ✅ Add `isDefault` field
- ✅ Add `canDelete` field
- ✅ Add `coverUrl` (composite from first 4 songs, or null if empty)

---

#### **GET /api/playlists/:id**
**Return songs in user-defined order**

Response:
```typescript
{
  success: true,
  data: {
    id: "playlist-789",
    name: "深夜驾车",
    userId: "user-456",
    songCount: 23,
    coverUrl: "https://...",
    isDefault: false,
    canDelete: true,
    createdAt: "2025-11-12T11:00:00Z",
    updatedAt: "2025-11-12T12:00:00Z",
    songs: [
      {
        id: "song-123",
        title: "Song 1",
        artist: "Artist 1",
        album: "Album 1",
        duration: 245,
        coverUrl: "https://...",
        streamUrl: "/api/songs/song-123/stream",
        libraryId: "lib-456",
        libraryName: "工作音乐",
        createdAt: "2025-11-12T10:00:00Z"
      },
      {
        id: "song-456",
        title: "Song 2",
        artist: "Artist 2",
        album: "Album 2",
        duration: 312,
        coverUrl: "https://...",
        streamUrl: "/api/songs/song-456/stream",
        libraryId: "lib-123",
        libraryName: "默认音乐库",
        createdAt: "2025-11-12T09:00:00Z"
      }
      // ... more songs in order
    ]
  }
}
```

**Changes**:
- ✅ Songs returned in order defined by `songIds` array
- ✅ Include `libraryId` and `libraryName` for each song

---

#### **POST /api/playlists/:id/songs**
**Add song to Playlist**

Request:
```typescript
{
  songId: "song-789"
}
```

Response:
```typescript
{
  success: true,
  data: {
    playlistId: "playlist-789",
    songId: "song-789",
    newSongCount: 24
  }
}
```

**Logic**:
- Append `songId` to `songIds` array
- Update `updatedAt` timestamp

---

#### **DELETE /api/playlists/:id/songs/:songId**
**Remove song from Playlist**

Response:
```typescript
{
  success: true,
  data: {
    playlistId: "playlist-789",
    songId: "song-789",
    newSongCount: 22
  }
}
```

**Logic**:
- Remove `songId` from `songIds` array
- Update `updatedAt` timestamp

---

#### **PUT /api/playlists/:id/songs/reorder**
**NEW ENDPOINT: Reorder songs in Playlist**

Request:
```typescript
{
  songIds: ["song-2", "song-1", "song-3", "song-5", "song-4"]
}
```

Response:
```typescript
{
  success: true,
  data: {
    playlistId: "playlist-789",
    songCount: 5,
    updatedAt: "2025-11-12T13:00:00Z"
  }
}
```

**Logic**:
- Replace entire `songIds` array with new order
- Validate all `songIds` exist and belong to user's songs
- Update `updatedAt` timestamp

---

#### **DELETE /api/playlists/:id**
**Add deletion protection**

Response (if trying to delete default Playlist):
```typescript
{
  success: false,
  message: "默认播放列表不能删除",
  error: "CANNOT_DELETE_DEFAULT_PLAYLIST"
}
```

**Changes**:
- ✅ Check `canDelete` field before deletion
- ✅ Return specific error for default Playlist

---

### 3. Upload API

#### **POST /api/upload**
**No changes required**

Request (FormData):
```typescript
{
  file: File,
  libraryId: "lib-789"  // ← Already exists, just ensure it's validated
}
```

Response:
```typescript
{
  success: true,
  data: {
    songId: "song-999",
    title: "New Song",
    artist: "Artist Name",
    album: "Album Name",
    duration: 234,
    libraryId: "lib-789"
  }
}
```

**Validation**:
- ✅ `libraryId` is required
- ✅ `libraryId` must belong to authenticated user
- ✅ Extract Metadata from file (ID3 tags)

---

### 4. Song API

#### **GET /api/songs/search**
**NEW ENDPOINT: Search songs across Libraries**

Request Query Params:
```typescript
?q=关键词                    // Search query
?libraryId=lib-123           // Optional: Filter by Library
?sort=date-desc              // Optional: Sort option
```

Response:
```typescript
{
  success: true,
  data: [
    {
      id: "song-123",
      title: "Song Title",
      artist: "Artist Name",
      album: "Album Name",
      duration: 245,
      coverUrl: "https://...",
      streamUrl: "/api/songs/song-123/stream",
      libraryId: "lib-456",
      libraryName: "工作音乐",
      createdAt: "2025-11-12T10:00:00Z"
    },
    // ... more matching songs
  ]
}
```

**Logic**:
- Search in `title`, `artist`, `album` fields (case-insensitive)
- If `libraryId` provided, filter by that Library
- Otherwise, search all user's Libraries
- Support Pinyin matching for Chinese characters

---

## Authentication Helpers

### Auto-Create Default Resources

**On First Sign-In** (in GitHub OAuth callback):

```typescript
async function handleFirstTimeUser(userId: string) {
  // 1. Create Default Library
  const defaultLibrary = await prisma.library.create({
    data: {
      name: "默认音乐库",
      userId: userId,
      isDefault: true,
      canDelete: false,
    },
  });

  // 2. Create Favorites Playlist
  const favoritesPlaylist = await prisma.playlist.create({
    data: {
      name: "我喜欢的音乐",
      userId: userId,
      songIds: [],
      isDefault: true,
      canDelete: false,
    },
  });

  return { defaultLibrary, favoritesPlaylist };
}
```

**Check**:
- Run this logic if `user.libraries.length === 0`
- Ensure only one default Library and one default Playlist per user

---

## Pinyin Sorting Implementation

### Backend (Node.js)

**Install dependency**:
```bash
npm install pinyin
```

**Usage**:
```typescript
import pinyin from 'pinyin';

function sortByPinyin(songs: Song[], field: 'title' | 'artist' | 'album'): Song[] {
  return songs.sort((a, b) => {
    const aText = a[field] || '';
    const bText = b[field] || '';
    
    const aPinyin = pinyin(aText, { style: pinyin.STYLE_NORMAL }).flat().join('');
    const bPinyin = pinyin(bText, { style: pinyin.STYLE_NORMAL }).flat().join('');
    
    return aPinyin.localeCompare(bPinyin);
  });
}

// Example: Sort songs by title
const sortedSongs = sortByPinyin(songs, 'title');
```

**Note**: This handles both Chinese (converted to Pinyin) and English (unchanged)

---

## Migration Checklist

### Database Migrations

- [ ] Add `isDefault` and `canDelete` to `Library` table
- [ ] Add `isDefault`, `canDelete`, and `songIds` to `Playlist` table
- [ ] Migrate existing `PlaylistSong` join table data to `songIds` array
- [ ] Set all existing Libraries/Playlists: `isDefault = false`, `canDelete = true`

### API Updates

- [ ] Library: Add `isDefault`, `canDelete`, `coverUrl` fields to responses
- [ ] Library: Add deletion protection for default Library
- [ ] Library: Add `sort` query parameter to `GET /api/libraries/:id/songs`
- [ ] Library: Implement Pinyin sorting
- [ ] Playlist: Add `isDefault`, `canDelete`, `coverUrl` fields to responses
- [ ] Playlist: Return songs in `songIds` order
- [ ] Playlist: Add `POST /api/playlists/:id/songs` (add song)
- [ ] Playlist: Add `DELETE /api/playlists/:id/songs/:songId` (remove song)
- [ ] Playlist: Add `PUT /api/playlists/:id/songs/reorder` (reorder songs)
- [ ] Playlist: Add deletion protection for default Playlist
- [ ] Song: Add `GET /api/songs/search` (cross-Library search)
- [ ] Upload: Validate `libraryId` belongs to user

### Auth Flow

- [ ] Auto-create default Library on first sign-in
- [ ] Auto-create favorites Playlist on first sign-in
- [ ] Check if user has no Libraries before creating defaults

### Testing

- [ ] Test default Library creation
- [ ] Test default Playlist creation
- [ ] Test deletion protection for defaults
- [ ] Test Pinyin sorting with Chinese songs
- [ ] Test song reordering in Playlists
- [ ] Test cross-Library song search
- [ ] Test same song in multiple Libraries

---

## Error Codes

| Code | Message | Scenario |
|------|---------|----------|
| `CANNOT_DELETE_DEFAULT_LIBRARY` | 默认音乐库不能删除 | Attempting to delete default Library |
| `CANNOT_DELETE_DEFAULT_PLAYLIST` | 默认播放列表不能删除 | Attempting to delete favorites Playlist |
| `LIBRARY_NOT_FOUND` | 音乐库不存在 | Invalid Library ID |
| `PLAYLIST_NOT_FOUND` | 播放列表不存在 | Invalid Playlist ID |
| `SONG_NOT_FOUND` | 歌曲不存在 | Invalid Song ID |
| `UNAUTHORIZED_LIBRARY_ACCESS` | 无权访问此音乐库 | Library doesn't belong to user |
| `UNAUTHORIZED_PLAYLIST_ACCESS` | 无权访问此播放列表 | Playlist doesn't belong to user |
| `INVALID_SONG_ORDER` | 歌曲顺序无效 | `songIds` array contains invalid IDs |
| `UPLOAD_REQUIRES_LIBRARY` | 上传需要指定音乐库 | Missing `libraryId` in upload |

---

## References

- User Stories: `.github/instructions/frontend-refactor-user-stories.instructions.md`
- Current API implementation: `backend/src/routes/`
- Database schema: `backend/prisma/schema.prisma`

---

**Document Version**: v1.0  
**Last Updated**: 2025-11-12
