import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Users,
  CreditCard,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Globe,
  LogOut
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/common/AppLogo';

export interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { t, language, toggleLanguage, isRTL } = useDirection();
  const { isDark, setTheme } = useTheme();
  const { signOut } = useAuth();

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, exact: true },
    { to: '/invoices', label: t('nav.invoices'), icon: FileText },
    { to: '/expenses', label: t('nav.expenses'), icon: Receipt },
    { to: '/customers', label: t('nav.customers'), icon: Users },
    { to: '/payments', label: t('nav.payments'), icon: CreditCard },
    { to: '/statements', label: t('nav.statements'), icon: FileSpreadsheet },
    { to: '/settings', label: t('nav.settings'), icon: Settings }
  ];

  return (
    <aside
      data-testid="app-sidebar"
      className={`
        hidden lg:flex flex-col
        border-e border-slate-200 dark:border-slate-800
        bg-white dark:bg-slate-900
        transition-all duration-200 select-none
        ${collapsed ? 'w-20' : 'w-60'} shrink-0
        ${className}
      `}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 shadow-sm border border-emerald-500/40">
            <AppLogo className="w-full h-full" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {t('app.name')}
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                {language === 'ar' ? 'دون اتصال' : 'Offline First'}
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle button with RTL icon mirror */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={collapsed ? t('action.expand') : t('action.collapse')}
          aria-label="Toggle Sidebar"
        >
          {collapsed ? (
            <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          ) : (
            <ChevronLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `
                sidebar-link flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium
                transition-colors group
                ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                }
              `}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Controls: Language & Theme Switches */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          data-testid="lang-switch-btn"
          className={`
            w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-400
            hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors
          `}
          title={language === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
        >
          <Globe className="w-4 h-4 shrink-0 text-slate-400" />
          {!collapsed && (
            <span className="truncate">
              {language === 'en' ? 'العربية' : 'English'}
            </span>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          data-testid="theme-toggle-btn"
          className={`
            w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-400
            hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors
          `}
          title={isDark ? t('theme.light') : t('theme.dark')}
        >
          {isDark ? (
            <Sun className="w-4 h-4 shrink-0 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 shrink-0 text-slate-400" />
          )}
          {!collapsed && (
            <span className="truncate">
              {isDark ? t('theme.light') : t('theme.dark')}
            </span>
          )}
        </button>

        {/* Sign Out Button */}
        <button
          onClick={signOut}
          className={`
            w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md text-xs text-rose-600 dark:text-rose-400
            hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors
          `}
          title={language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
          {!collapsed && (
            <span className="truncate font-medium">
              {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};
