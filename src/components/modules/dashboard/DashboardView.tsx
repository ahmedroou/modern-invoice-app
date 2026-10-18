import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowUpRight, UserPlus, CreditCard, FileSpreadsheet, FileText, ArrowLeft, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { useAuth } from '@/context/AuthContext';
import { CompactCard } from '@/components/common/CompactCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { MetricsGrid } from './MetricsGrid';
import { ActivityFeed } from './ActivityFeed';

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { t, formatCurrency, isRTL, language } = useDirection();
  const { currentAccount } = useAuth();
  const metrics = useDashboardMetrics({ currency: currentAccount?.currency || 'SAR' });
  const actions = [
    { label: t('action.newInvoice'), description: isRTL ? 'أنشئ فاتورتك في خطوات بسيطة' : 'Create an invoice in a few steps', icon: Plus, path: '/invoices?new=1', testId: 'action-new-invoice' },
    { label: t('action.newCustomer'), description: isRTL ? 'أضف عميلًا وابدأ التعامل' : 'Add a client and get started', icon: UserPlus, path: '/customers?new=1', testId: 'action-new-customer' },
    { label: t('action.recordPayment'), description: isRTL ? 'سجّل التحصيل وحدّث الرصيد' : 'Log a payment and update balances', icon: CreditCard, path: '/payments?new=1' },
    { label: t('nav.statements'), description: isRTL ? 'راجع حركة حسابات العملاء' : 'Review your customer accounts', icon: FileSpreadsheet, path: '/statements' }
  ];
  const rate = Math.max(0, Math.min(100, metrics.collectionRate));
  return <div className="space-y-5 max-w-full" data-testid="dashboard-view">
    <section className="dashboard-hero relative overflow-hidden rounded-2xl p-5 sm:p-7 text-white">
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-emerald-200 mb-2">{new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', calendar: 'gregory' }).format(new Date())}</p>
          <h2 className="text-2xl sm:text-3xl font-bold">{isRTL ? 'كل أعمالك، في ميزان واحد.' : 'Your business, in balance.'}</h2>
          <p className="text-sm text-emerald-100/80 mt-3 max-w-xl">{isRTL ? 'تابع فواتيرك، حصّل مستحقاتك، واحتفظ بصورة واضحة لحساباتك.' : 'Track invoices, collect payments, and keep a clear view of your accounts.'}</p>
        </div>
        <button type="button" onClick={() => navigate('/invoices?new=1')} className="self-start sm:self-center inline-flex items-center gap-2 bg-white text-emerald-800 hover:bg-emerald-50 px-4 py-3 rounded-xl text-sm font-bold shadow-lg"><Plus className="w-4 h-4" />{t('action.newInvoice')}</button>
      </div>
    </section>
    {metrics.error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950 p-4 text-sm text-rose-700 dark:text-rose-300">{isRTL ? 'تعذّر تحميل ملخص الحساب. تحقق من الاتصال ثم أعد فتح الصفحة.' : 'Could not load the account summary. Check your connection and reopen this page.'}</div>}
    <MetricsGrid metrics={metrics} />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {actions.map(action => <button type="button" key={action.path} data-testid={action.testId} onClick={() => navigate(action.path)} className="action-tile text-start p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-3 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors">
        <span className="flex items-center justify-between"><span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><action.icon className="w-4 h-4" /></span><ArrowUpRight className={`w-4 h-4 text-slate-400 ${isRTL ? '-rotate-90' : ''}`} /></span>
        <span><span className="block font-bold text-sm">{action.label}</span><span className="block text-[11px] text-slate-500 mt-1 leading-relaxed">{action.description}</span></span>
      </button>)}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 space-y-5">
        <CompactCard data-testid="recent-invoices-card">
          <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-600" /><h3 className="text-sm font-bold">{isRTL ? 'أحدث الفواتير' : 'Recent invoices'}</h3></div><button type="button" onClick={() => navigate('/invoices')} className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{isRTL ? 'عرض الكل' : 'View all'}</button></div>
          {metrics.isLoading ? <div role="status" className="space-y-3 animate-pulse"><span className="sr-only">{t('status.loading', 'Loading')}</span>{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div> : metrics.recentInvoices.length === 0 ? <div className="py-8 text-center"><FileText className="w-9 h-9 text-slate-300 mx-auto mb-3" /><p className="text-sm font-semibold">{isRTL ? 'ابدأ بفاتورتك الأولى' : 'Start with your first invoice'}</p><p className="text-xs text-slate-500 mt-2 mb-4">{isRTL ? 'ستظهر هنا أحدث فواتيرك وحالة تحصيلها.' : 'Your latest invoices and payment status will appear here.'}</p><button type="button" onClick={() => navigate('/invoices?new=1')} className="text-xs font-bold text-emerald-600">{t('action.newInvoice')}</button></div> : <div className="space-y-2">{metrics.recentInvoices.map(inv => <button type="button" key={inv.id} data-testid={`recent-invoice-row-${inv.id}`} onClick={() => navigate(`/invoices?id=${encodeURIComponent(inv.id)}`)} className="w-full flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-start">
            <span className="min-w-0"><span className="block text-sm font-semibold truncate">{inv.customerName}</span><span className="block text-[11px] text-slate-500 mt-1"><BidiIsolate>{inv.invoiceNumber || inv.id}</BidiIsolate></span></span>
            <span className="shrink-0 text-end"><span className="block text-xs sm:text-sm font-bold"><BidiIsolate>{formatCurrency(inv.grandTotal, inv.currency)}</BidiIsolate></span><span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : inv.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{t(`status.${inv.status === 'PARTIALLY_PAID' ? 'partiallyPaid' : inv.status.toLowerCase()}`, inv.status)}</span></span>
          </button>)}</div>}
        </CompactCard>
        <CompactCard>
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-emerald-600" /><h3 className="text-sm font-bold">{isRTL ? 'متابعة التحصيل' : 'Collection overview'}</h3></div>
          <div className="flex items-center justify-between gap-3 mb-3 text-xs"><span className="text-slate-500">{isRTL ? 'نسبة المبالغ المحصّلة' : 'Amount collected'}</span><bdi className="font-bold text-emerald-600">{rate}%</bdi></div>
          <div role="progressbar" aria-label={isRTL ? 'نسبة التحصيل' : 'Collection rate'} aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100} className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${rate}%` }} /></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">{isRTL ? 'مستحقات قيد التحصيل' : 'Outstanding balance'} <BidiIsolate className="font-semibold text-slate-900 dark:text-white">{formatCurrency(metrics.outstandingReceivables, metrics.primaryCurrency)}</BidiIsolate></span><button type="button" onClick={() => navigate('/invoices?status=OVERDUE')} className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400"><AlertTriangle className="w-3 h-3" />{isRTL ? `مراجعة المتأخرات (${metrics.overdueInvoicesCount})` : `Review overdue (${metrics.overdueInvoicesCount})`}{isRTL ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}</button></div>
        </CompactCard>
      </div>
      <ActivityFeed maxItems={10} />
    </div>
  </div>;
};
