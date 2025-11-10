import * as React from "react";
import { VStack } from "./stack";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Icon or illustration
   */
  icon?: React.ReactNode;
  /**
   * Main message
   */
  title: string;
  /**
   * Optional description
   */
  description?: string;
  /**
   * Optional action button
   */
  action?: React.ReactNode;
}

/**
 * EmptyState component - consistent empty state UI
 * Improves UX by providing clear guidance when no data is available
 */
export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label={title}
        className={cn(
          "flex flex-col items-center justify-center py-12 px-4 text-center",
          className
        )}
        {...props}
      >
        <VStack gap="md" align="center">
          {icon && <div className="text-4xl text-muted-foreground">{icon}</div>}
          
          <VStack gap="xs" align="center">
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground max-w-md">
                {description}
              </p>
            )}
          </VStack>

          {action && <div className="mt-4">{action}</div>}
        </VStack>
      </div>
    );
  }
);

EmptyState.displayName = "EmptyState";
