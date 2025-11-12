/**
 * Network Status Indicator
 * Shows online/offline status and pending syncs
 */

import { Badge } from '@/components/ui/badge';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function NetworkStatusIndicator() {
  const { isOnline, pendingSyncs } = useNetworkStatus();

  if (isOnline && pendingSyncs === 0) {
    return null; // Don't show anything when everything is normal
  }

  return (
    <div className="fixed top-4 right-4 z-40">
      {!isOnline && (
        <Badge variant="destructive" className="animate-pulse">
          Offline Mode
        </Badge>
      )}
      {isOnline && pendingSyncs > 0 && (
        <Badge variant="secondary">
          Syncing {pendingSyncs} {pendingSyncs === 1 ? 'item' : 'items'}...
        </Badge>
      )}
    </div>
  );
}
