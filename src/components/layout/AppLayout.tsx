import React from 'react';
import { Outlet } from 'react-router-dom';
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { SyncBadge } from '@/components/common/SyncBadge';
import { UpdateBadge } from '@/components/common/UpdateBadge';
import { AccountMenu } from '@/components/common/AccountMenu';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* 
        ========================================================================
        FEATURE: In-App Cloud Auto-Updater & Multi-Account Status Bar
        ========================================================================
        - <AccountMenu />: Profile avatar, switch account, and logout.
        - <UpdateBadge />: In-app self update download/install.
        - <SyncBadge />: Offline/Online cloud sync status.
      */}
      <TitleBar>
        <UpdateBadge />
        <SyncBadge />
        <AccountMenu />
      </TitleBar>

      {/* Mobile Top Header */}
      <MobileNav />

      {/* Body: Desktop Sidebar + Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Collapsible Desktop Sidebar (Hidden on mobile) */}
        <Sidebar />

        {/* Main Content Viewport */}
        <main
          id="app-root"
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 focus:outline-none"
          tabIndex={-1}
        >
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
