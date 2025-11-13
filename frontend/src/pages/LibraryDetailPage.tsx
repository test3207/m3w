/**
 * Library Detail Page (Mobile-First)
 * Display songs in a library with playback controls
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlayerStore } from '@/stores/playerStore';
import { usePlaylistStore } from '@/stores/playlistStore';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Play, ListPlus, ArrowUpDown, MoreVertical, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { api } from '@/services';
import { eventBus, EVENTS } from '@/lib/events';
import type { Song as SharedSong, SongSortOption } from '@m3w/shared';
import type { Song } from '@/types/models';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Convert shared Song to frontend Song
function convertSong(song: SharedSong): Song {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    albumArtist: song.albumArtist,
    genre: song.genre,
    year: song.year,
    trackNumber: song.trackNumber,
    discNumber: song.discNumber,
    duration: song.file?.duration || null,
    coverArtUrl: song.coverUrl,
    libraryId: song.libraryId,
    fileId: song.fileId,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
    file: song.file,
    library: song.library,
  };
}

export default function LibraryDetailPage() {
  useLocale(); // Subscribe to locale changes
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [songs, setSongs] = useState<Song[]>([]);
  const [sortOption, setSortOption] = useState<SongSortOption>('date-desc');

  const { currentLibrary, isLoading, fetchLibraryById, fetchLibraries } = useLibraryStore();
  const playFromLibrary = usePlayerStore((state) => state.playFromLibrary);
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists);

  // Fetch library and songs
  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        navigate('/libraries');
        return;
      }

      try {
        // Fetch library (store handles loading state)
        const library = await fetchLibraryById(id);
        if (!library) {
          toast({
            variant: 'destructive',
            title: I18n.common.loadingLabel,
            description: I18n.error.libraryNotFound,
          });
          navigate('/libraries');
          return;
        }

        // Fetch songs
        const songsData = await api.main.libraries.getSongs(id, sortOption);
        setSongs(songsData.map(convertSong));
      } catch (error) {
        toast({
          variant: 'destructive',
          title: I18n.common.errorLabel,
          description: error instanceof Error ? error.message : I18n.error.genericTryAgain,
        });
        navigate('/libraries');
      }
    };

    fetchData();
  }, [id, sortOption, navigate, toast, fetchLibraryById]);

  // Refresh songs when library songs count changes (after upload)
  useEffect(() => {
    if (currentLibrary && id) {
      const refetchSongs = async () => {
        try {
          const songsData = await api.main.libraries.getSongs(id, sortOption);
          setSongs(songsData.map(convertSong));
        } catch (error) {
          // Silent fail - user will see stale data
          console.error('Failed to refresh songs:', error);
        }
      };
      void refetchSongs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLibrary?._count?.songs]); // Only watch song count changes

  const handlePlayAll = () => {
    if (songs.length === 0 || !currentLibrary) return;
    void playFromLibrary(currentLibrary.id, currentLibrary.name, songs, 0);
    toast({
      title: I18n.playback.startPlayingTitle,
      description: I18n.playback.startPlayingDescription.replace('{0}', currentLibrary.name),
    });
  };

  const handlePlaySong = (index: number) => {
    if (!currentLibrary) return;
    void playFromLibrary(currentLibrary.id, currentLibrary.name, songs, index);
  };

  const handleDeleteSong = async (songId: string, songTitle: string) => {
    if (!id) return;
    
    try {
      console.log('[LibraryDetailPage] Deleting song:', songId, 'from library:', id);
      // Pass libraryId to ensure we only delete from THIS library
      await api.main.songs.delete(songId, id);
      
      // Remove from local state
      setSongs(songs.filter(s => s.id !== songId));
      
      // Refresh current library to update count
      console.log('[LibraryDetailPage] Refreshing current library');
      await fetchLibraryById(id);
      
      // Refresh libraries list (for UploadPage and other pages)
      console.log('[LibraryDetailPage] Refreshing all libraries');
      await fetchLibraries();
      
      // Refresh playlists (song may have been removed from playlists by cascade)
      console.log('[LibraryDetailPage] Refreshing playlists');
      await fetchPlaylists();
      console.log('[LibraryDetailPage] Delete complete');
      
      // Emit event to notify other components
      eventBus.emit(EVENTS.SONG_DELETED);
      
      toast({
        title: '删除成功',
        description: `已从音乐库中删除"${songTitle}"`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  const getSortLabel = (option: SongSortOption): string => {
    const labels: Record<SongSortOption, string> = {
      'date-desc': I18n.library.detail.sortDateDesc,
      'date-asc': I18n.library.detail.sortDateAsc,
      'title-asc': I18n.library.detail.sortTitleAsc,
      'title-desc': I18n.library.detail.sortTitleDesc,
      'artist-asc': I18n.library.detail.sortArtistAsc,
      'album-asc': I18n.library.detail.sortAlbumAsc,
    };
    return labels[option];
  };

  if (isLoading || !currentLibrary) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">{I18n.library.detail.loadingLabel}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2"
          onClick={() => navigate('/libraries')}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          返回
        </Button>

        <h1 className="text-2xl font-bold">{currentLibrary.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {songs.length} 首歌曲
          {currentLibrary.isDefault && ' • 默认音乐库'}
        </p>
      </div>

      {/* Actions */}
      <div className="mb-4 flex gap-2">
        <Button
          onClick={handlePlayAll}
          disabled={songs.length === 0}
          className="flex-1"
        >
          <Play className="mr-2 h-4 w-4" />
          播放全部
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortOption('date-desc')}>
              {sortOption === 'date-desc' && '✓ '}
              添加时间 (最新)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption('date-asc')}>
              {sortOption === 'date-asc' && '✓ '}
              添加时间 (最旧)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption('title-asc')}>
              {sortOption === 'title-asc' && '✓ '}
              标题 A-Z
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption('title-desc')}>
              {sortOption === 'title-desc' && '✓ '}
              标题 Z-A
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption('artist-asc')}>
              {sortOption === 'artist-asc' && '✓ '}
              歌手 A-Z
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption('album-asc')}>
              {sortOption === 'album-asc' && '✓ '}
              专辑 A-Z
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Current Sort */}
      <p className="mb-4 text-xs text-muted-foreground">
        排序方式: {getSortLabel(sortOption)}
      </p>

      {/* Song List */}
      {songs.length === 0 ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <ListPlus className="mx-auto h-16 w-16 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-semibold">还没有歌曲</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              点击右下角 "+" 上传歌曲到这个音乐库
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {songs.map((song, index) => (
            <div
              key={song.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              {/* Clickable song area */}
              <div
                onClick={() => handlePlaySong(index)}
                className="flex flex-1 items-center gap-3 cursor-pointer transition-colors hover:bg-accent rounded min-w-0"
              >
                {/* Album Cover */}
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                  {song.coverArtUrl ? (
                    <img
                      src={song.coverArtUrl}
                      alt={song.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      ♪
                    </div>
                  )}
                </div>

                {/* Song Info */}
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-medium">{song.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {song.artist}
                    {song.album && ` • ${song.album}`}
                  </p>
                </div>

                {/* Duration */}
                {song.duration && (
                  <div className="shrink-0 text-sm text-muted-foreground">
                    {Math.floor(song.duration / 60)}:
                    {(song.duration % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>

              {/* More Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleDeleteSong(song.id, song.title)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除歌曲
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
