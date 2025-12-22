/**
 * Demo Resource Service
 * 
 * Uses raw fetch instead of apiClient to avoid logging expected 404 errors
 * when demo mode is not enabled on the backend.
 */

import { API_BASE_URL } from "@/lib/api/config";
import { MAIN_API_ENDPOINTS } from "../endpoints";
import type { StorageUsageInfo } from "@m3w/shared";
import type { ApiResponse } from "../types";

export const demo = {
  /**
   * Get current storage usage information
   * 
   * Note: This endpoint returns 404 when demo mode is disabled.
   * We use raw fetch to avoid logging this expected error.
   */
  getStorageInfo: async (): Promise<StorageUsageInfo> => {
    const url = `${API_BASE_URL}${MAIN_API_ENDPOINTS.demo.storage}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Demo API unavailable: ${response.status}`);
    }
    
    const data: ApiResponse<StorageUsageInfo> = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(data.error || "Failed to get storage info");
    }
    
    return data.data;
  },
};
