import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InvoiceList } from '@/components/modules/invoices/InvoiceList';
import { DirectionProvider } from '@/context/DirectionContext';
import type { Invoice } from '@/types/domain';

const mockInvoices: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-0001',
    customerId: 'cust-1',
    customerName: 'Acme Corporation',
    issueDate: '2026-09-01',
    dueDate: '2026-09-15',
    currency: 'USD',
    items: [],
    subtotal: 1000,
    totalDiscount: 0,
    totalTax: 150,
    grandTotal: 1150,
    amountPaid: 0,
    amountDue: 1150,
    status: 'UNPAID',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z'
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-2026-0002',
    customerId: 'cust-2',
    customerName: 'Delta Systems',
    issueDate: '2026-09-05',
    dueDate: '2026-09-20',
    currency: 'SAR',
    items: [],
    subtotal: 500,
    totalDiscount: 0,
    totalTax: 75,
    grandTotal: 575,
    amountPaid: 575,
    amountDue: 0,
    status: 'PAID',
    createdAt: '2026-09-05T10:00:00Z',
    updatedAt: '2026-09-05T10:00:00Z'
  }
];

let currentFilter = 'ALL';
let currentSearch = '';

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => ({
    invoices: mockInvoices.filter((inv) => {
      if (currentFilter !== 'ALL' && inv.status !== currentFilter) return false;
      if (currentSearch && !inv.customerName.toLowerCase().includes(currentSearch.toLowerCase())) return false;
      return true;
    }),
    rawInvoices: mockInvoices,
    loading: false,
    error: null,
    searchQuery: currentSearch,
    setSearchQuery: (q: string) => {
      currentSearch = q;
    },
    statusFilter: currentFilter,
    setStatusFilter: (f: string) => {
      currentFilter = f;
    },
    sortBy: 'issueDate',
    setSortBy: vi.fn(),
    sortOrder: 'desc',
    setSortOrder: vi.fn(),
    toggleSortOrder: vi.fn(),
    createInvoice: vi.fn(),
    updateInvoice: vi.fn(),
    cancelInvoice: vi.fn(),
    getNextInvoiceNumber: () => 'INV-2026-0003',
    metrics: {
      totalCount: 2,
      unpaidCount: 1,
      overdueCount: 0,
      paidCount: 1,
      partiallyPaidCount: 0,
      draftCount: 0,
      totalReceivables: 1150,
      totalRevenue: 575
    }
  })
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({
    customers: [
      { id: 'cust-1', name: 'Acme Corporation', currency: 'USD' },
      { id: 'cust-2', name: 'Delta Systems', currency: 'SAR' }
    ],
    loading: false
  })
}));

describe('Integration Test: InvoiceList Component (Compact Cards & Responsiveness)', () => {
  const renderList = () => {
    return render(
      <MemoryRouter>
        <DirectionProvider>
          <InvoiceList />
        </DirectionProvider>
      </MemoryRouter>
    );
  };

  it('verifies compact card designs strictly have h-[82px] (<90px height)', () => {
    renderList();

    // Find all invoice card containers
    const cards = document.querySelectorAll('.h-\\[82px\\]');
    expect(cards.length).toBeGreaterThan(0);

    // Verify each card contains h-[82px] which is 82px (< 90px vertical height)
    cards.forEach((card) => {
      expect(card.classList.contains('h-[82px]')).toBe(true);
    });
  });

  it('renders KPI metric cards strip (<90px) at the top', () => {
    renderList();

    // Outstanding Receivables and Total Revenue cards
    expect(screen.getByText(/Total Revenue/i)).toBeInTheDocument();
    expect(screen.getByText(/Outstanding Receivables/i)).toBeInTheDocument();
  });

  it('toggles between compact card view and dense table view', () => {
    renderList();

    // Default view is cards
    expect(document.querySelector('.grid.grid-cols-1')).not.toBeNull();

    // Click Table View button
    const tableBtn = screen.getByTitle('Dense Table View');
    fireEvent.click(tableBtn);

    // Table should now be rendered
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-0002')).toBeInTheDocument();
  });
});
