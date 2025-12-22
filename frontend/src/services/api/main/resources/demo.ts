/**
 * Demo Resource Service
 */

import { mainApiClient } from "../client";
import { MAIN_API_ENDPOINTS } from "../endpoints";
import type { StorageUsageInfo } from "@m3w/shared";

export const demo = {
  /**
   * Get current storage usage information
   * 
   * Note: This endpoint returns 404 when demo mode is disabled.
   * Uses silent option to avoid logging expected errors.
   */
  getStorageInfo: async (): Promise<StorageUsageInfo> => {
    return mainApiClient.get<StorageUsageInfo>(MAIN_API_ENDPOINTS.demo.storage, { silent: true });
  },
};
