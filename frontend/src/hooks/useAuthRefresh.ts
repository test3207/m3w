/**
 * Auto Token Refresh Hook
 * Automatically refreshes access token before expiry
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@/stores/authStore";
import { useToast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger-client";
import { I18n } from "@/locales/i18n";

// Refresh when 1 hour (3600000ms) remains
const REFRESH_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// Check interval: every 5 minutes
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useAuthRefresh() {
  const { tokens, isAuthenticated, refreshToken } = useAuth();
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const lastFailureToastRef = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated || !tokens) {
      return;
    }

    const checkAndRefresh = async () => {
      if (isRefreshingRef.current) {
        logger.info("[useAuthRefresh][checkAndRefresh]", "Token refresh already in progress, skipping");
        return;
      }

      const now = Date.now();
      const timeUntilExpiry = tokens.expiresAt - now;

      logger.info("[useAuthRefresh][checkAndRefresh]", "Token expiry check", {
        raw: {
          expiresAt: new Date(tokens.expiresAt).toISOString(),
          timeUntilExpiry: Math.floor(timeUntilExpiry / 1000 / 60), // minutes
          threshold: Math.floor(REFRESH_THRESHOLD_MS / 1000 / 60), // minutes
        }
      });

      // Refresh if less than threshold remains
      if (timeUntilExpiry <= REFRESH_THRESHOLD_MS) {
        logger.info("[useAuthRefresh][checkAndRefresh]", "Token expiring soon, refreshing...", {
          raw: { minutesRemaining: Math.floor(timeUntilExpiry / 1000 / 60) }
        });

        isRefreshingRef.current = true;

        try {
          const success = await refreshToken();

          if (success) {
            logger.info("[useAuthRefresh][checkAndRefresh]", "Token refreshed successfully");
            // Show success toast (optional, can be commented out if too noisy)
            // toast({
            //   title: 'Session renewed',
            //   description: 'Your login session has been extended.',
            // });
          } else {
            logger.warn("[useAuthRefresh][checkAndRefresh]", "Token refresh failed - user may need to re-authenticate");

            // Only show toast once every 10 minutes to avoid spam
            if (now - lastFailureToastRef.current > 10 * 60 * 1000) {
              toast({
                variant: "destructive",
                title: I18n.error.sessionExpired || "Session expired",
                description: I18n.error.pleaseSignInAgain || "Please sign in again.",
              });
              lastFailureToastRef.current = now;
            }
          }
        } catch (error) {
          logger.error("[useAuthRefresh][checkAndRefresh]", "Token refresh error", error);
        } finally {
          isRefreshingRef.current = false;
        }
      }
    };

    // Initial check
    checkAndRefresh();

    // Set up interval
    intervalRef.current = setInterval(checkAndRefresh, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAuthenticated, tokens, refreshToken, toast]);
}
