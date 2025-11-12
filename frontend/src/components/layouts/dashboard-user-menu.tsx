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

interface DashboardUserMenuProps {
  name?: string | null;
  email: string;
  image?: string | null;
}

export function DashboardUserMenu({ name, email, image }: DashboardUserMenuProps) {
  const navigate = useNavigate();
  const displayName = name ?? email;
  const initials = (name || email)
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    try {
      await api.main.auth.signout();
      navigate('/');
    } catch (error) {
      logger.error('Sign out failed', error);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open user menu</span>
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
              <span>Sign out</span>
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
          Sign out
        </Button>
        <Button onClick={handleSignOut} size="icon" variant="ghost" className="lg:hidden">
          <LogOut className="h-5 w-5" />
          <span className="sr-only">Sign out</span>
        </Button>
      </div>
    </div>
  );
}
