/**
 * Floating Action Button (FAB)
 * Global upload button for mobile
 */

import { Plus } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

export function FloatingActionButton() {
  const openUploadDrawer = useUIStore((state) => state.openUploadDrawer);

  return (
    <button
      onClick={openUploadDrawer}
      className={cn(
        'fixed bottom-36 right-4 z-50',
        'flex h-14 w-14 items-center justify-center rounded-full',
        'bg-primary text-primary-foreground shadow-lg',
        'transition-transform hover:scale-110',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
      )}
      aria-label="Upload music"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
