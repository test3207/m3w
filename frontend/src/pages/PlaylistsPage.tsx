/**
 * Playlists Page (Mobile-First)
 * Display and manage user's playlists
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlaylistStore } from '@/stores/playlistStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ListMusic, Plus, Music } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { eventBus, EVENTS } from '@/lib/events';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function PlaylistsPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const playlists = usePlaylistStore((state) => state.playlists);
  const isLoading = usePlaylistStore((state) => state.isLoading);
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists);
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  // Listen for external song changes (delete/upload) that may affect playlists
  useEffect(() => {
    const refetchPlaylists = () => {
      console.log('[PlaylistsPage] Event triggered, refetching playlists');
      fetchPlaylists();
    };

    const unsubscribeDelete = eventBus.on(EVENTS.SONG_DELETED, refetchPlaylists);
    const unsubscribeUpload = eventBus.on(EVENTS.SONG_UPLOADED, refetchPlaylists);

    return () => {
      unsubscribeDelete();
      unsubscribeUpload();
    };
  }, [fetchPlaylists]);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      toast({
        variant: 'destructive',
        title: '请输入播放列表名称',
      });
      return;
    }

    setIsCreating(true);
    try {
      await createPlaylist(newPlaylistName.trim());
      toast({
        title: '创建成功',
        description: `播放列表"${newPlaylistName}"已创建`,
      });
      setNewPlaylistName('');
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '创建失败',
        description: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">播放列表</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {playlists.length} 个播放列表
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="outline">
              <Plus className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新播放列表</DialogTitle>
              <DialogDescription>
                创建一个自定义播放列表
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">播放列表名称</Label>
                <Input
                  id="name"
                  placeholder="例如：深夜驾车、运动音乐"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreatePlaylist();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setNewPlaylistName('');
                }}
              >
                取消
              </Button>
              <Button onClick={handleCreatePlaylist} disabled={isCreating}>
                {isCreating ? '创建中...' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Playlists Grid */}
      {playlists.length === 0 ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <ListMusic className="mx-auto h-16 w-16 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-semibold">还没有播放列表</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              点击右上角 "+" 创建你的第一个播放列表
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <Link key={playlist.id} to={`/playlists/${playlist.id}`}>
              <Card className="overflow-hidden transition-colors hover:bg-accent cursor-pointer">
                {/* Cover Image */}
                <div className="aspect-square w-full bg-muted">
                  {playlist.coverUrl ? (
                    <img
                      src={playlist.coverUrl}
                      alt={playlist.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Music className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 overflow-hidden">
                      <h3 className="truncate font-semibold">
                        {playlist.name}
                        {playlist.isDefault && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (默认)
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {playlist.songIds?.length || 0} 首歌曲
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
