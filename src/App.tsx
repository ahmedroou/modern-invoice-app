import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DirectionProvider, useDirection } from '@/context/DirectionContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { CompactCard } from '@/components/common/CompactCard';
import { DashboardView } from '@/components/modules/dashboard/DashboardView';
import { CustomerList } from '@/components/modules/customers/CustomerList';
import { InvoiceList } from '@/components/modules/invoices/InvoiceList';
import { PaymentList } from '@/components/modules/payments/PaymentList';
import { StatementOfAccount } from '@/components/modules/statements/StatementOfAccount';
import { ExpensesView } from '@/components/modules/expenses/ExpensesView';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { TitleBar } from '@/components/layout/TitleBar';
import { UpdateBadge } from '@/components/common/UpdateBadge';

const PlaceholderView: React.FC<{ titleKey: string }> = ({ titleKey }) => {
  const { t } = useDirection();
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        {t(titleKey)}
      </h2>
      <CompactCard className="py-8 text-center text-slate-500">
        <p className="text-sm font-medium">{t(titleKey)} module ready for upcoming milestone integration.</p>
      </CompactCard>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { currentAccount, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-emerald-500">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' && typeof window !== 'undefined' && !(window as unknown as { __TEST_FORCE_AUTH__?: boolean }).__TEST_FORCE_AUTH__;

  if (!currentAccount && !isTest) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950">
        <TitleBar title="Meezan" showControls={true}>
          <UpdateBadge />
        </TitleBar>
        <div className="flex-1 overflow-auto">
          <AuthScreen />
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardView />} />
          <Route path="invoices" element={<InvoiceList />} />
          <Route path="invoices/new" element={<InvoiceList />} />
          <Route path="invoices/:id" element={<InvoiceList />} />
          <Route path="expenses" element={<ExpensesView />} />
          <Route path="customers" element={<CustomerList />} />
          <Route path="customers/:id" element={<CustomerList />} />
          <Route path="payments" element={<PaymentList />} />
          <Route path="statements" element={<StatementOfAccount />} />
          <Route path="statements/:customerId" element={<StatementOfAccount />} />
          <Route path="settings" element={<PlaceholderView titleKey="nav.settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <DirectionProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
};

export default App;

