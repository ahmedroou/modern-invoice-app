import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { DirectionProvider } from '@/context/DirectionContext';
import { DashboardView } from '@/components/modules/dashboard/DashboardView';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('@/hooks/useDashboardMetrics', () => ({
  useDashboardMetrics: () => ({
    totalRevenue: 55000,
    outstandingReceivables: 15000,
    paidInvoicesCount: 40,
    overdueInvoicesCount: 2,
    unpaidInvoicesCount: 5,
    totalInvoicesCount: 45,
    draftInvoicesCount: 1,
    totalInvoiced: 70000,
    collectionRate: 78.6,
    primaryCurrency: 'SAR',
    recentInvoices: [
      {
        id: 'inv-recent-1',
        invoiceNumber: 'INV-2026-088',
        customerId: 'cust-1',
        customerName: 'Najd Enterprises',
        issueDate: '2026-09-18',
        dueDate: '2026-10-18',
        currency: 'SAR',
        items: [],
        subtotal: 12000,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 12000,
        amountPaid: 12000,
        amountDue: 0,
        status: 'PAID',
        createdAt: '2026-09-18T10:00:00Z',
        updatedAt: '2026-09-18T10:00:00Z'
      },
      {
        id: 'inv-recent-2',
        invoiceNumber: 'INV-2026-089',
        customerId: 'cust-2',
        customerName: 'Hijaz Tech',
        issueDate: '2026-09-19',
        dueDate: '2026-10-19',
        currency: 'SAR',
        items: [],
        subtotal: 4500,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 4500,
        amountPaid: 0,
        amountDue: 4500,
        status: 'UNPAID',
        createdAt: '2026-09-19T08:00:00Z',
        updatedAt: '2026-09-19T08:00:00Z'
      }
    ],
    isLoading: false,
    error: null
  })
}));

vi.mock('@/hooks/useActivityLog', () => ({
  useActivityLog: () => ({
    logs: [
      {
        id: 'log-1',
        timestamp: new Date().toISOString(),
        eventType: 'PAYMENT_RECORDED',
        entityType: 'PAYMENT',
        entityId: 'pay-1',
        description: 'Payment of SAR 12,000 recorded for #INV-2026-088'
      },
      {
        id: 'log-2',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        eventType: 'CUSTOMER_CREATED',
        entityType: 'CUSTOMER',
        entityId: 'cust-2',
        description: 'Customer Hijaz Tech was registered'
      }
    ],
    isLoading: false,
    error: null
  })
}));

const renderDashboard = () => {
  return render(
    <ThemeProvider>
      <DirectionProvider>
        <MemoryRouter>
          <DashboardView />
        </MemoryRouter>
      </DirectionProvider>
    </ThemeProvider>
  );
};

describe('DashboardView Component & Responsive Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, quick actions, 4 compact metric cards (<90px height)', () => {
    const { container } = renderDashboard();

    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
    expect(screen.getByTestId('action-new-invoice')).toBeInTheDocument();
    expect(screen.getByTestId('action-new-customer')).toBeInTheDocument();

    const metricCards = container.querySelectorAll('.h-\\[82px\\]');
    expect(metricCards.length).toBe(4);
  });

  it('renders Recent Invoices with customer name and status pill', () => {
    renderDashboard();

    expect(screen.getByTestId('recent-invoices-card')).toBeInTheDocument();
    expect(screen.getByText(/Najd Enterprises/)).toBeInTheDocument();
    expect(screen.getAllByText(/Hijaz Tech/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Activity Feed with relative times and event descriptions', () => {
    renderDashboard();

    expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    expect(screen.getByText(/Payment of SAR 12,000/)).toBeInTheDocument();
    expect(screen.getByText(/Customer Hijaz Tech was registered/)).toBeInTheDocument();
  });

  it('triggers quick navigation on action button clicks', () => {
    renderDashboard();

    fireEvent.click(screen.getByTestId('action-new-invoice'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices?new=1');

    fireEvent.click(screen.getByTestId('action-new-customer'));
    expect(mockNavigate).toHaveBeenCalledWith('/customers');
  });
});
