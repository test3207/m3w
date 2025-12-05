/**
 * Offline Settings Component
 * 
 * Compact UI for cache-all settings with inline dropdowns
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Stack } from '@/components/ui/stack';
import { Text } from '@/components/ui/text';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Info, Cloud } from 'lucide-react';
import { useLocale } from '@/locales/use-locale';
import { I18n } from '@/locales/i18n';
import { api } from '@/services';
import {
  getLocalCacheAllOverride,
  setLocalCacheAllOverride,
  getDownloadTiming,
  setDownloadTiming,
} from '@/lib/storage/cache-policy';
import type { LocalCacheOverride, DownloadTiming } from '@/lib/db/schema';
import { getQueueStatus, getTotalCacheStats } from '@/lib/storage/download-manager';
import { isAudioCacheAvailable } from '@/lib/storage/audio-cache';
import { logger } from '@/lib/logger-client';
import { isGuestUser } from '@/lib/offline-proxy/utils';
import { useAuthStore } from '@/stores/authStore';

export default function OfflineSettings() {
  useLocale();
  const { isGuest } = useAuthStore();
  
  // Backend settings (only for authenticated users)
  const [backendCacheAll, setBackendCacheAll] = useState(false);
  
  // Local settings
  const [localOverride, setLocalOverride] = useState<LocalCacheOverride>('inherit');
  const [downloadTimingVal, setDownloadTimingVal] = useState<DownloadTiming>('wifi-only');
  
  // Queue status
  const [queueStatus, setQueueStatus] = useState({ pending: 0, active: 0, isProcessing: false });
  
  // Cache stats
  const [cacheStats, setCacheStats] = useState({ total: 0, cached: 0, percentage: 0 });
  
  // Cache availability
  const [cacheAvailable, setCacheAvailable] = useState<boolean | null>(null);
  
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

        // Load local settings
        const [localOvr, timing] = await Promise.all([
          getLocalCacheAllOverride(),
          getDownloadTiming(),
        ]);
        setLocalOverride(localOvr ?? 'inherit');
        setDownloadTimingVal(timing);

        // Load backend settings (only for authenticated users)
        if (!isGuestUser()) {
          try {
            const prefs = await api.main.user.getPreferences();
            setBackendCacheAll(prefs.cacheAllEnabled);
          } catch (error) {
            logger.warn('Failed to load user preferences', error);
          }
        }
      } catch (error) {
        logger.error('Failed to load offline settings', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
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

  // Handle backend cache-all toggle
  const handleBackendCacheAllChange = useCallback(async (enabled: boolean) => {
    try {
      await api.main.user.updatePreferences({ cacheAllEnabled: enabled });
      setBackendCacheAll(enabled);
    } catch (error) {
      logger.error('Failed to update cache-all setting', error);
    }
  }, []);

  // Handle local override change
  const handleLocalOverrideChange = useCallback(async (value: LocalCacheOverride) => {
    try {
      await setLocalCacheAllOverride(value === 'inherit' ? null : value);
      setLocalOverride(value);
    } catch (error) {
      logger.error('Failed to update local override', error);
    }
  }, []);

  // Handle download timing change
  const handleDownloadTimingChange = useCallback(async (value: DownloadTiming) => {
    try {
      await setDownloadTiming(value);
      setDownloadTimingVal(value);
    } catch (error) {
      logger.error('Failed to update download timing', error);
    }
  }, []);

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
          {/* Backend Cache-All Toggle (only for authenticated users) */}
          {!isGuest && (
            <Stack direction="horizontal" align="center" justify="between" className="min-h-8">
              <Stack direction="horizontal" align="center" gap="sm">
                <Label className="text-sm">{I18n.settings.offline.cacheAll}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                      <Info className="h-3 w-3 text-muted-foreground" />
                      <span className="sr-only">Info</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64">
                    <Text variant="caption" className="text-muted-foreground">
                      {I18n.settings.offline.cacheAllDescription}
                    </Text>
                  </PopoverContent>
                </Popover>
              </Stack>
              <Switch
                checked={backendCacheAll}
                onCheckedChange={handleBackendCacheAllChange}
              />
            </Stack>
          )}

          {/* Local Override - inline */}
          <Stack direction="horizontal" align="center" justify="between" className="min-h-8">
            <Stack direction="horizontal" align="center" gap="sm">
              <Label className="text-sm">{I18n.settings.offline.localOverride}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64">
                  <Text variant="caption" className="text-muted-foreground">
                    {I18n.settings.offline.localOverrideDescription}
                  </Text>
                </PopoverContent>
              </Popover>
            </Stack>
            <Select value={localOverride} onValueChange={handleLocalOverrideChange}>
              <SelectTrigger className="w-auto min-w-[120px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">{I18n.settings.offline.policyInherit}</SelectItem>
                <SelectItem value="always">{I18n.settings.offline.policyAlways}</SelectItem>
                <SelectItem value="never">{I18n.settings.offline.policyNever}</SelectItem>
              </SelectContent>
            </Select>
          </Stack>

          {/* Download Timing - inline */}
          <Stack direction="horizontal" align="center" justify="between" className="min-h-8">
            <Label className="text-sm">{I18n.settings.offline.downloadTiming}</Label>
            <Select value={downloadTimingVal} onValueChange={handleDownloadTimingChange}>
              <SelectTrigger className="w-auto min-w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">{I18n.settings.offline.timingAlways}</SelectItem>
                <SelectItem value="wifi-only">{I18n.settings.offline.timingWifiOnly}</SelectItem>
                <SelectItem value="manual">{I18n.settings.offline.timingManual}</SelectItem>
              </SelectContent>
            </Select>
          </Stack>

          {/* Cache Status - compact */}
          {cacheAvailable === false ? (
            <Text variant="caption" className="text-amber-600 dark:text-amber-400 pt-2 border-t">
              {I18n.settings.offline.cacheNotAvailable}
            </Text>
          ) : (
            <Stack direction="horizontal" align="center" justify="between" className="pt-2 border-t min-h-6">
              <Text variant="caption" className="text-muted-foreground">
                {I18n.settings.offline.cacheStatus
                  .replace('{0}', String(cacheStats.cached))
                  .replace('{1}', String(cacheStats.total))}
              </Text>
              {isDownloading && (
                <Text variant="caption" className="text-primary">
                  {I18n.settings.offline.downloadingStatus
                    .replace('{0}', String(queueStatus.active))
                    .replace('{1}', String(queueStatus.pending))}
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
