'use client';

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { I18n } from "@/locales/i18n";
import { useLocale } from "@/locales/use-locale";
import { Sparkles } from "lucide-react";
import { DashboardUserMenu } from "./dashboard-user-menu";
import { LanguageSwitcher } from "./language-switcher";
import { NetworkStatusIndicator } from "@/components/features/network/network-status-indicator";
import { useAuthStore } from "@/stores/authStore";

export function DashboardNavbar() {
  useLocale(); // Subscribe to locale changes
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    // User already loaded by authStore
  }, []);
  return (
    <header
      className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-backdrop-filter:bg-background/65"
      role="banner"
    >
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-3 md:h-16">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 rounded-full px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-primary/10"
              aria-label={I18n.dashboard.navbar.goToDashboard}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
                M3W
              </span>
              <div className="hidden xs:flex flex-col leading-tight">
                <span className="text-sm font-semibold tracking-tight text-foreground group-hover:text-primary" suppressHydrationWarning>
                  {I18n.dashboard.navbar.title}
                </span>
                <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                  {I18n.dashboard.badgeProductionReady}
                </span>
              </div>
            </Link>
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span suppressHydrationWarning>{I18n.dashboard.badgeProductionReady}</span>
            </div>
            <NetworkStatusIndicator />
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {user && (
              <DashboardUserMenu
                name={user.name}
                email={user.email || ""}
                image={user.image}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
