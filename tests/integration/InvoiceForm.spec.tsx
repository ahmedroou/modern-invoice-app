import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvoiceForm } from '@/components/modules/invoices/InvoiceForm';
import { DirectionProvider } from '@/context/DirectionContext';

const mockCustomers = [
  {
    id: 'cust-1',
    name: 'Acme International',
    currency: 'USD',
    outstandingAmount: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    status: 'ACTIVE' as const
  },
  {
    id: 'cust-2',
    name: 'الشركة العالمية',
    currency: 'SAR',
    outstandingAmount: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    status: 'ACTIVE' as const
  }
];

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({
    customers: mockCustomers,
    loading: false,
    error: null
  }),
  normalizeSearchText: (txt: string) => txt.toLowerCase().trim()
}));

describe('Integration Test: InvoiceForm Component (AC3 & Real-Time Calculations)', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
  });

  const renderForm = (props = {}) => {
    return render(
      <DirectionProvider>
        <InvoiceForm
          isOpen={true}
          defaultInvoiceNumber="INV-2026-0001"
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          {...props}
        />
      </DirectionProvider>
    );
  };

  it('AC3: verifies zero "Calculate" or "Recalculate" buttons exist in the document', () => {
    renderForm();

    const calculateBtn = screen.queryByRole('button', { name: /calculate|recalculate|احسب/i });
    expect(calculateBtn).toBeNull();
  });

  it('AC3: dynamically updates Grand Total in real-time as line items are modified without clicking any button', async () => {
    renderForm();

    const grandTotalDisplay = document.querySelector('#grand-total-display');
    expect(grandTotalDisplay).not.toBeNull();

    // Initial state: 1 item with quantity 1, unitPrice '', tax 15% -> Grand Total $0.00
    expect(grandTotalDisplay?.textContent).toContain('0.00');

    // Find grid inputs for row 0
    const qtyInput = document.querySelector('[data-grid-cell="0-quantity"]') as HTMLInputElement;
    const priceInput = document.querySelector('[data-grid-cell="0-unitPrice"]') as HTMLInputElement;

    expect(qtyInput).not.toBeNull();
    expect(priceInput).not.toBeNull();

    // 1. Enter Unit Price 50.00 (Quantity is 1, Tax is 15%)
    // Gross: 50.00, Tax: 7.50, Total: 57.50
    fireEvent.change(priceInput, { target: { value: '50.00' } });

    await waitFor(() => {
      expect(grandTotalDisplay?.textContent).toContain('57.50');
    });

    // 2. Modify Quantity to 3 (3 * 50 = 150, Tax: 22.50, Grand Total: 172.50)
    fireEvent.change(qtyInput, { target: { value: '3' } });

    await waitFor(() => {
      expect(grandTotalDisplay?.textContent).toContain('172.50');
    });

    // 3. Add 10% Discount on row 0
    // Gross: 150.00, Discount: 15.00, Taxable: 135.00, Tax 15%: 20.25, Grand Total: 155.25
    const discountInput = document.querySelector('[data-grid-cell="0-discount"]') as HTMLInputElement;
    fireEvent.change(discountInput, { target: { value: '10' } });

    await waitFor(() => {
      expect(grandTotalDisplay?.textContent).toContain('155.25');
    });
  });

  it('adds a new line item row dynamically and aggregates multiple items into the Grand Total', async () => {
    renderForm();

    const grandTotalDisplay = document.querySelector('#grand-total-display');

    // Set row 0: Qty 2, Price 100, Tax 0% (Taxable: 200, Tax: 0 -> Total: 200)
    const qty0 = document.querySelector('[data-grid-cell="0-quantity"]') as HTMLInputElement;
    const price0 = document.querySelector('[data-grid-cell="0-unitPrice"]') as HTMLInputElement;
    const tax0 = document.querySelector('[data-grid-cell="0-taxRate"]') as HTMLInputElement;

    fireEvent.change(qty0, { target: { value: '2' } });
    fireEvent.change(price0, { target: { value: '100' } });
    fireEvent.change(tax0, { target: { value: '0' } });

    await waitFor(() => {
      expect(grandTotalDisplay?.textContent).toContain('200.00');
    });

    // Click "Add Line Item"
    const addBtn = screen.getByRole('button', { name: /Add Line Item|Add Item/i });
    fireEvent.click(addBtn);

    // Row 1 inputs should now exist
    await waitFor(() => {
      const desc1 = document.querySelector('[data-grid-cell="1-description"]');
      expect(desc1).not.toBeNull();
    });

    const qty1 = document.querySelector('[data-grid-cell="1-quantity"]') as HTMLInputElement;
    const price1 = document.querySelector('[data-grid-cell="1-unitPrice"]') as HTMLInputElement;
    const tax1 = document.querySelector('[data-grid-cell="1-taxRate"]') as HTMLInputElement;

    fireEvent.change(qty1, { target: { value: '1' } });
    fireEvent.change(price1, { target: { value: '300' } });
    fireEvent.change(tax1, { target: { value: '0' } });

    // Combined grand total: 200 + 300 = 500
    await waitFor(() => {
      expect(grandTotalDisplay?.textContent).toContain('500.00');
    });
  });

  it('validates required fields and rejects submission when due date is before issue date', async () => {
    renderForm();

    const issueDateInput = screen.getByLabelText(/Issue Date/i) as HTMLInputElement;
    const dueDateInput = screen.getByLabelText(/Due Date/i) as HTMLInputElement;

    fireEvent.change(issueDateInput, { target: { value: '2026-09-20' } });
    fireEvent.change(dueDateInput, { target: { value: '2026-09-10' } }); // Prior to issue date

    const saveBtn = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Due date cannot be before issue date/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
