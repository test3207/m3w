/**
 * Offline Settings Component
 * 
 * Compact UI for offline cache settings:
 * - Auto-download: Off / WiFi Only / Always
 * - Metadata sync (for authenticated users)
 * - Cache status display
 */

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Stack } from "@/components/ui/stack";
import { Text } from "@/components/ui/text";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Info, Cloud, RefreshCw } from "lucide-react";
import { I18n } from "@/locales/i18n";
import {
  getAutoDownloadSetting,
  setAutoDownloadSetting,
} from "@/lib/storage/cache-policy";
import type { AutoDownloadSetting } from "@/lib/db/schema";
import { getQueueStatus, getTotalCacheStats } from "@/lib/storage/download-manager";
import { isAudioCacheAvailable } from "@/lib/storage/audio-cache";
import {
  getSyncStatus,
  getSyncSettings,
  updateSyncSettings,
  manualSync,
  onSyncStatusChange,
} from "@/lib/sync/metadata-sync";
import { logger } from "@/lib/logger-client";
import { useAuthStore } from "@/stores/authStore";

/**
 * Format last sync time as human-readable relative time
 * Moved outside component since it's a pure function with no dependencies
 */
function formatLastSync(timestamp: number | null): string {
  if (!timestamp) return I18n.sync.never;
  
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return I18n.sync.justNow;
  if (minutes < 60) return I18n.sync.minutesAgo.replace("{0}", String(minutes));
  if (hours < 24) return I18n.sync.hoursAgo.replace("{0}", String(hours));
  return I18n.sync.daysAgo.replace("{0}", String(days));
}

export default function OfflineSettings() {
  const { isGuest } = useAuthStore();
  
  // Auto-download setting (local only)
  const [autoDownload, setAutoDownload] = useState<AutoDownloadSetting>("off");
  
  // Queue status
  const [queueStatus, setQueueStatus] = useState({ pending: 0, active: 0, isProcessing: false });
  
  // Cache stats
  const [cacheStats, setCacheStats] = useState({ total: 0, cached: 0, percentage: 0 });
  
  // Cache availability
  const [cacheAvailable, setCacheAvailable] = useState<boolean | null>(null);
  
  // Metadata sync settings (only for authenticated users)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Check cache availability
        const available = await isAudioCacheAvailable();
        setCacheAvailable(available);

        // Load cache stats
        const stats = await getTotalCacheStats();
        setCacheStats(stats);

        // Load auto-download setting
        const setting = await getAutoDownloadSetting();
        setAutoDownload(setting);

        // Load metadata sync settings (only for authenticated users)
        if (!isGuest) {
          const syncSettings = getSyncSettings();
          setAutoSyncEnabled(syncSettings.autoSync);
          
          const syncStatus = getSyncStatus();
          setLastSyncTime(syncStatus.lastSyncTime);
          setIsSyncing(syncStatus.isSyncing);
        }
      } catch (error) {
        logger.error("Failed to load offline settings", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [isGuest]);

  // Subscribe to sync status changes
  useEffect(() => {
    const unsubscribe = onSyncStatusChange(() => {
      const status = getSyncStatus();
      setIsSyncing(status.isSyncing);
      setAutoSyncEnabled(status.autoSyncEnabled);
      setLastSyncTime(status.lastSyncTime);
    });
    return unsubscribe;
  }, []);

  // Poll queue status and cache stats (only poll when downloading)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const updateStatus = async () => {
      const status = getQueueStatus();
      setQueueStatus(status);
      const stats = await getTotalCacheStats();
      setCacheStats(stats);

      // Start/stop polling based on processing state
      if (status.isProcessing && !interval) {
        interval = setInterval(updateStatus, 2000);
      } else if (!status.isProcessing && interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    
    // Initial load
    updateStatus();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // Handle auto-download setting change
  const handleAutoDownloadChange = useCallback(async (value: AutoDownloadSetting) => {
    try {
      await setAutoDownloadSetting(value);
      setAutoDownload(value);
    } catch (error) {
      logger.error("Failed to update auto-download setting", error);
    }
  }, []);

  // Handle auto-sync toggle
  const handleAutoSyncChange = useCallback((enabled: boolean) => {
    // updateSyncSettings will restart service and notify listeners
    updateSyncSettings({ autoSync: enabled });
  }, []);

  // Handle manual sync
  const handleManualSync = useCallback(async () => {
    if (isSyncing) return;
    
    // manualSync will notify listeners of state changes
    try {
      await manualSync();
    } catch (error) {
      logger.error("Manual sync failed", error);
    }
  }, [isSyncing]);



  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse h-16 bg-muted rounded" />
      </Card>
    );
  }

  const isDownloading = queueStatus.pending > 0 || queueStatus.active > 0;

  return (
    <Card className="p-4">
      <Stack gap="md">
        {/* Header */}
        <Stack direction="horizontal" align="center" gap="sm">
          <Cloud className="w-4 h-4 text-muted-foreground" />
          <Text variant="body" className="font-medium">{I18n.settings.offline.title}</Text>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                <Info className="h-3 w-3 text-muted-foreground" />
                <span className="sr-only">Info</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <Text variant="caption" className="text-muted-foreground">
                {I18n.settings.offline.description}
              </Text>
            </PopoverContent>
          </Popover>
        </Stack>

        {/* Settings List - tighter spacing between items */}
        <Stack gap="sm">
          {/* Auto-download Setting */}
          <Stack direction="horizontal" align="center" justify="between" className="min-h-8">
            <Stack direction="horizontal" align="center" gap="sm">
              <Label className="text-sm">{I18n.settings.offline.syncMusic}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64">
                  <Text variant="caption" className="text-muted-foreground">
                    {I18n.settings.offline.syncMusicDescription}
                  </Text>
                </PopoverContent>
              </Popover>
            </Stack>
            <Select value={autoDownload} onValueChange={handleAutoDownloadChange}>
              <SelectTrigger className="w-auto min-w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">{I18n.settings.offline.syncMusicOff}</SelectItem>
                <SelectItem value="wifi-only">{I18n.settings.offline.syncMusicWifiOnly}</SelectItem>
                <SelectItem value="always">{I18n.settings.offline.syncMusicAlways}</SelectItem>
              </SelectContent>
            </Select>
          </Stack>

          {/* Metadata Sync Section (only for authenticated users) */}
          {!isGuest && (
            <>
              {/* Auto-Sync Toggle */}
              <Stack direction="horizontal" align="center" justify="between" className="min-h-8 pt-2 border-t">
                <Stack direction="horizontal" align="center" gap="sm">
                  <Label className="text-sm">{I18n.sync.syncMetadata}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                        <Info className="h-3 w-3 text-muted-foreground" />
                        <span className="sr-only">Info</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64">
                      <Text variant="caption" className="text-muted-foreground">
                        {I18n.sync.syncMetadataDescription}
                      </Text>
                    </PopoverContent>
                  </Popover>
                </Stack>
                <Switch
                  checked={autoSyncEnabled}
                  onCheckedChange={handleAutoSyncChange}
                />
              </Stack>

              {/* Manual Sync Button and Status */}
              <Stack direction="horizontal" align="center" justify="between" className="min-h-8">
                <Text variant="caption" className="text-muted-foreground">
                  {I18n.sync.lastSync}: {formatLastSync(lastSyncTime)}
                </Text>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={handleManualSync}
                  disabled={isSyncing || !navigator.onLine}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? I18n.sync.syncing : I18n.sync.syncNow}
                </Button>
              </Stack>
            </>
          )}

          {/* Cache Status - compact */}
          {cacheAvailable === false ? (
            <Text variant="caption" className="text-amber-600 dark:text-amber-400 pt-2 border-t">
              {I18n.settings.offline.cacheNotAvailable}
            </Text>
          ) : (
            <Stack direction="horizontal" align="center" justify="between" className="pt-2 border-t min-h-6">
              <Text variant="caption" className="text-muted-foreground">
                {I18n.settings.offline.cacheStatus
                  .replace("{0}", String(cacheStats.cached))
                  .replace("{1}", String(cacheStats.total))}
              </Text>
              {isDownloading && (
                <Text variant="caption" className="text-primary">
                  {I18n.settings.offline.downloadingStatus
                    .replace("{0}", String(queueStatus.active))
                    .replace("{1}", String(queueStatus.pending))}
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
