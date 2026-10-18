import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useDirection } from '@/context/DirectionContext';
import { useAuth } from '@/context/AuthContext';
import { QuickAccess } from '@/components/common/QuickAccess';
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { SyncBadge } from '@/components/common/SyncBadge';
import { UpdateBadge } from '@/components/common/UpdateBadge';
import { AccountMenu } from '@/components/common/AccountMenu';

export const AppLayout: React.FC = () => {
  const { t, isRTL } = useDirection();
  const { currentAccount } = useAuth();
  const location = useLocation();
  const section = location.pathname.split('/')[1] || 'dashboard';
  return (
    <div className="app-shell flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* 
        ========================================================================
        FEATURE: In-App Cloud Auto-Updater & Multi-Account Status Bar
        ========================================================================
        - <AccountMenu />: Profile avatar, switch account, and logout.
        - <UpdateBadge />: In-app self update download/install.
        - <SyncBadge />: Offline/Online cloud sync status.
      */}
      <TitleBar>
        <div className="hidden lg:flex items-center gap-2">
        <UpdateBadge />
        <SyncBadge />
        <AccountMenu />
        </div>
      </TitleBar>

      {/* Mobile Top Header */}
      <MobileNav />

      {/* Body: Desktop Sidebar + Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Collapsible Desktop Sidebar (Hidden on mobile) */}
        <Sidebar />

        {/* Main Content Viewport */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <div className="workspace-toolbar flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200/70 dark:border-slate-800">
          <div className="min-w-0"><p className="text-[10px] text-slate-500 truncate">{currentAccount?.name || (isRTL ? 'مساحة العمل' : 'Workspace')}</p><p className="text-sm font-bold truncate">{t(`nav.${section}`)}</p></div>
          <QuickAccess />
        </div>
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
    </div>
  );
};
