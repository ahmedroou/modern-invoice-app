import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaymentList } from '@/components/modules/payments/PaymentList';
import { DirectionProvider } from '@/context/DirectionContext';
import type { Payment, Invoice } from '@/types/domain';

// Mock payments
const mockPayments: Payment[] = [
  {
    id: 'pay-001',
    paymentNumber: 'PAY-2026-0001',
    invoiceId: 'inv-101',
    invoiceNumber: 'INV-2026-0101',
    customerId: 'cust-101',
    customerName: 'Alpha Tech',
    amount: 500,
    paymentDate: '2026-09-15',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'TXN-ALPHA-99',
    createdAt: '2026-09-15T10:00:00Z'
  },
  {
    id: 'pay-002',
    paymentNumber: 'PAY-2026-0002',
    invoiceId: 'inv-102',
    invoiceNumber: 'INV-2026-0102',
    customerId: 'cust-102',
    customerName: 'Beta Systems',
    amount: 250,
    paymentDate: '2026-09-18',
    paymentMethod: 'CASH',
    referenceNumber: 'CASH-002',
    createdAt: '2026-09-18T14:30:00Z'
  },
  {
    id: 'pay-003',
    paymentNumber: 'PAY-2026-0003',
    invoiceId: 'inv-103',
    invoiceNumber: 'INV-2026-0103',
    customerId: 'cust-103',
    customerName: 'مؤسسة الأمل',
    amount: 1200,
    paymentDate: '2026-09-19',
    paymentMethod: 'CREDIT_CARD',
    referenceNumber: 'CC-AUTH-77',
    createdAt: '2026-09-19T11:00:00Z'
  }
];

const mockInvoices: Invoice[] = [
  {
    id: 'inv-101',
    invoiceNumber: 'INV-2026-0101',
    customerId: 'cust-101',
    customerName: 'Alpha Tech',
    issueDate: '2026-09-01',
    dueDate: '2026-09-20',
    currency: 'SAR',
    items: [],
    subtotal: 1000,
    totalDiscount: 0,
    totalTax: 150,
    grandTotal: 1150,
    amountPaid: 500,
    amountDue: 650,
    status: 'PARTIALLY_PAID',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-15T10:00:00Z'
  }
];

// Mock usePayments hook
let currentMethodFilter = 'ALL';
let currentSearchQuery = '';

vi.mock('@/hooks/usePayments', () => ({
  usePayments: () => {
    let filtered = [...mockPayments];
    if (currentMethodFilter !== 'ALL') {
      filtered = filtered.filter((p) => p.paymentMethod === currentMethodFilter);
    }
    if (currentSearchQuery.trim()) {
      const q = currentSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.paymentNumber.toLowerCase().includes(q) ||
          p.invoiceNumber.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q)
      );
    }

    const totalCollected = filtered.reduce((sum, p) => sum + p.amount, 0);

    return {
      payments: filtered,
      allPayments: mockPayments,
      loading: false,
      error: null,
      searchQuery: currentSearchQuery,
      setSearchQuery: (q: string) => {
        currentSearchQuery = q;
      },
      methodFilter: currentMethodFilter,
      setMethodFilter: (m: string) => {
        currentMethodFilter = m;
      },
      startDate: '',
      setStartDate: vi.fn(),
      endDate: '',
      setEndDate: vi.fn(),
      resetFilters: vi.fn(),
      recordPayment: vi.fn().mockResolvedValue({ paymentId: 'pay-new', activityLogId: 'act-new' }),
      metrics: {
        totalCollected,
        thisMonthCollected: totalCollected,
        averagePayment: filtered.length > 0 ? totalCollected / filtered.length : 0,
        paymentCount: filtered.length,
        methodCounts: {
          ALL: filtered.length,
          CASH: 250,
          BANK_TRANSFER: 500,
          CREDIT_CARD: 1200,
          CHECK: 0,
          ONLINE_GATEWAY: 0,
          OTHER: 0
        }
      }
    };
  }
}));

// Mock useInvoices hook
vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => ({
    invoices: mockInvoices,
    loading: false
  })
}));

// Mock useSearchParams
const mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, vi.fn()],
  useLocation: () => ({ pathname: '/payments' })
}));

describe('Unit Test: PaymentList Component (Milestone 4)', () => {
  beforeEach(() => {
    currentMethodFilter = 'ALL';
    currentSearchQuery = '';
  });

  const renderComponent = () => {
    return render(
      <DirectionProvider>
        <PaymentList />
      </DirectionProvider>
    );
  };

  it('renders payment records as compact cards with h-[82px] constraint (<90px height)', () => {
    renderComponent();

    // Verify payment records appear
    expect(screen.getByText('PAY-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('PAY-2026-0002')).toBeInTheDocument();
    expect(screen.getByText('PAY-2026-0003')).toBeInTheDocument();

    // Verify compact card height constraint (<90px / h-[82px])
    const cards = document.querySelectorAll('.h-\\[82px\\]');
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('filters payments when method tab is selected', async () => {
    const { rerender } = renderComponent();

    expect(screen.getByText('PAY-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('PAY-2026-0002')).toBeInTheDocument();

    // Switch method filter to CASH
    currentMethodFilter = 'CASH';
    rerender(
      <DirectionProvider>
        <PaymentList />
      </DirectionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('PAY-2026-0002')).toBeInTheDocument();
      expect(screen.queryByText('PAY-2026-0001')).toBeNull();
      expect(screen.queryByText('PAY-2026-0003')).toBeNull();
    });
  });

  it('filters payments by search query', async () => {
    const { rerender } = renderComponent();

    currentSearchQuery = 'Alpha';
    rerender(
      <DirectionProvider>
        <PaymentList />
      </DirectionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('PAY-2026-0001')).toBeInTheDocument();
      expect(screen.queryByText('PAY-2026-0002')).toBeNull();
    });
  });

  it('toggles between compact card view and table view', async () => {
    renderComponent();

    // Find table toggle button
    const tableToggleBtn = screen.getByTitle(/table view/i);
    expect(tableToggleBtn).toBeInTheDocument();

    fireEvent.click(tableToggleBtn);

    // Verify table elements render
    await waitFor(() => {
      const table = document.querySelector('table');
      expect(table).not.toBeNull();
    });
  });

  it('renders "Record Payment" button and displays action', () => {
    renderComponent();

    const recordBtn = screen.getByRole('button', { name: /Record Payment|تسجيل دفعة/i });
    expect(recordBtn).toBeInTheDocument();
  });
});
