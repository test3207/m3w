/**
 * useCanWrite Hook
 * 
 * Determines if write operations are allowed based on user type and network status.
 * 
 * Rules:
 * - Guest users: Always can write (uses offline-proxy)
 * - Auth users online: Can write (uses backend)
 * - Auth users offline: Cannot write (read-only mode)
 */

import { useNetworkStatus } from "./useNetworkStatus";
import { useAuthStore } from "@/stores/authStore";
import { I18n } from "@/locales/i18n";

interface UseCanWriteResult {
  /** Whether write operations are allowed */
  canWrite: boolean;
  /** Reason why writes are disabled (for tooltip), undefined if allowed */
  disabledReason: string | undefined;
}

export function useCanWrite(): UseCanWriteResult {
  const { isOnline } = useNetworkStatus();
  const isGuest = useAuthStore((state) => state.isGuest);

  // Guest users can always write (offline-proxy handles it)
  // Auth users can only write when online
  const canWrite = isGuest || isOnline;
  const disabledReason = canWrite ? undefined : I18n.networkStatus.offlineWriteDisabled;

  return { canWrite, disabledReason };
}
