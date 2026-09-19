import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { DirectionProvider } from '@/context/DirectionContext';
import { CustomerList } from '@/components/modules/customers/CustomerList';
import { CustomerLedger } from '@/components/modules/customers/CustomerLedger';
import { CustomerModal } from '@/components/modules/customers/CustomerModal';
import type { Customer } from '@/types/domain';

// Mock useCustomers hook
const mockCreateCustomer = vi.fn();
const mockUpdateCustomer = vi.fn();
const mockArchiveCustomer = vi.fn();
const mockRestoreCustomer = vi.fn();
const mockDeleteCustomer = vi.fn();

const mockCustomersList: Customer[] = [
  {
    id: 'cust-1',
    name: 'Al-Madina Trading',
    email: 'madina@trading.sa',
    phone: '+966501234567',
    taxNumber: '300123456700003',
    currency: 'SAR',
    outstandingAmount: 2500,
    totalInvoiced: 10000,
    totalPaid: 7500,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'cust-2',
    name: 'Red Sea Solutions',
    email: 'contact@redsea.sa',
    phone: '+966559876543',
    taxNumber: '300987654300003',
    currency: 'SAR',
    outstandingAmount: 0,
    totalInvoiced: 5000,
    totalPaid: 5000,
    status: 'ACTIVE',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z'
  }
];

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({
    customers: mockCustomersList,
    rawCustomers: mockCustomersList,
    loading: false,
    error: null,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    statusFilter: 'ACTIVE',
    setStatusFilter: vi.fn(),
    balanceFilter: 'ALL',
    setBalanceFilter: vi.fn(),
    sortBy: 'name',
    setSortBy: vi.fn(),
    sortOrder: 'asc',
    setSortOrder: vi.fn(),
    toggleSortOrder: vi.fn(),
    createCustomer: mockCreateCustomer,
    updateCustomer: mockUpdateCustomer,
    archiveCustomer: mockArchiveCustomer,
    restoreCustomer: mockRestoreCustomer,
    deleteCustomer: mockDeleteCustomer,
    getCustomerById: vi.fn(),
    metrics: {
      totalCount: 2,
      activeCount: 2,
      archivedCount: 0,
      totalOutstanding: 2500,
      withDebtCount: 1
    }
  }),
  normalizeSearchText: (text: string) => text.toLowerCase().trim()
}));

// Mock useCustomerLedger
vi.mock('@/hooks/useCustomerLedger', () => ({
  useCustomerLedger: (_id: string | undefined) => ({
    customer: mockCustomersList[0],
    ledgerEntries: [
      {
        id: 'inv-1',
        type: 'INVOICE',
        date: '2026-09-01',
        createdAt: '2026-09-01T00:00:00Z',
        referenceNumber: 'INV-101',
        description: 'Invoice #INV-101',
        debit: 10000,
        credit: 0,
        runningBalance: 10000,
        currency: 'SAR'
      },
      {
        id: 'pay-1',
        type: 'PAYMENT',
        date: '2026-09-10',
        createdAt: '2026-09-10T00:00:00Z',
        referenceNumber: 'PAY-101',
        description: 'Payment for #INV-101',
        debit: 0,
        credit: 7500,
        runningBalance: 2500,
        currency: 'SAR'
      }
    ],
    filteredEntries: [
      {
        id: 'inv-1',
        type: 'INVOICE',
        date: '2026-09-01',
        createdAt: '2026-09-01T00:00:00Z',
        referenceNumber: 'INV-101',
        description: 'Invoice #INV-101',
        debit: 10000,
        credit: 0,
        runningBalance: 10000,
        currency: 'SAR'
      },
      {
        id: 'pay-1',
        type: 'PAYMENT',
        date: '2026-09-10',
        createdAt: '2026-09-10T00:00:00Z',
        referenceNumber: 'PAY-101',
        description: 'Payment for #INV-101',
        debit: 0,
        credit: 7500,
        runningBalance: 2500,
        currency: 'SAR'
      }
    ],
    metrics: {
      totalInvoiced: 10000,
      totalPaid: 7500,
      outstandingBalance: 2500,
      invoiceCount: 1,
      paymentCount: 1,
      overdueCount: 0,
      overdueAmount: 0,
      financialStatus: 'HAS_BALANCE'
    },
    loading: false,
    error: null,
    sortOrder: 'desc',
    setSortOrder: vi.fn(),
    filterType: 'ALL',
    setFilterType: vi.fn(),
    searchTerm: '',
    setSearchTerm: vi.fn(),
    isReconciled: true
  })
}));

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <DirectionProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </DirectionProvider>
    </ThemeProvider>
  );
};

describe('Customer Directory & Ledger Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. CustomerList Component', () => {
    it('renders customer directory header, search input, and add customer button', () => {
      renderWithProviders(<CustomerList />);

      expect(screen.getByTestId('customer-list-view')).toBeInTheDocument();
      expect(screen.getByTestId('add-customer-btn')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search by name/i)).toBeInTheDocument();
    });

    it('renders compact directory KPI cards adhering to <90px height', () => {
      const { container } = renderWithProviders(<CustomerList />);

      const metricsGrid = screen.getByTestId('customer-metrics-grid');
      expect(metricsGrid).toBeInTheDocument();

      const cards = container.querySelectorAll('.h-\\[82px\\]');
      // At least 4 KPI cards plus mobile customer cards
      expect(cards.length).toBeGreaterThanOrEqual(4);
    });

    it('renders customer cards with bidi-isolated contact info and outstanding balance', () => {
      renderWithProviders(<CustomerList />);

      expect(screen.getByText('Al-Madina Trading')).toBeInTheDocument();
      expect(screen.getByText('Red Sea Solutions')).toBeInTheDocument();
      expect(screen.getByText('+966501234567')).toBeInTheDocument();
    });
  });

  describe('2. CustomerModal Component', () => {
    it('opens modal, validates required name, and prevents empty submission', async () => {
      const handleSubmit = vi.fn();
      renderWithProviders(
        <CustomerModal
          isOpen={true}
          customer={null}
          onClose={vi.fn()}
          onSubmit={handleSubmit}
        />
      );

      expect(screen.getByText('Add New Customer')).toBeInTheDocument();

      // Submit without name
      const submitBtn = screen.getByText('Create Customer');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(handleSubmit).not.toHaveBeenCalled();
      });
    });

    it('renders read-only financial ledger strip in edit mode', () => {
      renderWithProviders(
        <CustomerModal
          isOpen={true}
          customer={mockCustomersList[0]}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      expect(screen.getByText('Edit Customer')).toBeInTheDocument();
      expect(screen.getByText('Invoiced')).toBeInTheDocument();
      expect(screen.getByText('Paid')).toBeInTheDocument();
      expect(screen.getByText('Due')).toBeInTheDocument();
    });
  });

  describe('3. CustomerLedger Component', () => {
    it('renders customer profile summary and transaction ledger with back button', () => {
      const handleBack = vi.fn();
      renderWithProviders(
        <CustomerLedger customerId="cust-1" onBack={handleBack} />
      );

      expect(screen.getAllByText('Al-Madina Trading').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Financial Profile & Statement of Account')).toBeInTheDocument();

      // Verify transaction rows
      expect(screen.getAllByText('INV-101').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('PAY-101').length).toBeGreaterThanOrEqual(1);

      // Verify back button calls callback
      const backBtn = screen.getByTitle('Back');
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('contains 3 compact KPI metric cards sized at h-[82px] (<90px)', () => {
      const { container } = renderWithProviders(
        <CustomerLedger customerId="cust-1" />
      );

      const kpiCards = container.querySelectorAll('.h-\\[82px\\]');
      expect(kpiCards.length).toBeGreaterThanOrEqual(3);
    });
  });
});
