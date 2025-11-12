import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Maximum width constraint
   */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full" | "responsive";
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
  as?:
    | "div"
    | "section"
    | "article"
    | "main"
    | "aside"
    | "header"
    | "footer"
    | "nav";
}

const maxWidthMap = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-none",
  responsive:
    "max-w-screen-sm sm:max-w-screen-md md:max-w-screen-lg lg:max-w-screen-xl xl:max-w-screen-2xl",
};

const paddingMap = {
  none: "",
  sm: "px-[clamp(4px,1.5vw,12px)] py-[clamp(4px,2vh,14px)]",
  md: "px-[clamp(6px,2vw,16px)] py-[clamp(6px,2.5vh,18px)]",
  lg: "px-[clamp(8px,2.5vw,20px)] py-[clamp(8px,3vh,22px)]",
};

/**
 * Container component - semantic wrapper with max-width constraints
 * Improves accessibility and provides consistent page layout
 */
export const Container = React.forwardRef<HTMLElement, ContainerProps>(
  (
    {
      maxWidth = "responsive",
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
          "w-full",
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
