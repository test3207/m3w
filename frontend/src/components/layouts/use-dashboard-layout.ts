import * as React from "react";

export interface DashboardLayoutContextValue {
  availableHeight: number;
  availableWidth: number;
  headerHeight: number;
  footerHeight: number;
}

const DashboardLayoutContext = React.createContext<DashboardLayoutContextValue | null>(null);

export const DashboardLayoutProvider = DashboardLayoutContext.Provider;

export function useDashboardLayout(): DashboardLayoutContextValue {
  const context = React.useContext(DashboardLayoutContext);

  if (!context) {
    throw new Error("useDashboardLayout must be used within DashboardLayoutShell");
  }

  return context;
}
