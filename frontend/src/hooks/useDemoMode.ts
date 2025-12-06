/**
 * Demo Mode Hook
 * 
 * Provides demo mode state that can be shared across components.
 * Used by DemoBanner to render and MobileLayout to calculate heights.
 */

import { useEffect, useState } from "react";
import { demo } from "@/services/api/main/resources/demo";
import { IS_DEMO_BUILD } from "@/lib/demo/constants";

// Demo banner height: py-2 (16px) + content (~24px) + border (1px) ≈ 41px
// Using a safe estimate that covers wrapped content
export const DEMO_BANNER_HEIGHT = 41;

interface DemoModeState {
  isEnabled: boolean;
  isLoading: boolean;
}

/**
 * Hook to check if demo mode is enabled.
 * Returns { isEnabled, isLoading } state.
 */
export function useDemoMode(): DemoModeState {
  const [state, setState] = useState<DemoModeState>({
    isEnabled: false,
    isLoading: IS_DEMO_BUILD, // Only loading if it's a demo build
  });

  useEffect(() => {
    // Not a demo build, no need to check
    if (!IS_DEMO_BUILD) return;

    // Check if demo mode is enabled at runtime
    demo.getStorageInfo()
      .then(() => {
        setState({ isEnabled: true, isLoading: false });
      })
      .catch(() => {
        setState({ isEnabled: false, isLoading: false });
      });
  }, []);

  return state;
}
