# Frontend Refactor Integration Testing Checklist

## Completed Implementation Summary

### ✅ Completed Tasks (8/9)

1. **Architecture Plan** - Mobile-first design documented
2. **Backend API Updates** - All API routes support new requirements
3. **State Management** - Zustand stores created (library, playlist, player, ui)
4. **Mobile Layout Foundation** - BottomNav, MobileLayout, MiniPlayer, FAB
5. **NowPlayingPage** - FullPlayer and PlayQueueDrawer
6. **Libraries Pages** - Mobile-first LibrariesPage and LibraryDetailPage
7. **Playlists Pages** - Mobile-first PlaylistsPage and PlaylistDetailPage
8. **Upload Drawer** - Sheet drawer with library selection

---

## Integration Testing Checklist

### 1. Authentication Flow

- [ ] User can sign in via GitHub OAuth
- [ ] Token refresh happens automatically (check console logs)
- [ ] Default Library "默认音乐库" is auto-created on first sign-in
- [ ] Default Playlist "我喜欢的音乐" is auto-created on first sign-in
- [ ] Session persists across page refresh

### 2. Library Management

- [ ] Libraries page shows list of libraries with cover and song count
- [ ] Can create new library via Dialog
- [ ] Can click library card to view songs
- [ ] Library detail shows song list
- [ ] Can sort songs by 6 options (date, title, artist, album)
- [ ] Cannot delete default library (button disabled or shows error)
- [ ] Can delete non-default libraries

### 3. Upload Flow

- [ ] Click FAB (+ button) opens upload drawer
- [ ] Upload drawer shows library selection dropdown
- [ ] Default library is pre-selected
- [ ] Can select files (single or multiple)
- [ ] Metadata is auto-extracted and displayed
- [ ] Upload shows progress bar
- [ ] Upload success refreshes library list
- [ ] Can close drawer while upload is in background
- [ ] After upload, song appears in selected library

### 4. Playback from Library

- [ ] Click "播放全部" in library detail starts playback
- [ ] Click single song plays from that song
- [ ] Queue is generated with all library songs
- [ ] MiniPlayer shows at bottom with song info
- [ ] Queue source shows "来自：[Library Name]"
- [ ] Can tap MiniPlayer to open FullPlayer

### 5. Full Player

- [ ] FullPlayer shows album cover (or placeholder)
- [ ] Shows song title, artist, album
- [ ] Progress bar updates in real-time
- [ ] Can seek by tapping progress bar
- [ ] Previous/Next buttons work
- [ ] Play/Pause toggles correctly
- [ ] Shuffle button toggles shuffle mode
- [ ] Repeat button cycles: off → all → one → off
- [ ] Can swipe down (or click X) to close to MiniPlayer

### 6. Play Queue Drawer

- [ ] Swipe up from FullPlayer opens queue drawer
- [ ] Shows list of songs in queue
- [ ] Current song is highlighted
- [ ] Shows queue source (library or playlist name)
- [ ] Can tap song to switch playback
- [ ] Can remove songs from queue
- [ ] Can clear entire queue
- [ ] Can save queue as new playlist (inline input)

### 7. Playlist Management

- [ ] Playlists page shows list with cover and song count
- [ ] Can create new playlist via Dialog
- [ ] Click playlist card to view songs
- [ ] Playlist detail shows song list with library badges
- [ ] Cannot delete "我喜欢的音乐" playlist
- [ ] Can delete non-default playlists

### 8. Playlist Song Management

- [ ] Can move songs up/down with ChevronUp/Down buttons
- [ ] Song order persists after reordering
- [ ] Can remove song from playlist (X button)
- [ ] Removed song disappears from list
- [ ] Song removal doesn't delete from library

### 9. Playback from Playlist

- [ ] Click "播放全部" in playlist detail starts playback
- [ ] Queue contains only songs from that playlist
- [ ] Queue respects user-defined playlist order
- [ ] Queue source shows "来自：[Playlist Name]"
- [ ] Adding songs to playlist works (future feature - not in scope)

### 10. Mobile Navigation

- [ ] BottomNavigation shows 4 tabs: Now Playing, Libraries, Playlists, Settings
- [ ] Active tab is highlighted
- [ ] Can switch between tabs
- [ ] MiniPlayer floats above bottom nav (when song is playing)
- [ ] FAB floats above bottom nav
- [ ] Tapping FAB opens upload drawer

### 11. Responsive Design

- [ ] Layout works on mobile (320px - 640px)
- [ ] Layout works on tablet (640px - 1024px)
- [ ] Layout works on desktop (1024px+)
- [ ] All cards use responsive grid (1/2/3 columns)
- [ ] Text truncates properly when space is limited

### 12. Type Safety

- [ ] No TypeScript errors in console
- [ ] All API responses match expected types
- [ ] Song type conversion (shared → frontend) works correctly
- [ ] No runtime type errors

### 13. Error Handling

- [ ] Network errors show toast notifications
- [ ] Unauthorized (401) redirects to sign-in
- [ ] Not found (404) errors handled gracefully
- [ ] Upload errors show specific messages
- [ ] Playback errors handled (missing files, etc.)

### 14. State Management

- [ ] libraryStore updates when libraries change
- [ ] playlistStore updates when playlists change
- [ ] playerStore tracks queue and playback state
- [ ] uiStore manages drawer states (upload, queue, full player)
- [ ] State persists correctly across page navigation

### 15. Offline Features (Future Enhancement)

- ⏸️ Service Worker caches audio files (PWA integration exists but not tested)
- ⏸️ IndexedDB stores offline data
- ⏸️ Offline indicator shows network status
- ⏸️ Playback works offline for cached songs

---

## Testing Instructions

### Manual Testing Steps

1. **Fresh Start**

   ```bash
   # Clear browser data (localStorage, IndexedDB, cookies)
   # Sign out if logged in
   ```

2. **Sign In**
   - Navigate to `/`
   - Click "Sign In with GitHub"
   - Complete OAuth flow
   - Verify redirect to `/now-playing`

3. **Check Default Resources**
   - Go to `/libraries`
   - Verify "默认音乐库" exists with `isDefault` badge
   - Go to `/playlists`
   - Verify "我喜欢的音乐" exists with `isDefault` badge

4. **Upload First Song**
   - Click FAB (+)
   - Verify upload drawer opens
   - Select default library (should be pre-selected)
   - Choose audio file
   - Wait for upload to complete
   - Close drawer
   - Go to `/libraries` → "默认音乐库"
   - Verify song appears

5. **Test Playback**
   - In library detail, click song
   - Verify MiniPlayer appears
   - Click MiniPlayer to expand FullPlayer
   - Test all controls (play/pause, prev/next, shuffle, repeat, seek)
   - Open queue drawer
   - Verify queue shows correct songs

6. **Create and Manage Playlist**
   - Go to `/playlists`
   - Create new playlist
   - Go to playlist detail (empty state)
   - (Manual note: Adding songs from library not implemented yet - placeholder UI)
   - Verify empty state shows correctly

7. **Test Reordering** (when songs are in playlist)
   - Move songs up/down
   - Refresh page
   - Verify order persists

8. **Responsive Check**
   - Resize browser from mobile (375px) to desktop (1920px)
   - Verify all layouts adapt correctly

---

## Known Limitations (Out of Scope for Current Phase)

- ❌ Add songs to playlist from library (UI exists, needs implementation)
- ❌ Drag-and-drop reordering (using up/down buttons instead)
- ❌ Search songs across libraries (endpoint exists, UI not implemented)
- ❌ Metadata editing (backend supports, UI not implemented)
- ❌ Lyrics display
- ❌ Audio equalizer
- ❌ Smart playlists
- ❌ Library sharing

---

## Next Steps After Testing

1. Document any bugs found
2. Fix critical issues
3. Implement missing features (if needed)
4. Deploy to staging environment
5. User acceptance testing
6. Production deployment

---

**Testing Started**: [To be filled]  
**Testing Completed**: [To be filled]  
**Tester**: [To be filled]  
**Environment**: Local Development / Staging / Production
