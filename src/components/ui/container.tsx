import * as React from "react";
import { cn } from "@/lib/utils";

interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Maximum width constraint
   */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  /**
   * Whether to center the container
   */
  centered?: boolean;
  /**
   * Padding size
   */
  padding?: "none" | "sm" | "md" | "lg";
  /**
   * Semantic HTML element
   */
  as?: "div" | "section" | "article" | "main" | "aside" | "header" | "footer" | "nav";
}

const maxWidthMap = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

const paddingMap = {
  none: "",
  sm: "px-4 py-4",
  md: "px-4 py-8 sm:px-6",
  lg: "px-4 py-12 sm:px-6 lg:px-8",
};

/**
 * Container component - semantic wrapper with max-width constraints
 * Improves accessibility and provides consistent page layout
 */
export const Container = React.forwardRef<HTMLElement, ContainerProps>(
  (
    {
      maxWidth = "xl",
      centered = true,
      padding = "md",
      as: Component = "div",
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Component
        // @ts-expect-error - ref type varies based on `as` prop
        ref={ref}
        className={cn(
          maxWidthMap[maxWidth],
          centered && "mx-auto",
          paddingMap[padding],
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Container.displayName = "Container";

/**
 * Section component - semantic section with optional title
 */
interface SectionProps extends ContainerProps {
  title?: string;
  description?: string;
}

export const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ title, description, children, className, ...props }, ref) => {
    return (
      <Container ref={ref} as="section" className={className} {...props}>
        {(title || description) && (
          <div className="mb-8 space-y-2">
            {title && <h2 className="text-3xl font-semibold">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}
        {children}
      </Container>
    );
  }
);

Section.displayName = "Section";
