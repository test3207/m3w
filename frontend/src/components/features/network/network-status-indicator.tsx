/**
 * Network Status Indicator
 * Shows online/offline status and pending syncs in navbar
 */

import { Badge } from '@/components/ui/badge';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';

export function NetworkStatusIndicator() {
  useLocale();
  const { isOnline, pendingSyncs } = useNetworkStatus();

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={isOnline ? "default" : "destructive"} 
        className={!isOnline ? "animate-pulse" : ""}
      >
        {isOnline ? I18n.networkStatus.online : I18n.networkStatus.offline}
      </Badge>
      {pendingSyncs > 0 && (
        <Badge variant="secondary">
          {I18n.networkStatus.syncing} ({pendingSyncs})
        </Badge>
      )}
    </div>
  );
}
