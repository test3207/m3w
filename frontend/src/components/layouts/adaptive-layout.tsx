'use client';

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { useDashboardLayout } from "./use-dashboard-layout";

type AdaptiveLayoutContextValue = {
  sections: Map<
    string,
    {
      size: number;
      base: number;
      min: number;
      belowMin: boolean;
    }
  >;
  availableHeight: number;
};

const AdaptiveLayoutContext = React.createContext<AdaptiveLayoutContextValue | null>(null);

function useAdaptiveLayoutContext() {
  const context = React.useContext(AdaptiveLayoutContext);

  if (!context) {
    throw new Error("AdaptiveSection must be used within AdaptiveLayout");
  }

  return context;
}

type AdaptiveLayoutProps = {
  id?: string;
  gap?: number;
  className?: string;
  children: React.ReactNode;
};

type AdaptiveLayoutItem = {
  id: string;
  base: number;
  min: number;
};

type AdaptiveSectionRender = (allocatedSize: number) => React.ReactNode;

type AdaptiveSectionProps = {
  id: string;
  baseSize: number;
  minSize: number;
  allowOverflow?: boolean;
  className?: string;
  children: React.ReactNode | AdaptiveSectionRender;
};

function computeAllocations(items: AdaptiveLayoutItem[], available: number) {
  if (items.length === 0) {
    return [] as number[];
  }

  const allocations = items.map((item) => item.base);
  const minimums = items.map((item) => item.min);

  const constrainedAvailable = Number.isFinite(available) && available > 0 ? available : 0;
  const totalBase = allocations.reduce((sum, size) => sum + size, 0);
  const totalMin = minimums.reduce((sum, size) => sum + size, 0);

  if (totalBase <= constrainedAvailable) {
    const result = [...allocations];
    if (items.length > 0) {
      result[result.length - 1] += constrainedAvailable - totalBase;
    }
    return result;
  }

  if (totalMin >= constrainedAvailable) {
    const result = [...minimums];
    let residual = totalMin - constrainedAvailable;

    for (let index = result.length - 1; index >= 0 && residual > 0; index -= 1) {
      const reducible = Math.min(residual, result[index]);
      result[index] = Math.max(result[index] - reducible, 0);
      residual -= reducible;
    }

    return result;
  }

  const target = constrainedAvailable;
  let shortage = totalBase - target;
  const result = [...allocations];

  while (shortage > 0) {
    const adjustableIndices = result
      .map((size, index) => ({ size, index }))
      .filter(({ size, index }) => size > minimums[index] + 0.5);

    if (adjustableIndices.length === 0) {
      break;
    }

    const share = shortage / adjustableIndices.length;
    let consumed = 0;

    for (const { index } of adjustableIndices) {
      const min = minimums[index];
      const nextSize = result[index] - share;

      if (nextSize <= min) {
        consumed += result[index] - min;
        result[index] = min;
      } else {
        consumed += share;
        result[index] = nextSize;
      }
    }

    if (consumed <= 0.0001) {
      break;
    }

    shortage = Math.max(shortage - consumed, 0);
  }

  const assignedTotal = result.reduce((sum, size) => sum + size, 0);
  let residual = assignedTotal - target;

  for (let index = result.length - 1; index >= 0 && residual > 0; index -= 1) {
    const reducible = Math.min(residual, result[index]);
    result[index] = Math.max(result[index] - reducible, 0);
    residual -= reducible;
  }

  return result.map((size) => (Number.isFinite(size) && size >= 0 ? size : 0));
}

export function AdaptiveLayout({ id, gap = 16, className, children }: AdaptiveLayoutProps) {
  const layout = useDashboardLayout();
  const childElements = React.useMemo(
    () => React.Children.toArray(children) as Array<React.ReactElement<AdaptiveSectionProps>>,
    [children]
  );

  const items = React.useMemo<AdaptiveLayoutItem[]>(
    () =>
      childElements.map((child) => ({
        id: child.props.id,
        base: child.props.baseSize,
        min: child.props.minSize,
      })),
    [childElements]
  );

  const gapTotal = Math.max(childElements.length - 1, 0) * gap;
  const availableHeight = Math.max(layout.availableHeight - gapTotal, 0);

  const allocations = React.useMemo(
    () => computeAllocations(items, availableHeight),
    [items, availableHeight]
  );

  const sections = React.useMemo(
    () => {
      const map = new Map<string, { size: number; base: number; min: number; belowMin: boolean }>();

      childElements.forEach((child, index) => {
        const assigned = allocations[index] ?? child.props.baseSize;
        const belowMin = assigned + 0.5 < child.props.minSize;

        map.set(child.props.id, {
          size: assigned,
          base: child.props.baseSize,
          min: child.props.minSize,
          belowMin,
        });
      });

      return map;
    },
    [allocations, childElements]
  );

  const contextValue = React.useMemo<AdaptiveLayoutContextValue>(
    () => ({
      sections,
      availableHeight,
    }),
    [sections, availableHeight]
  );

  return (
    <AdaptiveLayoutContext.Provider value={contextValue}>
      <div
        id={id}
        className={cn("flex h-full w-full flex-col overflow-hidden", className)}
        style={{ gap: `${gap}px` }}
        data-adaptive-layout
      >
        {childElements.map((child) =>
          React.cloneElement(child, {
            key: child.props.id,
          })
        )}
      </div>
    </AdaptiveLayoutContext.Provider>
  );
}

export function AdaptiveSection({
  id,
  baseSize,
  allowOverflow = false,
  className,
  children,
}: AdaptiveSectionProps) {
  const context = useAdaptiveLayoutContext();
  const entry = context.sections.get(id);
  const allocated = entry?.size ?? baseSize;
  const resolvedChildren =
    typeof children === "function"
      ? (children as AdaptiveSectionRender)(allocated)
      : children;

  return (
    <div
  data-adaptive-section={id}
  data-below-min={entry?.belowMin ? "true" : undefined}
  className={cn("shrink-0", allowOverflow ? "overflow-visible" : "overflow-hidden", className)}
      style={{
        height: `${Math.max(allocated, 0)}px`,
        minHeight: `${Math.max(allocated, 0)}px`,
        flexBasis: `${Math.max(allocated, 0)}px`,
      }}
    >
      {resolvedChildren}
    </div>
  );
}

AdaptiveLayout.displayName = "AdaptiveLayout";
AdaptiveSection.displayName = "AdaptiveSection";
