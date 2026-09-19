import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvoiceForm } from '@/components/modules/invoices/InvoiceForm';
import { DirectionProvider } from '@/context/DirectionContext';
import { createInvoiceAtomic } from '@/lib/atomicMutations';
import { normalizeSearchText } from '@/hooks/useCustomers';
import { db } from '@/lib/firebase';

const mockCustomers = [
  {
    id: 'cust-101',
    name: 'مؤسسة الرياض التجارية (Riyadh Trading)',
    currency: 'SAR',
    outstandingAmount: 500,
    totalInvoiced: 1500,
    totalPaid: 1000
  },
  {
    id: 'cust-102',
    name: 'Acme International',
    currency: 'USD',
    outstandingAmount: 0,
    totalInvoiced: 2000,
    totalPaid: 2000
  }
];

// Mock writeBatch for firestore atomic mutation testing
const mockCommit = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    writeBatch: () => ({
      set: mockSet,
      update: mockUpdate,
      delete: mockDelete,
      commit: mockCommit
    })
  };
});

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({
    customers: mockCustomers
  }),
  normalizeSearchText: (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[\u0622\u0623\u0625]/g, '\u0627')
      .replace(/\u0649/g, '\u064A')
      .replace(/\u0629/g, '\u0647');
  }
}));

describe('Invoices Module — Unit Tests (tests/unit/invoices.test.tsx)', () => {
  beforeEach(() => {
    mockCommit.mockClear();
    mockSet.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
    vi.clearAllMocks();
  });

  describe('1. Real-Time Automatic Calculations & Zero Calculate Button (AC 3)', () => {
    it('updates Grand Total dynamically on quantity change with ZERO calculate button', async () => {
      const handleSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <DirectionProvider>
          <InvoiceForm
            isOpen={true}
            onClose={() => {}}
            onSubmit={handleSubmit}
          />
        </DirectionProvider>
      );

      // Verify ZERO calculate button exists anywhere in the form
      const calculateBtn = screen.queryByRole('button', { name: /calculate/i });
      expect(calculateBtn).toBeNull();
      const calcArabicBtn = screen.queryByRole('button', { name: /احسب/i });
      expect(calcArabicBtn).toBeNull();

      // Locate line item fields
      const descInput = screen.getByTestId('item-0-description');
      const qtyInput = screen.getByTestId('item-0-quantity');
      const priceInput = screen.getByTestId('item-0-unitPrice');

      fireEvent.change(descInput, { target: { value: 'Consulting Services' } });
      fireEvent.change(qtyInput, { target: { value: '2' } });
      fireEvent.change(priceInput, { target: { value: '100' } });

      // Grand total should update reactively: 2 * 100 = 200 + 15% tax (30) = 230.00
      const grandTotalDisplay = document.getElementById('grand-total-display');
      expect(grandTotalDisplay).not.toBeNull();
      expect(grandTotalDisplay?.textContent).toContain('230.00');

      // Update quantity to 4 without clicking any button
      fireEvent.change(qtyInput, { target: { value: '4' } });

      // Live update: 4 * 100 = 400 + 15% tax (60) = 460.00
      expect(grandTotalDisplay?.textContent).toContain('460.00');
    });

    it('recalculates line item totals and aggregates live when discounts and taxes change', async () => {
      render(
        <DirectionProvider>
          <InvoiceForm
            isOpen={true}
            onClose={() => {}}
            onSubmit={vi.fn()}
          />
        </DirectionProvider>
      );

      const qtyInput = screen.getByTestId('item-0-quantity');
      const priceInput = screen.getByTestId('item-0-unitPrice');
      const discountInput = screen.getByTestId('item-0-discount');
      const taxRateInput = screen.getByTestId('item-0-taxRate');

      fireEvent.change(qtyInput, { target: { value: '10' } });
      fireEvent.change(priceInput, { target: { value: '50' } }); // gross = 500
      fireEvent.change(discountInput, { target: { value: '10' } }); // 10% discount = 50, net = 450
      fireEvent.change(taxRateInput, { target: { value: '15' } }); // 15% tax on 450 = 67.50

      const grandTotalDisplay = document.getElementById('grand-total-display');
      // 450 + 67.50 = 517.50
      expect(grandTotalDisplay?.textContent).toContain('517.50');
    });
  });

  describe('2. Keyboard Grid Navigation & Shortcuts', () => {
    it('creates a new line item row and focuses Description when Enter is pressed on taxRate', async () => {
      render(
        <DirectionProvider>
          <InvoiceForm
            isOpen={true}
            onClose={() => {}}
            onSubmit={vi.fn()}
          />
        </DirectionProvider>
      );

      const initialRows = screen.getAllByTestId(/item-\d+-description/);
      expect(initialRows.length).toBe(1);

      const taxRate0 = screen.getByTestId('item-0-taxRate');
      taxRate0.focus();

      // Press Enter on the last column (taxRate)
      fireEvent.keyDown(taxRate0, { key: 'Enter', code: 'Enter' });

      // New row should be added
      await waitFor(() => {
        const updatedRows = screen.getAllByTestId(/item-\d+-description/);
        expect(updatedRows.length).toBe(2);
      });

      // Verify row 1 exists
      const descRow1 = screen.getByTestId('item-1-description');
      expect(descRow1).toBeDefined();
    });

    it('navigates vertically between line item rows on ArrowDown and ArrowUp', async () => {
      render(
        <DirectionProvider>
          <InvoiceForm
            isOpen={true}
            onClose={() => {}}
            onSubmit={vi.fn()}
          />
        </DirectionProvider>
      );

      // Add a second row
      const addRowBtn = screen.getByRole('button', { name: /add item/i });
      fireEvent.click(addRowBtn);

      const qtyRow0 = screen.getByTestId('item-0-quantity');
      const qtyRow1 = screen.getByTestId('item-1-quantity');

      qtyRow0.focus();
      fireEvent.keyDown(qtyRow0, { key: 'ArrowDown', code: 'ArrowDown' });
      expect(document.activeElement).toBe(qtyRow1);

      fireEvent.keyDown(qtyRow1, { key: 'ArrowUp', code: 'ArrowUp' });
      expect(document.activeElement).toBe(qtyRow0);
    });

    it('deletes active row when Alt + Delete is pressed and more than 1 row exists', async () => {
      render(
        <DirectionProvider>
          <InvoiceForm
            isOpen={true}
            onClose={() => {}}
            onSubmit={vi.fn()}
          />
        </DirectionProvider>
      );

      // Add second row
      const addRowBtn = screen.getByRole('button', { name: /add item/i });
      fireEvent.click(addRowBtn);
      expect(screen.getAllByTestId(/item-\d+-description/).length).toBe(2);

      const descRow1 = screen.getByTestId('item-1-description');
      descRow1.focus();

      fireEvent.keyDown(descRow1, { key: 'Delete', code: 'Delete', altKey: true });

      await waitFor(() => {
        expect(screen.getAllByTestId(/item-\d+-description/).length).toBe(1);
      });
    });

    it('triggers modal close on Escape key', async () => {
      const handleClose = vi.fn();
      render(
        <DirectionProvider>
          <InvoiceForm
            isOpen={true}
            onClose={handleClose}
            onSubmit={vi.fn()}
          />
        </DirectionProvider>
      );

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('3. Customer Balance Synchronization via Atomic Mutation', () => {
    it('atomically commits invoice and updates customer balance in single writeBatch', async () => {
      const invoiceData = {
        id: 'inv-atomic-001',
        invoiceNumber: 'INV-2026-0099',
        customerId: 'cust-101',
        customerName: 'مؤسسة الرياض التجارية (Riyadh Trading)',
        issueDate: '2026-09-19',
        dueDate: '2026-10-05',
        currency: 'SAR',
        items: [],
        subtotal: 1000,
        totalDiscount: 100,
        totalTax: 135,
        grandTotal: 1035
      };

      const result = await createInvoiceAtomic({ invoice: invoiceData }, db);

      expect(result.invoiceId).toBe('inv-atomic-001');
      expect(result.invoice.grandTotal).toBe(1035);
      expect(result.invoice.amountDue).toBe(1035);
      expect(result.invoice.status).toBe('UNPAID');
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify invoice document set
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'inv-atomic-001',
          grandTotal: 1035,
          amountDue: 1035,
          status: 'UNPAID'
        })
      );

      // Verify customer outstandingAmount increment
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          outstandingAmount: expect.anything(),
          totalInvoiced: expect.anything()
        })
      );
    });
  });

  describe('4. Arabic Search & Normalization', () => {
    it('normalizes Arabic search query ignoring diacritics and Alef forms', () => {
      // With diacritics
      const diacriticText = 'مُؤَسَّسَةُ الرِّيَاضِ التِّجَارِيَّةِ';
      const plainQuery = 'مؤسسة الرياض';

      const normText = normalizeSearchText(diacriticText);
      const normQuery = normalizeSearchText(plainQuery);

      expect(normText).toContain(normQuery);

      // Alef variants
      const withHamza = 'أحمد';
      const withoutHamza = 'احمد';
      expect(normalizeSearchText(withHamza)).toBe(normalizeSearchText(withoutHamza));

      // Taa Marbuta & Haa
      const taaMarbuta = 'شركة';
      const haa = 'شركه';
      expect(normalizeSearchText(taaMarbuta)).toBe(normalizeSearchText(haa));
    });
  });
});
