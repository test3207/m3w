import * as React from "react";
import { cn } from "@/lib/utils";

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Direction of the stack
   */
  direction?: "horizontal" | "vertical";
  /**
   * Spacing between children
   */
  gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  /**
   * Alignment of children along the cross axis
   */
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  /**
   * Justification of children along the main axis
   */
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  /**
   * Whether children should wrap
   */
  wrap?: boolean;
  /**
   * Whether to fill available space
   */
  fill?: boolean;
}

const gapClasses = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
};

const alignClasses = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const justifyClasses = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
};

/**
 * Stack component - provides flexible box layout similar to FluentUI Stack
 */
export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      direction = "vertical",
      gap = "md",
      align = "stretch",
      justify = "start",
      wrap = false,
      fill = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex",
          direction === "horizontal" ? "flex-row" : "flex-col",
          gapClasses[gap],
          alignClasses[align],
          justifyClasses[justify],
          wrap && "flex-wrap",
          fill && (direction === "horizontal" ? "w-full" : "h-full"),
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Stack.displayName = "Stack";

/**
 * HStack - Horizontal stack shorthand
 */
export const HStack = React.forwardRef<
  HTMLDivElement,
  Omit<StackProps, "direction">
>((props, ref) => <Stack ref={ref} direction="horizontal" {...props} />);

HStack.displayName = "HStack";

/**
 * VStack - Vertical stack shorthand
 */
export const VStack = React.forwardRef<
  HTMLDivElement,
  Omit<StackProps, "direction">
>((props, ref) => <Stack ref={ref} direction="vertical" {...props} />);

VStack.displayName = "VStack";
