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
import { RefreshCw, Database, AlertTriangle, Trash2, Info } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
        <Stack gap="sm" className="p-4">
          {/* Header */}
          <Stack direction="horizontal" align="center" justify="between">
            <Stack direction="horizontal" gap="sm" align="center">
              <Database className="w-4 h-4 text-muted-foreground" />
              <Text variant="body" className="font-medium">Storage</Text>
              {/* PWA Status Badge */}
              {!pwaLoading && (
                <>
                  <Badge 
                    variant={pwaStatus?.isPWAInstalled ? 'default' : 'secondary'}
                    className="text-xs h-5"
                  >
                    PWA
                  </Badge>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                        <Info className="h-3 w-3 text-muted-foreground" />
                        <span className="sr-only">PWA info</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56">
                      <Stack gap="xs">
                        <Text variant="caption" className="font-medium text-xs">
                          {pwaStatus?.isPWAInstalled 
                            ? I18n.settings.storage.pwa.installed 
                            : I18n.settings.storage.pwa.notInstalled}
                        </Text>
                        <Text variant="caption" className="text-muted-foreground">
                          {I18n.settings.storage.pwa.description}
                        </Text>
                      </Stack>
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </Stack>
            
            <Stack direction="horizontal" gap="xs">
              {/* Clear All Data Button (Icon only) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowClearDialog(true)}
                disabled={isLoading || isClearing}
                aria-label={I18n.settings.storage.clearAllButton}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>

              {/* Refresh Button */}
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
          </Stack>

          {/* Warning Banner */}
          {warning && (
            <Alert variant={warning.level === 'critical' ? 'destructive' : 'warning'}>
              <Stack direction="horizontal" gap="sm" align="center">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <AlertDescription>{warning.message}</AlertDescription>
              </Stack>
            </Alert>
          )}

          {/* Storage Usage */}
          <Stack gap="xs">
            <Stack direction="horizontal" align="center" justify="between">
              <Text variant="caption">
                {storageMonitor.formatBytes(usage.usage)} / {storageMonitor.formatBytes(usage.quota)}
              </Text>
              <Badge variant={badgeVariant} className="text-xs h-5">
                {usage.usagePercent.toFixed(1)}%
              </Badge>
            </Stack>

            <Progress value={usage.usagePercent} variant={progressVariant} />
            
            {/* Info Note */}
            <Text variant="caption" className="text-muted-foreground">
              {I18n.settings.storage.globalNote}
            </Text>
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
