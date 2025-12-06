/**
 * StorageManager Component - PWA Status & Global Storage Management
 * 
 * Compact UI for:
 * 1. PWA installation (clickable badge)
 * 2. Global browser storage usage
 * 3. Clear all data option
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
import { RefreshCw, Database, AlertTriangle, Trash2, Download, Info } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { I18n } from '@/locales/i18n';
import { useToast } from '@/components/ui/use-toast';
import { usePWAStatus, usePWAInstall } from '@/hooks/usePWA';
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
  const { toast } = useToast();
  const { status: pwaStatus, loading: pwaLoading } = usePWAStatus();
  const { canInstall, installing, install } = usePWAInstall();

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

  const handleInstallPWA = async () => {
    const success = await install();
    if (success) {
      toast({ title: I18n.settings.storage.pwa.installSuccess });
    }
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
      
      // Show success toast briefly
      toast({
        title: I18n.settings.storage.clearSuccess,
        duration: 1000, // Show for 1 second
      });
      
      // Redirect immediately after toast (user will need to sign in again)
      // Use replace to prevent back navigation to this page
      setTimeout(() => {
        window.location.replace('/');
      }, 1000);
    } catch (error) {
      logger.error('Failed to clear data', { error });
      toast({
        title: I18n.settings.storage.clearError,
        variant: 'destructive',
      });
      setIsClearing(false);
      setShowClearDialog(false);
    }
    // Don't reset clearing state if successful - let redirect happen
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
      <Card className="p-4">
        <Stack gap="sm">
          {/* Header */}
          <Stack direction="horizontal" align="center" justify="between">
            <Stack direction="horizontal" gap="sm" align="center">
              <Database className="w-4 h-4 text-muted-foreground" />
              <Text variant="body" className="font-medium">Storage</Text>
              {/* PWA Status Badge - clickable if can install */}
              {!pwaLoading && (
                <Stack direction="horizontal" gap="xs" align="center">
                  {pwaStatus?.isPWAInstalled ? (
                    <Badge variant="default" className="text-xs h-5">PWA</Badge>
                  ) : canInstall ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 px-2 text-xs gap-1"
                      onClick={handleInstallPWA}
                      disabled={installing}
                    >
                      <Download className="h-3 w-3" />
                      {installing ? '...' : I18n.settings.storage.pwa.install}
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="text-xs h-5">PWA</Badge>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                        <Info className="h-3 w-3 text-muted-foreground" />
                        <span className="sr-only">Info</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64">
                      <Text variant="caption" className="text-muted-foreground">
                        {I18n.settings.storage.pwa.installBenefit}
                      </Text>
                    </PopoverContent>
                  </Popover>
                </Stack>
              )}
            </Stack>
            
            <Stack direction="horizontal" gap="xs">
              {/* Clear All Data Button */}
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
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </Stack>
          </Stack>

          {/* Warning Banner */}
          {warning && (
            <Alert variant={warning.level === 'critical' ? 'destructive' : 'warning'}>
              <Stack direction="horizontal" gap="sm" align="center">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
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
