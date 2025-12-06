import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";

const textVariants = cva("", {
  variants: {
    variant: {
      h1: "text-4xl font-bold tracking-tight",
      h2: "text-3xl font-semibold tracking-tight",
      h3: "text-2xl font-semibold tracking-tight",
      h4: "text-xl font-semibold tracking-tight",
      h5: "text-lg font-semibold",
      h6: "text-base font-semibold",
      body: "text-sm",
      caption: "text-xs",
      label: "text-sm font-medium",
    },
    color: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      primary: "text-primary",
      destructive: "text-destructive",
      success: "text-green-600",
    },
  },
  defaultVariants: {
    variant: "body",
    color: "default",
  },
});

export interface TextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "color">,
    VariantProps<typeof textVariants> {
  /**
   * HTML element to render
   */
  as?: "p" | "span" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ className, variant, color, as, ...props }, ref) => {
    // Determine which element to use
    let Component: React.ElementType = as || "p";
    
    // Auto-map variant to appropriate HTML element if 'as' not specified
    if (!as) {
      if (variant === "h1") Component = "h1";
      else if (variant === "h2") Component = "h2";
      else if (variant === "h3") Component = "h3";
      else if (variant === "h4") Component = "h4";
      else if (variant === "h5") Component = "h5";
      else if (variant === "h6") Component = "h6";
      else if (variant === "caption" || variant === "label") Component = "span";
      else Component = "p";
    }

    return (
      <Component
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={ref as any}
        className={cn(textVariants({ variant, color }), className)}
        {...props}
      />
    );
  }
);

Text.displayName = "Text";

export { Text };
