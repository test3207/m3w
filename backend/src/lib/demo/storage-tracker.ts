/**
 * Demo Mode - Storage Tracker
 * 
 * Tracks storage usage in memory for demo environments.
 * Only active when DEMO_STORAGE_LIMIT_ENABLED=true.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import type { StorageUsageInfo } from '@m3w/shared';

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

class StorageTracker {
  private currentUsage: number = 0;
  private limit: number;
  public enabled: boolean;

  constructor() {
    // Runtime check: only enable if environment variable is set
    this.enabled = process.env.DEMO_MODE === 'true';
    this.limit = parseInt(process.env.DEMO_STORAGE_LIMIT || '5368709120', 10);
    
    if (this.enabled) {
      logger.info({ limit: formatBytes(this.limit) }, 'Demo storage limit enabled');
    }
  }

  /**
   * Initialize storage tracker by calculating current usage from database
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    
    try {
      const result = await prisma.file.aggregate({
        _sum: { size: true }
      });
      
      this.currentUsage = result._sum.size || 0;
      
      logger.info({
        currentUsage: formatBytes(this.currentUsage),
        limit: formatBytes(this.limit)
      }, 'Storage tracker initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize storage tracker');
      this.currentUsage = 0;
    }
  }

  /**
   * Increment usage when uploading a new file (non-duplicate)
   */
  incrementUsage(fileSize: number): void {
    if (!this.enabled) {
      return;
    }
    
    this.currentUsage += fileSize;
    
    logger.debug({
      added: formatBytes(fileSize),
      total: formatBytes(this.currentUsage)
    }, 'Storage usage incremented');
  }

  /**
   * Check if a file upload would exceed the storage limit
   */
  canUpload(fileSize: number): boolean {
    if (!this.enabled) {
      return true;
    }
    
    return (this.currentUsage + fileSize) <= this.limit;
  }

  /**
   * Get current storage usage information
   */
  getCurrentUsage(): StorageUsageInfo {
    return {
      used: this.currentUsage,
      limit: this.limit,
      usedFormatted: formatBytes(this.currentUsage),
      limitFormatted: formatBytes(this.limit),
      percentage: (this.limit > 0 ? ((this.currentUsage / this.limit) * 100).toFixed(1) : '0.0')
    };
  }

  /**
   * Reset storage usage (called after demo reset)
   */
  reset(): void {
    this.currentUsage = 0;
    logger.info('Storage tracker reset');
  }
}

// Export singleton instance
export const storageTracker = new StorageTracker();
