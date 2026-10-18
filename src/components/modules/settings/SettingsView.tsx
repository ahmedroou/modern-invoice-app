import React from 'react';
import { Building2, Palette, Globe, Keyboard, Sun, Moon, Monitor, Check } from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { useTheme, type Theme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { CompactCard } from '@/components/common/CompactCard';
import { SyncBadge } from '@/components/common/SyncBadge';

export const SettingsView: React.FC = () => {
  const { isRTL, language, setLanguage, t } = useDirection();
  const { theme, setTheme } = useTheme();
  const { currentAccount } = useAuth();
  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
    { value: 'system', label: t('theme.system'), icon: Monitor }
  ];
  return <div className="space-y-6" data-testid="settings-view">
    <div><h2 className="text-2xl font-bold">{t('nav.settings')}</h2><p className="text-sm text-slate-500 mt-1">{isRTL ? 'مساحة عمل تناسبك. تُحفظ تفضيلاتك تلقائيًا على هذا الجهاز.' : 'Make this workspace yours. Preferences save automatically on this device.'}</p></div>
    <div className="grid lg:grid-cols-2 gap-5">
      <CompactCard className="space-y-5">
        <h3 className="flex items-center gap-2 font-bold"><Palette className="w-5 h-5 text-emerald-600" />{isRTL ? 'مظهر التطبيق' : 'Appearance'}</h3>
        <div className="grid sm:grid-cols-3 gap-2">{themes.map(option => <button key={option.value} type="button" aria-pressed={theme === option.value} onClick={() => setTheme(option.value)} className={`flex flex-col items-center gap-3 border rounded-xl px-3 py-5 text-xs ${theme === option.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700'}`}><option.icon className="w-6 h-6" />{option.label}{theme === option.value && <Check className="w-3 h-3" />}</button>)}</div>
        <h3 className="flex items-center gap-2 font-bold"><Globe className="w-5 h-5 text-emerald-600" />{isRTL ? 'لغة الواجهة' : 'Language'}</h3>
        <div className="flex gap-2">{(['ar', 'en'] as const).map(value => <button key={value} type="button" aria-pressed={language === value} onClick={() => setLanguage(value)} className={`flex-1 border rounded-xl p-3 text-sm ${language === value ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700'}`}>{value === 'ar' ? 'العربية' : 'English'}</button>)}</div>
      </CompactCard>
      <div className="space-y-5">
        <CompactCard>
          <h3 className="flex items-center gap-2 font-bold mb-4"><Building2 className="w-5 h-5 text-emerald-600" />{isRTL ? 'الحساب الحالي' : 'Current account'}</h3>
          <dl className="space-y-3 text-sm">{[[isRTL ? 'الاسم' : 'Name', currentAccount?.name], [isRTL ? 'البريد أو المعرّف' : 'Email or identifier', currentAccount?.email], [isRTL ? 'عملة الحساب' : 'Account currency', currentAccount?.currency]].map(([label, value]) => <div key={label} className="flex flex-wrap gap-2 justify-between border-b border-slate-100 dark:border-slate-800 pb-3"><dt className="text-slate-500">{label}</dt><dd className="font-semibold break-all"><bdi>{value || '—'}</bdi></dd></div>)}</dl>
          <div className="mt-4"><SyncBadge /></div>
        </CompactCard>
        <CompactCard>
          <h3 className="flex items-center gap-2 font-bold mb-4"><Keyboard className="w-5 h-5 text-emerald-600" />{isRTL ? 'اختصارات تسهّل يومك' : 'Everyday shortcuts'}</h3>
          <div className="space-y-3 text-sm">{[['Ctrl K', isRTL ? 'الوصول السريع من أي صفحة' : 'Quick access from any page'], ['Ctrl N', isRTL ? 'فاتورة جديدة في صفحة الفواتير' : 'New invoice on the invoices page'], ['Esc', isRTL ? 'إغلاق نافذة الوصول السريع' : 'Close quick access']].map(([key, label]) => <div key={key} className="flex items-center justify-between gap-3"><span>{label}</span><kbd dir="ltr" className="border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs shrink-0">{key}</kbd></div>)}</div>
        </CompactCard>
      </div>
    </div>
  </div>;
};
