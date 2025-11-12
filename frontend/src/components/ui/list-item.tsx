import * as React from "react";
import { HStack, VStack } from "./stack";
import { Badge } from "./badge";
import { cn } from "@/lib/utils/cn";

interface ListItemProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Main title
   */
  title: string;
  /**
   * Optional description
   */
  description?: string;
  /**
   * Optional metadata items (badges, tags, etc)
   */
  metadata?: React.ReactNode;
  /**
   * Optional action buttons
   */
  actions?: React.ReactNode;
  /**
   * Whether the item is clickable
   */
  interactive?: boolean;
}

/**
 * ListItem component - consistent list item UI
 * Uses article element for better semantic structure
 */
export const ListItem = React.forwardRef<HTMLElement, ListItemProps>(
  (
    {
      title,
      description,
      metadata,
      actions,
      interactive = false,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <article
        ref={ref}
        className={cn(
          "rounded-lg border border-border px-4 py-3",
          interactive && "cursor-pointer hover:bg-accent/50 transition-colors",
          className
        )}
        {...props}
      >
        <HStack justify="between" align="start">
          <VStack gap="xs" className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {description}
              </p>
            )}
            {metadata && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {metadata}
              </div>
            )}
          </VStack>

          {actions && <div className="shrink-0 ml-4">{actions}</div>}
        </HStack>
      </article>
    );
  }
);

ListItem.displayName = "ListItem";

/**
 * MetadataItem - small metadata badge/label
 */
interface MetadataItemProps {
  label: string;
  value: string | number;
  variant?: "default" | "secondary" | "outline";
}

export function MetadataItem({ label, value, variant = "secondary" }: MetadataItemProps) {
  return (
    <Badge variant={variant} className="text-xs">
      {label}: {value}
    </Badge>
  );
}
