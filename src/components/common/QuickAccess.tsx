import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowUpLeft, FileText, UserPlus, CreditCard, LayoutDashboard, Receipt, FileSpreadsheet, Settings, Users } from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';

export const QuickAccess: React.FC = () => {
  const { isRTL, t } = useDirection();
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const commands = [
    { label: t('action.newInvoice'), path: '/invoices?new=1', icon: FileText },
    { label: t('action.newCustomer'), path: '/customers?new=1', icon: UserPlus },
    { label: t('action.recordPayment'), path: '/payments?new=1', icon: CreditCard },
    { label: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
    { label: t('nav.invoices'), path: '/invoices', icon: FileText },
    { label: t('nav.expenses'), path: '/expenses', icon: Receipt },
    { label: t('nav.customers'), path: '/customers', icon: Users },
    { label: t('nav.payments'), path: '/payments', icon: CreditCard },
    { label: t('nav.statements'), path: '/statements', icon: FileSpreadsheet },
    { label: t('nav.settings'), path: '/settings', icon: Settings }
  ];
  const results = commands.filter(command => command.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const open = () => { setQuery(''); setSelected(0); if (!dialog.current?.open) dialog.current?.showModal(); };
  const choose = (path: string) => { dialog.current?.close(); navigate(path); };
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return <>
    <button ref={trigger} type="button" onClick={open} className="quick-access-trigger" data-testid="quick-access-trigger">
      <Search className="w-4 h-4" />
      <span>{isRTL ? 'الوصول السريع' : 'Quick access'}</span>
      <kbd className="hidden sm:inline" dir="ltr">Ctrl K</kbd>
    </button>
    <dialog ref={dialog} className="command-dialog" aria-labelledby="quick-access-title" onClose={() => trigger.current?.focus()} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 id="quick-access-title" className="font-bold">{isRTL ? 'إلى أين تريد الذهاب؟' : 'Where would you like to go?'}</h2>
          <button type="button" aria-label={t('action.close', 'Close')} onClick={() => dialog.current?.close()} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>
        <input autoFocus aria-label={isRTL ? 'البحث عن صفحة أو إجراء' : 'Search pages and actions'} placeholder={isRTL ? 'ابحث عن صفحة أو إجراء…' : 'Search pages and actions…'} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm mb-3" value={query} onChange={event => { setQuery(event.target.value); setSelected(0); }} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setSelected(index => Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
          } else if (event.key === 'Enter' && results[selected]) { event.preventDefault(); choose(results[selected].path); }
        }} />
        <div className="max-h-[50vh] overflow-y-auto space-y-1">
          {results.map((command, index) => <button key={command.path} type="button" onClick={() => choose(command.path)} onMouseEnter={() => setSelected(index)} className={`w-full flex items-center gap-3 rounded-xl p-3 text-start text-sm ${selected === index ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <command.icon className="w-4 h-4" /><span className="flex-1">{command.label}</span><ArrowUpLeft className="w-4 h-4 opacity-40" />
          </button>)}
          {results.length === 0 && <p className="py-8 text-center text-sm text-slate-500">{isRTL ? 'لا توجد نتائج. جرّب كلمة أخرى.' : 'No results. Try another search.'}</p>}
        </div>
        <p className="text-[11px] text-slate-500 mt-4">{isRTL ? '↑ ↓ للتنقل · Enter للفتح · Esc للإغلاق' : '↑ ↓ to navigate · Enter to open · Esc to close'}</p>
      </div>
    </dialog>
  </>;
};
