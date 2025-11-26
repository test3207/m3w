/**
 * Progress Component
 * 
 * A horizontal progress bar with semantic color variants
 * Based on Radix UI Progress with Tailwind styling
 */

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

export interface ProgressProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    'value'
  > {
  value?: number;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value = 0, variant = 'default', ...props }, ref) => {
  const variantStyles = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    destructive: 'bg-destructive',
  };

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-muted',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 transition-all',
          variantStyles[variant]
        )}
        style={{ transform: `translateX(-${100 - Math.min(value, 100)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});

Progress.displayName = 'Progress';

export { Progress };
