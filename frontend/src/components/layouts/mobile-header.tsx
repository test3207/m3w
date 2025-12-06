/**
 * Mobile Header Component
 * Top header bar with logo and language switcher
 */

import { I18n } from "@/locales/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { useAuthStore } from "@/stores/authStore";
import { MobileUserMenu } from "./mobile-user-menu";

export function MobileHeader() {
  const user = useAuthStore((state) => state.user);
  
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
