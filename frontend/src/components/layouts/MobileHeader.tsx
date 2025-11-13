/**
 * Mobile Header Component
 * Top header bar with status indicators (network, PWA, etc.)
 */

import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { NetworkStatusIndicator } from '@/components/features/network/network-status-indicator';

export function MobileHeader() {
  useLocale(); // Subscribe to locale changes
  
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
        </div>

        {/* Right side - status indicators */}
        <div className="flex items-center gap-2">
          <NetworkStatusIndicator />
          {/* Future: PWA install prompt, update notification, etc. */}
        </div>
      </div>
    </header>
  );
}
