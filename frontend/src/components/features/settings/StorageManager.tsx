/**
 * StorageManager Component - Storage Quota Monitoring UI
 * 
 * Displays storage usage, breakdown, and management options
 * Mounted in Settings page
 */

import { useState, useEffect } from 'react';
import { storageMonitor, type StorageUsage, type StorageWarning } from '@/lib/storage/storage-monitor';
import { logger } from '@/lib/logger-client';
import { Stack } from '@/components/ui/stack';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Database, AlertTriangle } from 'lucide-react';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { useToast } from '@/components/ui/use-toast';

export default function StorageManager() {
  useLocale();
  const { toast } = useToast();

  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [warning, setWarning] = useState<StorageWarning | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Load storage usage on mount
  useEffect(() => {
    loadStorageUsage();
  }, []);

  const loadStorageUsage = async () => {
    setIsLoading(true);
    try {
      const [usageData, warningData] = await Promise.all([
        storageMonitor.getStorageUsage(),
        storageMonitor.checkWarning(),
      ]);
      
      setUsage(usageData);
      setWarning(warningData);
      logger.info('Storage usage loaded', usageData);
    } catch (error) {
      logger.error('Failed to load storage usage', { error });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadStorageUsage();
  };

  const handleRequestPersistent = async () => {
    setIsLoading(true);
    try {
      const result = await storageMonitor.requestPersistentStorage();
      
      if (result === 'granted') {
        await loadStorageUsage();
        logger.info('Persistent storage granted');
        toast({
          title: I18n.settings.storage.persistent.successTitle,
          description: I18n.settings.storage.persistent.successDescription,
        });
      } else if (result === 'denied') {
        logger.warn('Persistent storage denied');
        toast({
          title: I18n.settings.storage.persistent.deniedTitle,
          description: I18n.settings.storage.persistent.deniedDescription,
          variant: 'destructive',
        });
      } else {
        // unsupported
        logger.warn('Persistent storage not supported');
        toast({
          title: I18n.settings.storage.persistent.unsupportedTitle,
          description: I18n.settings.storage.persistent.unsupportedDescription,
          variant: 'destructive',
        });
      }
    } catch (error) {
      logger.error('Failed to request persistent storage', { error });
      toast({
        title: I18n.settings.storage.persistent.errorTitle,
        description: I18n.settings.storage.persistent.errorDescription,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!usage) {
    return (
      <Card className="p-4">
        <Text>{I18n.settings.storage.loading}</Text>
      </Card>
    );
  }

  const statusColor = storageMonitor.getStatusColor(usage.usagePercent);
  const progressVariant = 
    statusColor === 'destructive' ? 'destructive' 
    : statusColor === 'warning' ? 'warning' 
    : 'success';
  const badgeVariant = statusColor === 'destructive' ? 'destructive' : 'default';

  return (
    <Card>
      <Stack gap="lg" className="p-6">
        {/* Header */}
        <Stack direction="horizontal" align="center" justify="between">
          <Stack direction="horizontal" gap="sm" align="center">
            <Database className="w-5 h-5" />
            <Text variant="h3">{I18n.settings.storage.title}</Text>
          </Stack>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Refresh storage usage"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </Stack>

        {/* Warning Banner */}
        {warning && (
          <Alert variant={warning.level === 'critical' ? 'destructive' : 'warning'}>
            <Stack direction="horizontal" gap="sm" align="center">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <AlertDescription>{warning.message}</AlertDescription>
            </Stack>
          </Alert>
        )}

        {/* Storage Status */}
        <Stack gap="sm">
          <Stack direction="horizontal" align="center" justify="between">
            <Stack gap="xs">
              <Text>
                {storageMonitor.formatBytes(usage.usage)} / {storageMonitor.formatBytes(usage.quota)}
              </Text>
              <Text variant="caption" className="text-muted-foreground">
                {I18n.settings.storage.quotaNote}
              </Text>
            </Stack>
            <Badge variant={badgeVariant}>
              {usage.usagePercent.toFixed(1)}%
            </Badge>
          </Stack>

          <Progress value={usage.usagePercent} variant={progressVariant} />
        </Stack>

        <Separator />

        {/* Persistent Storage */}
        <Stack direction="horizontal" align="center" justify="between">
          <Stack gap="xs">
            <Text>{I18n.settings.storage.persistent.title}</Text>
            <Text variant="caption" className="text-muted-foreground">
              {I18n.settings.storage.persistent.description}
            </Text>
          </Stack>
          
          {usage.isPersistent ? (
            <Badge variant="default">{I18n.settings.storage.persistent.granted}</Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestPersistent}
              disabled={isLoading}
            >
              {I18n.settings.storage.persistent.request}
            </Button>
          )}
        </Stack>

        <Separator />

        {/* Detailed Breakdown (Optional) */}
        <Stack gap="md">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-fit"
          >
            {showDetails ? I18n.settings.storage.hideDetails : I18n.settings.storage.showDetails}
          </Button>

          {showDetails && (
            <Card className="bg-muted">
              <Stack gap="sm" className="p-4">
                <Stack direction="horizontal" justify="between">
                  <Text>{I18n.settings.storage.breakdown.audio}</Text>
                  <Text className="font-medium">{storageMonitor.formatBytes(usage.breakdown.audio)}</Text>
                </Stack>
                
                <Separator />
                
                <Stack direction="horizontal" justify="between">
                  <Text>{I18n.settings.storage.breakdown.covers}</Text>
                  <Text className="font-medium">{storageMonitor.formatBytes(usage.breakdown.covers)}</Text>
                </Stack>
                
                <Separator />
                
                <Stack direction="horizontal" justify="between">
                  <Text>{I18n.settings.storage.breakdown.metadata}</Text>
                  <Text className="font-medium">{storageMonitor.formatBytes(usage.breakdown.metadata)}</Text>
                </Stack>
              </Stack>
            </Card>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
