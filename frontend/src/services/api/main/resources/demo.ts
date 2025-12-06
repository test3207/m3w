/**
 * Demo Resource Service
 */

import { mainApiClient } from "../client";
import { MAIN_API_ENDPOINTS } from "../endpoints";
import type { StorageUsageInfo } from "@m3w/shared";

export const demo = {
  /**
   * Get current storage usage information
   */
  getStorageInfo: async (): Promise<StorageUsageInfo> => {
    return mainApiClient.get<StorageUsageInfo>(MAIN_API_ENDPOINTS.demo.storage);
  },
};
