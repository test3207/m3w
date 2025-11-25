/**
 * StorageManager Component - PWA Status & Global Storage Management
 * 
 * Displays:
 * 1. PWA installation status
 * 2. Global browser storage usage (shared across all users)
 * 3. Clear all data option (with confirmation)
 * 
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
import { RefreshCw, Database, AlertTriangle, Trash2, Smartphone } from 'lucide-react';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { useToast } from '@/components/ui/use-toast';
import { usePWAStatus } from '@/hooks/usePWA';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { db } from '@/lib/db/schema';

export default function StorageManager() {
  useLocale();
  const { toast } = useToast();
  const { status: pwaStatus, loading: pwaLoading } = usePWAStatus();

  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [warning, setWarning] = useState<StorageWarning | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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

  const handleClearAllData = async () => {
    setIsClearing(true);
    try {
      // Clear IndexedDB
      await db.delete();
      
      // Clear Cache Storage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }
      
      // Clear localStorage
      localStorage.clear();
      
      logger.info('All data cleared');
      toast({
        title: I18n.settings.storage.clearSuccess,
      });
      
      // Reload storage usage
      await loadStorageUsage();
      
      // Redirect to home (user will need to sign in again)
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error) {
      logger.error('Failed to clear data', { error });
      toast({
        title: I18n.settings.storage.clearError,
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
      setShowClearDialog(false);
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
    <>
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

          {/* PWA Status */}
          <Stack gap="sm">
            <Stack direction="horizontal" gap="sm" align="center">
              <Smartphone className="w-5 h-5" aria-hidden="true" />
              <Text>{I18n.settings.storage.pwa.title}</Text>
            </Stack>
            <Stack direction="horizontal" align="center" gap="sm">
              {pwaLoading ? (
                <Badge variant="secondary">{I18n.settings.storage.loading}</Badge>
              ) : pwaStatus?.isPWAInstalled ? (
                <Badge variant="default">{I18n.settings.storage.pwa.installed}</Badge>
              ) : (
                <Badge variant="secondary">{I18n.settings.storage.pwa.notInstalled}</Badge>
              )}
              <Text variant="caption" className="text-muted-foreground">
                {I18n.settings.storage.pwa.description}
              </Text>
            </Stack>
          </Stack>

          <Separator />

          {/* Warning Banner */}
          {warning && (
            <Alert variant={warning.level === 'critical' ? 'destructive' : 'warning'}>
              <Stack direction="horizontal" gap="sm" align="center">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <AlertDescription>{warning.message}</AlertDescription>
              </Stack>
            </Alert>
          )}

          {/* Global Storage Status */}
          <Stack gap="sm">
            <Stack gap="xs">
              <Text>{I18n.settings.storage.globalTitle}</Text>
              <Text variant="caption" className="text-muted-foreground">
                {I18n.settings.storage.globalNote}
              </Text>
            </Stack>
            
            <Stack direction="horizontal" align="center" justify="between">
              <Text>
                {storageMonitor.formatBytes(usage.usage)} / {storageMonitor.formatBytes(usage.quota)}
              </Text>
              <Badge variant={badgeVariant}>
                {usage.usagePercent.toFixed(1)}%
              </Badge>
            </Stack>

            <Progress value={usage.usagePercent} variant={progressVariant} />
          </Stack>

          <Separator />

          {/* Clear All Data */}
          <Stack gap="sm">
            <Stack gap="xs">
              <Text>{I18n.settings.storage.clearAllTitle}</Text>
              <Text variant="caption" className="text-muted-foreground">
                {I18n.settings.storage.clearAllDescription}
              </Text>
            </Stack>
            
            <Button
              variant="destructive"
              onClick={() => setShowClearDialog(true)}
              disabled={isLoading || isClearing}
              className="w-fit"
            >
              <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
              {I18n.settings.storage.clearAllButton}
            </Button>
          </Stack>
        </Stack>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{I18n.settings.storage.clearDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {I18n.settings.storage.clearDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>
              {I18n.settings.storage.clearDialog.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllData}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? I18n.settings.storage.clearDialog.clearing : I18n.settings.storage.clearDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
