/**
 * Mobile Header Component
 * Top header bar with logo and language switcher
 */

import { WifiOff } from "lucide-react";
import { I18n } from "@/locales/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { useAuthStore } from "@/stores/authStore";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { MobileUserMenu } from "./mobile-user-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function MobileHeader() {
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const { isOnline } = useNetworkStatus();
  
  // Only show offline indicator for Auth users when offline
  // Guest users are always "local" so no need to show offline status
  const showOfflineIndicator = !isGuest && !isOnline;
  
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left side - logo and title */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            M3W
          </div>
          <h1 className="text-base font-semibold" suppressHydrationWarning>
            {I18n.app.name}
          </h1>
          {/* Offline indicator - only for Auth users */}
          {showOfflineIndicator && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <WifiOff className="h-4 w-4 text-amber-500" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>
                  <p suppressHydrationWarning>{I18n.networkStatus.offlineTooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Right side - language switcher and user menu */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {user && (
            <MobileUserMenu
              name={user.name}
              email={user.email || ""}
              image={user.image}
            />
          )}
        </div>
      </div>
    </header>
  );
}
