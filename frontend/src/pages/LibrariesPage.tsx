/**
 * Libraries Page (Mobile-First)
 * Display and manage user's music libraries
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLibraryStore } from '@/stores/libraryStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Library, Plus, Music } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getLibraryDisplayName, getLibraryBadge } from '@/lib/utils/defaults';
import { isDefaultLibrary } from '@m3w/shared';
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

export default function LibrariesPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const libraries = useLibraryStore((state) => state.libraries);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const fetchLibraries = useLibraryStore((state) => state.fetchLibraries);
  const createLibrary = useLibraryStore((state) => state.createLibrary);

  // Fetch libraries on mount
  useEffect(() => {
    void fetchLibraries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleCreateLibrary = async () => {
    if (!newLibraryName.trim()) {
      toast({
        variant: 'destructive',
        title: '请输入音乐库名称',
      });
      return;
    }

    setIsCreating(true);
    try {
      await createLibrary(newLibraryName.trim());
      toast({
        title: '创建成功',
        description: `音乐库"${newLibraryName}"已创建`,
      });
      setNewLibraryName('');
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
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">音乐库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {libraries.length} 个音乐库
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
              <DialogTitle>创建新音乐库</DialogTitle>
              <DialogDescription>
                为你的音乐创建一个新的收藏集
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">音乐库名称</Label>
                <Input
                  id="name"
                  placeholder="例如：我的音乐、工作音乐"
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateLibrary();
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
                  setNewLibraryName('');
                }}
              >
                取消
              </Button>
              <Button onClick={handleCreateLibrary} disabled={isCreating}>
                {isCreating ? '创建中...' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Libraries Grid */}
      {libraries.length === 0 ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Library className="mx-auto h-16 w-16 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-semibold">还没有音乐库</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              点击右上角 "+" 创建你的第一个音乐库
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {libraries.map((library) => (
            <Link key={library.id} to={`/libraries/${library.id}`}>
              <Card className="overflow-hidden transition-colors hover:bg-accent cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Cover Image - 96px */}
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                      {library.coverUrl ? (
                        <img
                          src={library.coverUrl}
                          alt={getLibraryDisplayName(library)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Music className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-1 flex-col justify-center gap-1 overflow-hidden">
                      <h3 className="truncate font-semibold text-base flex items-center gap-2">
                        {getLibraryDisplayName(library)}
                        {isDefaultLibrary(library) && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded whitespace-nowrap">
                            {getLibraryBadge(library)}
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {library._count?.songs || 0} 首歌曲
                      </p>
                      <p className="text-xs text-muted-foreground">
                        创建于 {new Date(library.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}
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
