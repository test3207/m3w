import { Menu, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logger } from '@/lib/logger-client';
import { api } from '@/services';
import { I18n } from '@/locales/i18n';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlaylistStore } from '@/stores/playlistStore';

interface MobileUserMenuProps {
  name?: string | null;
  email: string;
  image?: string | null;
}

export function MobileUserMenu({ name, email, image }: MobileUserMenuProps) {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const clearPlayerQueue = usePlayerStore((state) => state.clearQueue);
  const resetLibraries = useLibraryStore((state) => state.reset);
  const resetPlaylists = usePlaylistStore((state) => state.reset);
  
  const displayName = name ?? email;
  const initials = (name || email)
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    // 1. Clear all frontend state first (synchronous)
    clearAuth(); // Clears tokens and IndexedDB token
    clearPlayerQueue();
    resetLibraries();
    resetPlaylists();
    
    // 2. Wait for Zustand persist to write to localStorage
    // This ensures state is fully cleared before navigation
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // 3. Navigate to sign-in page
    navigate('/');
    
    // 4. Call backend signout in background (async, fire-and-forget)
    // Continue even if this fails - frontend is already clean
    api.main.auth.signout().catch((error) => {
      logger.error('Backend signout failed', error);
    });
    
    // Note: Cache Storage is intentionally preserved
    // Benefits: Faster next login, saves bandwidth, matches industry standard (Spotify/YouTube)
    // Security: Media files only, no tokens/credentials
  }

  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">{I18n.dashboard.navbar.signOut}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 space-y-1 md:hidden">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-10 w-10">
              <AvatarImage src={image || undefined} alt={displayName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <button onClick={handleSignOut} className="flex w-full items-center gap-2 text-left">
              <LogOut className="h-4 w-4" />
              <span suppressHydrationWarning>{I18n.dashboard.navbar.signOut}</span>
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden md:flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={image || undefined} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <Button onClick={handleSignOut} size="sm" variant="outline" className="hidden lg:inline-flex">
          <span suppressHydrationWarning>{I18n.dashboard.navbar.signOut}</span>
        </Button>
        <Button onClick={handleSignOut} size="icon" variant="ghost" className="lg:hidden">
          <LogOut className="h-5 w-5" />
          <span className="sr-only" suppressHydrationWarning>{I18n.dashboard.navbar.signOut}</span>
        </Button>
      </div>
    </div>
  );
}
