'use client';

import * as React from "react";
import { DashboardLayoutProvider, type DashboardLayoutContextValue } from "./use-dashboard-layout";

type DashboardLayoutShellProps = {
  header: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export function DashboardLayoutShell({ header, footer, children }: DashboardLayoutShellProps) {
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const footerRef = React.useRef<HTMLDivElement | null>(null);
  const miniPlayerHeightRef = React.useRef(0);
  const footerHeightRef = React.useRef(0);

  const [layout, setLayout] = React.useState<DashboardLayoutContextValue>({
    availableHeight: 0,
    availableWidth: 0,
    headerHeight: 0,
    footerHeight: 0,
  });

  const recompute = React.useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0;
    const measuredFooterHeight = footerRef.current?.getBoundingClientRect().height ?? 0;
    footerHeightRef.current = measuredFooterHeight;
    const footerHeight = Math.max(measuredFooterHeight, miniPlayerHeightRef.current);

    const availableHeight = Math.max(window.innerHeight - headerHeight - footerHeight, 0);
    const availableWidth = window.innerWidth;

    setLayout({
      availableHeight,
      availableWidth,
      headerHeight,
      footerHeight,
    });
  }, []);

  React.useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => recompute();
    const handleMiniPlayerEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ height: number }>;
      const height = customEvent.detail?.height ?? 0;
      miniPlayerHeightRef.current = height;
      recompute();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("dashboard:mini-player-height", handleMiniPlayerEvent as EventListener);

    const headerObserver = new ResizeObserver(() => {
      recompute();
    });

    const footerObserver = new ResizeObserver(() => {
      const measured = footerRef.current?.getBoundingClientRect().height ?? 0;
      footerHeightRef.current = measured;
      recompute();
    });

    if (headerRef.current) {
      headerObserver.observe(headerRef.current);
    }

    if (footerRef.current) {
      footerObserver.observe(footerRef.current);
    }

    recompute();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("dashboard:mini-player-height", handleMiniPlayerEvent as EventListener);

      headerObserver.disconnect();
      footerObserver.disconnect();
    };
  }, [recompute]);

  const contextValue = React.useMemo(() => layout, [layout]);
  const layoutStyle = React.useMemo(
    () =>
      ({
        "--dashboard-available-height": `${layout.availableHeight}px`,
        "--dashboard-available-width": `${layout.availableWidth}px`,
      }) as React.CSSProperties,
    [layout.availableHeight, layout.availableWidth]
  );

  return (
    <DashboardLayoutProvider value={contextValue}>
      <div
        className="flex min-h-screen max-h-screen flex-col overflow-hidden bg-background"
        style={layoutStyle}
      >
        <div ref={headerRef} data-dashboard-header className="shrink-0">
          {header}
        </div>
        <div className="flex-1 min-h-0 overflow-hidden" data-dashboard-body>
          {children}
        </div>
        <div ref={footerRef} data-dashboard-footer className="shrink-0">
          {footer}
        </div>
      </div>
    </DashboardLayoutProvider>
  );
}
