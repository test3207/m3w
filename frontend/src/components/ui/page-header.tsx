import * as React from "react";
import { VStack } from "./stack";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Main heading text
   */
  title: string;
  /**
   * Optional description text
   */
  description?: string;
  /**
   * Optional action buttons
   */
  actions?: React.ReactNode;
}

/**
 * PageHeader component - consistent page title section
 * Uses semantic header element for better accessibility
 */
export const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  ({ title, description, actions, className, ...props }, ref) => {
    return (
      <header ref={ref} className={cn("space-y-4", className)} {...props}>
        <div className="flex items-start justify-between gap-4">
          <VStack gap="xs">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </VStack>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </header>
    );
  }
);

PageHeader.displayName = "PageHeader";
