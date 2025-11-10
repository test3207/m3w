'use client';

import * as React from 'react';
import { DashboardLayoutShell } from './dashboard-layout-shell';
import { DashboardNavbar } from './dashboard-navbar';
import { MiniPlayer } from '@/components/features/mini-player';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <DashboardLayoutShell
      header={<DashboardNavbar />}
      footer={<MiniPlayer />}
    >
      {children}
    </DashboardLayoutShell>
  );
}
