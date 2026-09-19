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
  Menu,
  X,
  Globe,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { SyncBadge } from '@/components/common/SyncBadge';
import { UpdateBadge } from '@/components/common/UpdateBadge';

export const MobileNav: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t, language, toggleLanguage, isRTL } = useDirection();
  const { isDark, setTheme, toggleTheme } = useTheme();
  const { currentAccount, signOut } = useAuth();

  const primaryTabs = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, exact: true },
    { to: '/invoices', label: t('nav.invoices'), icon: FileText },
    { to: '/customers', label: t('nav.customers'), icon: Users },
    { to: '/payments', label: t('nav.payments'), icon: CreditCard }
  ];

  const drawerItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, exact: true },
    { to: '/invoices', label: t('nav.invoices'), icon: FileText },
    { to: '/expenses', label: t('nav.expenses'), icon: Receipt },
    { to: '/customers', label: t('nav.customers'), icon: Users },
    { to: '/payments', label: t('nav.payments'), icon: CreditCard },
    { to: '/statements', label: t('nav.statements'), icon: FileSpreadsheet },
    { to: '/settings', label: t('nav.settings'), icon: Settings }
  ];

  return (
    <>
      {/* Mobile Top Header (h-12) */}
      <header className="lg:hidden h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md overflow-hidden flex items-center justify-center shrink-0 border border-emerald-500/30">
            <img src="/icon.png" alt="App Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {t('app.name')}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Cloud Auto-Update button on mobile view */}
          <UpdateBadge />
          <SyncBadge compact />
          <button
            onClick={toggleLanguage}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
            aria-label="Language"
          >
            {language === 'en' ? 'ع' : 'EN'}
          </button>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(true)}
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (h-14) */}
      <nav
        aria-label="Mobile Navigation Bar"
        className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 z-30 flex items-center justify-around px-1 select-none"
      >
        {primaryTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.exact}
              className={({ isActive }) => `
                flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors
                ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }
              `}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate max-w-[64px]">{tab.label}</span>
            </NavLink>
          );
        })}
        <button
          onClick={() => setIsOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800"
        >
          <Menu className="w-4 h-4 mb-0.5" />
          <span>{language === 'ar' ? 'المزيد' : 'More'}</span>
        </button>
      </nav>

      {/* Slide-over Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Panel */}
          <div
            className={`
              relative w-72 max-w-[80vw] bg-white dark:bg-slate-900 h-full shadow-xl flex flex-col z-10
              ${isRTL ? 'ms-auto' : 'me-auto'}
            `}
          >
            {/* Drawer Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-md bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                  M
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {t('app.name')}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
              {drawerItems.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                      ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>

            {/* Bottom Controls */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <button
                onClick={() => {
                  toggleLanguage();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  {language === 'ar' ? 'اللغة' : 'Language'}
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {language === 'en' ? 'العربية' : 'English'}
                </span>
              </button>

              <button
                onClick={() => {
                  toggleTheme();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <span className="flex items-center gap-2">
                  {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-400" />}
                  {language === 'ar' ? 'المظهر' : 'Theme'}
                </span>
                <span className="font-semibold text-slate-500">
                  {isDark ? t('theme.light') : t('theme.dark')}
                </span>
              </button>

              <button
                onClick={() => {
                  signOut();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="w-4 h-4 text-rose-500" />
                  {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
                </span>
                {currentAccount && (
                  <span className="text-[10px] font-semibold truncate max-w-[100px]">
                    {currentAccount.name}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
