/**
 * Offline Settings Component
 * 
 * Manages cache-all settings for offline playback:
 * - Global cache policy (always/wifi-only/manual)
 * - Download timing preference
 * - Download queue status
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
  const [downloadTiming, setDownloadTimingState] = useState<DownloadTiming>('wifi-only');
  
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
        setDownloadTimingState(timing);

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

  // Poll queue status and cache stats
  useEffect(() => {
    const updateStatus = async () => {
      setQueueStatus(getQueueStatus());
      // Update cache stats less frequently (only when queue changes)
      const stats = await getTotalCacheStats();
      setCacheStats(stats);
    };
    
    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    return () => clearInterval(interval);
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
      setDownloadTimingState(value);
    } catch (error) {
      logger.error('Failed to update download timing', error);
    }
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{I18n.settings.offline.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{I18n.settings.offline.title}</CardTitle>
        <CardDescription>{I18n.settings.offline.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Backend Cache-All Setting (only for authenticated users) */}
        {!isGuest && (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{I18n.settings.offline.cacheAll}</Label>
              <p className="text-sm text-muted-foreground">
                {I18n.settings.offline.cacheAllDescription}
              </p>
            </div>
            <Switch
              checked={backendCacheAll}
              onCheckedChange={handleBackendCacheAllChange}
            />
          </div>
        )}

        {/* Local Override */}
        <div className="space-y-2">
          <Label>{I18n.settings.offline.localOverride}</Label>
          <p className="text-sm text-muted-foreground">
            {I18n.settings.offline.localOverrideDescription}
          </p>
          <Select value={localOverride} onValueChange={handleLocalOverrideChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">{I18n.settings.offline.policyInherit}</SelectItem>
              <SelectItem value="always">{I18n.settings.offline.policyAlways}</SelectItem>
              <SelectItem value="never">{I18n.settings.offline.policyNever}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Download Timing */}
        <div className="space-y-2">
          <Label>{I18n.settings.offline.downloadTiming}</Label>
          <p className="text-sm text-muted-foreground">
            {I18n.settings.offline.downloadTimingDescription}
          </p>
          <Select value={downloadTiming} onValueChange={handleDownloadTimingChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">{I18n.settings.offline.timingAlways}</SelectItem>
              <SelectItem value="wifi-only">{I18n.settings.offline.timingWifiOnly}</SelectItem>
              <SelectItem value="manual">{I18n.settings.offline.timingManual}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cache Status */}
        <div className="pt-2 border-t">
          {cacheAvailable === false ? (
            <div className="text-sm text-amber-600 dark:text-amber-400">
              {I18n.settings.offline.cacheNotAvailable}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Cache stats - always show */}
              <div className="text-sm text-muted-foreground">
                {I18n.settings.offline.cacheStatus
                  .replace('{0}', String(cacheStats.cached))
                  .replace('{1}', String(cacheStats.total))}
              </div>
              {/* Download progress - only when downloading */}
              {(queueStatus.pending > 0 || queueStatus.active > 0) && (
                <div className="text-sm text-primary">
                  {I18n.settings.offline.downloadingStatus
                    .replace('{0}', String(queueStatus.active))
                    .replace('{1}', String(queueStatus.pending))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
