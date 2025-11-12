import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Direction of the stack
   */
  direction?: "horizontal" | "vertical";
  /**
   * Spacing between items (Tailwind gap values)
   */
  gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  /**
   * Alignment of items along the main axis
   */
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  /**
   * Alignment of items along the cross axis
   */
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  /**
   * Whether items should wrap
   */
  wrap?: boolean;
  /**
   * Whether to render as semantic element
   */
  as?:
    | "div"
    | "section"
    | "article"
    | "nav"
    | "header"
    | "footer"
    | "main"
    | "aside";
}

const gapMap = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
};

const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const justifyMap = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
};

/**
 * Stack component - provides flexible box layout similar to FluentUI Stack
 * Improves accessibility by reducing div soup and providing semantic options
 */
export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      direction = "vertical",
      gap = "md",
      align = "stretch",
      justify = "start",
      wrap = false,
      as: Component = "div",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const directionClass = direction === "horizontal" ? "flex-row" : "flex-col";

    return (
      <Component
        ref={ref}
        className={cn(
          "flex",
          directionClass,
          gapMap[gap],
          alignMap[align],
          justifyMap[justify],
          wrap && "flex-wrap",
          className
        )}
        {...props}
      >
        {children}
      </Component>
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
