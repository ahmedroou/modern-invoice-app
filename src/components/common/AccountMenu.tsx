import React, { useState, useRef, useEffect } from 'react';
import { LogOut, RefreshCw, Plus, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useDirection } from '@/context/DirectionContext';

export const AccountMenu: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { currentAccount, accounts, switchAccount, signOut } = useAuth();
  const { language } = useDirection();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAr = language === 'ar';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentAccount) return null;

  const firstLetter = currentAccount.name.charAt(0).toUpperCase();

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      {/* Account Trigger Button */}
      <button
        type="button"
        data-testid="account-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-1.5 px-2 py-1 rounded-lg
          bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60
          text-slate-200 text-xs font-medium transition-all select-none
        "
        title={isAr ? `الحساب الحالي: ${currentAccount.name}` : `Current Account: ${currentAccount.name}`}
      >
        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
          {firstLetter}
        </div>
        <span className="truncate max-w-[110px] font-semibold">
          {currentAccount.name}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="
            absolute end-0 top-full mt-1.5 w-64 rounded-xl
            bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50
            text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100
          "
        >
          {/* Header with Account Info */}
          <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
              {isAr ? 'الحساب النشط حالياً' : 'Active Account'}
            </div>
            <div className="font-bold text-slate-100 truncate text-sm">
              {currentAccount.name}
            </div>
            <div className="text-slate-400 text-[11px] truncate">
              {currentAccount.email}
            </div>
            <div className="mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-emerald-400 font-bold border border-slate-700">
              {currentAccount.currency}
            </div>
          </div>

          {/* Switch Account Section (if multiple exist) */}
          {accounts.length > 1 && (
            <div className="px-1 py-1">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                <span>{isAr ? 'تبديل إلى حساب آخر' : 'Switch Account'}</span>
              </div>
              <div className="space-y-0.5 max-h-36 overflow-y-auto">
                {accounts.map(acc => {
                  const isActive = acc.id === currentAccount.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      disabled={isActive}
                      onClick={() => {
                        switchAccount(acc.id);
                        setIsOpen(false);
                      }}
                      className={`
                        w-full text-start px-2 py-1.5 rounded-lg flex items-center justify-between text-xs
                        transition-all ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                            : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-4 h-4 rounded-full bg-slate-800 text-[9px] font-bold flex items-center justify-center shrink-0">
                          {acc.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{acc.name}</span>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-slate-800/80 mt-1 pt-1 px-1">
            <button
              type="button"
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="
                w-full text-start px-2.5 py-2 rounded-lg flex items-center gap-2
                text-slate-300 hover:text-white hover:bg-slate-800 transition-all
              "
            >
              <Plus className="w-3.5 h-3.5 text-slate-400" />
              <span>{isAr ? 'إنشاء أو إضافة حساب جديد' : 'Add or Switch Account'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="
                w-full text-start px-2.5 py-2 rounded-lg flex items-center gap-2
                text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all font-medium
              "
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
