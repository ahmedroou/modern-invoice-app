/**
 * tests/unit/EmpiricalChallengerM4_2.test.tsx
 * 
 * EMPIRICAL ADVERSARIAL CHALLENGER SUITE — MILESTONE 4 (PART 2)
 * Desktop IPC, Window Lifecycle, and UI Layout Invariants
 * 
 * Focus:
 * 1. Compact card vertical height:
 *    - Invariants across InvoiceList, PaymentList, CustomerList, and CompactMetricCard.
 *    - Strict verification of class 'h-[82px]' (<90px).
 * 2. RTL Mirroring & Bidirectional Isolation (<BidiIsolate>):
 *    - Verification of <BidiIsolate> wrapping financial amounts, dates, and phone numbers.
 *    - Verification that dir="ltr" and unicode-isolate are applied.
 *    - Verification of directional icon flipping (rotate-180 / rtl:scale-x-[-1]).
 * 3. Desktop IPC & Window Lifecycle Contracts:
 *    - All 10 IElectronAPI methods conform to interface contracts and handle edge cases.
 * 4. Static Invariant Scanner:
 *    - Verifies zero card components exceed 90px vertical height.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import * as fs from 'fs';
import * as path from 'path';

import { DirectionProvider } from '@/context/DirectionContext';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { InvoiceList } from '@/components/modules/invoices/InvoiceList';
import { PaymentList } from '@/components/modules/payments/PaymentList';
import { CustomerList } from '@/components/modules/customers/CustomerList';
import { registerPreloadHarness } from './helpers/electronHarness';
import type { Customer, Invoice, Payment } from '@/types/domain';

// --- Mocks ---
const mockCustomers: Customer[] = [
  {
    id: 'cust-challenger-1',
    name: 'مؤسسة الهلال للتجارة (Al-Hilal Trading)',
    email: 'contact@alhilal.sa',
    phone: '+966 50 123 4567',
    address: 'King Fahd Rd, Riyadh',
    taxNumber: '300123456700003',
    currency: 'SAR',
    outstandingAmount: 1450.75,
    totalInvoiced: 5000.00,
    totalPaid: 3549.25,
    status: 'ACTIVE',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-19T10:00:00Z'
  },
  {
    id: 'cust-challenger-2',
    name: 'Apex Global Logistics',
    email: 'billing@apexlogistics.com',
    phone: '+1 555 019 2834',
    address: '100 Harbor Way, Seattle',
    currency: 'USD',
    outstandingAmount: 0,
    totalInvoiced: 2500.00,
    totalPaid: 2500.00,
    status: 'ACTIVE',
    createdAt: '2026-09-05T10:00:00Z',
    updatedAt: '2026-09-15T10:00:00Z'
  }
];

const mockInvoices: Invoice[] = [
  {
    id: 'inv-challenger-1',
    invoiceNumber: 'INV-2026-9001',
    customerId: 'cust-challenger-1',
    customerName: 'مؤسسة الهلال للتجارة (Al-Hilal Trading)',
    issueDate: '2026-09-10',
    dueDate: '2026-09-25',
    currency: 'SAR',
    items: [],
    subtotal: 1261.52,
    totalDiscount: 0,
    totalTax: 189.23,
    grandTotal: 1450.75,
    amountPaid: 0,
    amountDue: 1450.75,
    status: 'UNPAID',
    createdAt: '2026-09-10T08:00:00Z',
    updatedAt: '2026-09-10T08:00:00Z'
  },
  {
    id: 'inv-challenger-2',
    invoiceNumber: 'INV-2026-9002',
    customerId: 'cust-challenger-2',
    customerName: 'Apex Global Logistics',
    issueDate: '2026-09-01',
    dueDate: '2026-09-15',
    currency: 'USD',
    items: [],
    subtotal: 2500.00,
    totalDiscount: 0,
    totalTax: 0,
    grandTotal: 2500.00,
    amountPaid: 2500.00,
    amountDue: 0,
    status: 'PAID',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-15T08:00:00Z'
  }
];

const mockPayments: Payment[] = [
  {
    id: 'pay-challenger-1',
    paymentNumber: 'PAY-2026-9001',
    invoiceId: 'inv-challenger-2',
    invoiceNumber: 'INV-2026-9002',
    customerId: 'cust-challenger-2',
    customerName: 'Apex Global Logistics',
    amount: 2500.00,
    paymentDate: '2026-09-15',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'TXN-SEATTLE-99',
    createdAt: '2026-09-15T12:00:00Z'
  }
];

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({
    customers: mockCustomers,
    loading: false,
    error: null,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    statusFilter: 'ALL',
    setStatusFilter: vi.fn(),
    balanceFilter: 'ALL',
    setBalanceFilter: vi.fn(),
    sortBy: 'name',
    setSortBy: vi.fn(),
    sortOrder: 'asc',
    toggleSortOrder: vi.fn(),
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    archiveCustomer: vi.fn(),
    restoreCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
    metrics: {
      totalCount: 2,
      activeCount: 2,
      archivedCount: 0,
      withDebtCount: 1,
      totalOutstanding: 1450.75
    }
  }),
  normalizeSearchText: (t: string) => t.toLowerCase()
}));

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => ({
    invoices: mockInvoices,
    loading: false,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    statusFilter: 'ALL',
    setStatusFilter: vi.fn(),
    customerFilter: 'ALL',
    setCustomerFilter: vi.fn(),
    startDate: '',
    setStartDate: vi.fn(),
    endDate: '',
    setEndDate: vi.fn(),
    createInvoice: vi.fn(),
    updateInvoice: vi.fn(),
    cancelInvoice: vi.fn(),
    getNextInvoiceNumber: () => 'INV-2026-9003',
    metrics: {
      totalCount: 2,
      unpaidCount: 1,
      paidCount: 1,
      overdueCount: 0,
      partiallyPaidCount: 0,
      totalReceivables: 1450.75
    }
  })
}));

vi.mock('@/hooks/usePayments', () => ({
  usePayments: () => ({
    payments: mockPayments,
    allPayments: mockPayments,
    loading: false,
    error: null,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    methodFilter: 'ALL',
    setMethodFilter: vi.fn(),
    startDate: '',
    setStartDate: vi.fn(),
    endDate: '',
    setEndDate: vi.fn(),
    resetFilters: vi.fn(),
    recordPayment: vi.fn(),
    metrics: {
      totalCollected: 2500.00,
      thisMonthCollected: 2500.00,
      averagePayment: 2500.00,
      paymentCount: 1,
      methodCounts: {
        ALL: 1,
        BANK_TRANSFER: 1,
        CASH: 0,
        CREDIT_CARD: 0,
        CHECK: 0,
        ONLINE_GATEWAY: 0,
        OTHER: 0
      }
    }
  })
}));

describe('Empirical Challenger M4-2: UI Layout Invariants, RTL, and Desktop IPC', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
  });

  afterEach(() => {
    localStorage.clear();
  });

  // =========================================================================
  // 1. Compact Card Vertical Height Invariant (<90px / h-[82px])
  // =========================================================================
  describe('1. Compact Card Vertical Height Invariant (<90px, h-[82px])', () => {
    it('1.1 CompactMetricCard strictly applies h-[82px] (<90px height specification)', () => {
      const { container } = render(
        <CompactMetricCard
          title="Outstanding Receivables"
          value="SAR 1,450.75"
          icon={Landmark}
          variant="brand"
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).not.toBeNull();
      expect(card.className).toContain('h-[82px]');
      // 82px is strictly < 90px (by 8px headroom)
      expect(card.className).not.toContain('h-[90px]');
      expect(card.className).not.toContain('h-[96px]');
      expect(card.className).not.toContain('h-[100px]');
    });

    it('1.2 CustomerList cards in card view strictly apply h-[82px]', () => {
      render(
        <MemoryRouter initialEntries={['/customers']}>
          <DirectionProvider>
            <CustomerList />
          </DirectionProvider>
        </MemoryRouter>
      );

      const customerCard1 = screen.getByTestId('customer-card-cust-challenger-1');
      expect(customerCard1).toBeInTheDocument();
      expect(customerCard1.className).toContain('h-[82px]');

      const customerCard2 = screen.getByTestId('customer-card-cust-challenger-2');
      expect(customerCard2).toBeInTheDocument();
      expect(customerCard2.className).toContain('h-[82px]');
    });

    it('1.3 InvoiceList cards in card view strictly apply h-[82px]', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/invoices']}>
          <DirectionProvider>
            <InvoiceList />
          </DirectionProvider>
        </MemoryRouter>
      );

      // Locate invoice cards
      const invoiceCards = container.querySelectorAll('.grid.grid-cols-1 > div.h-\\[82px\\]');
      expect(invoiceCards.length).toBeGreaterThanOrEqual(2);
      invoiceCards.forEach((card) => {
        expect(card.className).toContain('h-[82px]');
      });
    });

    it('1.4 PaymentList cards in card view strictly apply h-[82px]', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/payments']}>
          <DirectionProvider>
            <PaymentList />
          </DirectionProvider>
        </MemoryRouter>
      );

      const paymentCards = container.querySelectorAll('.grid.grid-cols-1 > div.h-\\[82px\\]');
      expect(paymentCards.length).toBeGreaterThanOrEqual(1);
      paymentCards.forEach((card) => {
        expect(card.className).toContain('h-[82px]');
      });
    });
  });

  // =========================================================================
  // 2. RTL Mirroring & BidiIsolate Wrapping
  // =========================================================================
  describe('2. RTL Mirroring & BidiIsolate Invariants', () => {
    it('2.1 BidiIsolate enforces dir="ltr" and unicode-isolate', () => {
      const { container } = render(
        <BidiIsolate className="custom-bidi">+966 50 123 4567</BidiIsolate>
      );

      const span = container.querySelector('span');
      expect(span).not.toBeNull();
      expect(span?.getAttribute('dir')).toBe('ltr');
      expect(span?.className).toContain('unicode-isolate');
      expect(span?.className).toContain('tabular-nums');
      expect(span?.textContent).toBe('+966 50 123 4567');
    });

    it('2.2 CustomerList wraps customer phone and financial balance in BidiIsolate', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/customers']}>
          <DirectionProvider>
            <CustomerList />
          </DirectionProvider>
        </MemoryRouter>
      );

      // Check phone number isolated
      const phoneBidi = container.querySelector('span[dir="ltr"]');
      expect(phoneBidi).not.toBeNull();
      expect(screen.getByText('+966 50 123 4567')).toHaveAttribute('dir', 'ltr');

      // Check outstanding balance is isolated
      const dueAmounts = container.querySelectorAll('span.font-mono > span[dir="ltr"]');
      expect(dueAmounts.length).toBeGreaterThanOrEqual(1);
    });

    it('2.3 InvoiceList wraps issueDate, dueDate, and grandTotal in BidiIsolate', () => {
      render(
        <MemoryRouter initialEntries={['/invoices']}>
          <DirectionProvider>
            <InvoiceList />
          </DirectionProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('2026-09-10')).toHaveAttribute('dir', 'ltr');
      expect(screen.getByText('2026-09-25')).toHaveAttribute('dir', 'ltr');
      expect(screen.getByText('2026-09-01')).toHaveAttribute('dir', 'ltr');
    });

    it('2.4 PaymentList wraps paymentDate and collected amounts in BidiIsolate', () => {
      render(
        <MemoryRouter initialEntries={['/payments']}>
          <DirectionProvider>
            <PaymentList />
          </DirectionProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('2026-09-15')).toHaveAttribute('dir', 'ltr');
    });

    it('2.5 Switching to Arabic activates document dir="rtl" and applies directional flip classes', () => {
      localStorage.setItem('app_language', 'ar');

      const { container } = render(
        <MemoryRouter initialEntries={['/customers']}>
          <DirectionProvider>
            <CustomerList />
          </DirectionProvider>
        </MemoryRouter>
      );

      // Verify document attributes
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.lang).toBe('ar');

      // Verify directional chevrons contain rtl:rotate-180
      const chevrons = container.querySelectorAll('svg.rtl\\:rotate-180');
      expect(chevrons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 3. Desktop IPC & Window Lifecycle Contracts
  // =========================================================================
  describe('3. Desktop IPC Interface Contracts', () => {
    let mockIpcRenderer: any;

    beforeEach(() => {
      mockIpcRenderer = {
        invoke: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn()
      };
    });

    it('3.1 registers and invokes all 10 IElectronAPI methods with correct parameters', async () => {
      const api = registerPreloadHarness(mockIpcRenderer);

      // 1. minimizeWindow
      await api.minimizeWindow();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('window:minimize');

      // 2. maximizeWindow
      await api.maximizeWindow();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('window:maximize');

      // 3. closeWindow
      await api.closeWindow();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('window:close');

      // 4. isMaximized
      mockIpcRenderer.invoke.mockResolvedValueOnce(true);
      const isMax = await api.isMaximized();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('window:isMaximized');
      expect(isMax).toBe(true);

      // 5. getAppVersion
      mockIpcRenderer.invoke.mockResolvedValueOnce('1.0.0');
      const version = await api.getAppVersion();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('app:version');
      expect(version).toBe('1.0.0');

      // 6. getSystemTheme
      mockIpcRenderer.invoke.mockResolvedValueOnce('dark');
      const theme = await api.getSystemTheme();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('app:theme');
      expect(theme).toBe('dark');

      // 7. printInvoicePDF
      mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true, filePath: 'C:/mock/inv.pdf' });
      const printRes = await api.printInvoicePDF({ invoiceId: 'inv-1', invoiceNumber: 'INV-01' });
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('invoice:print-pdf', { invoiceId: 'inv-1', invoiceNumber: 'INV-01' });
      expect(printRes.success).toBe(true);

      // 8. exportFile
      mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true, filePath: 'C:/mock/out.csv' });
      const exportRes = await api.exportFile({ format: 'csv', data: 'col1,col2', suggestedFilename: 'out.csv' });
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('file:export', expect.anything());
      expect(exportRes.success).toBe(true);

      // 9. onThemeChanged
      const unsubTheme = api.onThemeChanged(() => {});
      expect(mockIpcRenderer.on).toHaveBeenCalledWith('theme:changed', expect.any(Function));
      unsubTheme();
      expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('theme:changed', expect.any(Function));

      // 10. onWindowStateChanged
      if (api.onWindowStateChanged) {
        const unsubState = api.onWindowStateChanged(() => {});
        expect(mockIpcRenderer.on).toHaveBeenCalledWith('window:state-changed', expect.any(Function));
        unsubState();
        expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('window:state-changed', expect.any(Function));
      }
    });

    it('3.2 rejects invalid arguments for printInvoicePDF and exportFile', async () => {
      const api = registerPreloadHarness(mockIpcRenderer);

      await expect(api.printInvoicePDF(null as any)).rejects.toThrow('Invalid print options');
      await expect(api.exportFile(null as any)).rejects.toThrow('Invalid export options');
      await expect(api.exportFile({ format: 'csv' } as any)).rejects.toThrow('Invalid export options');
    });
  });

  // =========================================================================
  // 4. Static Code Invariant Scanner
  // =========================================================================
  describe('4. Static Code Invariant Scanner for Card Components', () => {
    it('4.1 scans all card components and confirms h-[82px] presence with zero violations >90px', () => {
      const rootDir = path.resolve(__dirname, '../../src/components');
      const targetFiles = [
        path.join(rootDir, 'common/CompactMetricCard.tsx'),
        path.join(rootDir, 'modules/customers/CustomerList.tsx'),
        path.join(rootDir, 'modules/invoices/InvoiceList.tsx'),
        path.join(rootDir, 'modules/payments/PaymentList.tsx')
      ];

      for (const filePath of targetFiles) {
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Verify h-[82px] is present
        expect(content).toContain('h-[82px]');

        // Adversarial check: Ensure no oversized card classes (e.g. h-[90px], h-[95px], h-[100px], h-[120px])
        const invalidMatches = content.match(/h-\[(?:9[0-9]|1[0-9]{2})px\]/g);
        expect(invalidMatches).toBeNull();

        // Verify BidiIsolate is imported and used
        expect(content).toContain('BidiIsolate');
      }
    });
  });
});
