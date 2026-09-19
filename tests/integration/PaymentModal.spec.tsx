import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaymentModal } from '@/components/modules/payments/PaymentModal';
import { DirectionProvider } from '@/context/DirectionContext';
import type { Invoice } from '@/types/domain';

const mockRecordPayment = vi.fn().mockResolvedValue({
  paymentId: 'pay-new-1',
  activityLogId: 'log-new-1',
  newInvoiceStatus: 'PAID',
  newAmountDue: 0,
  newAmountPaid: 600
});

vi.mock('@/hooks/usePayments', () => ({
  usePayments: () => ({
    recordPayment: mockRecordPayment,
    getNextPaymentNumber: () => 'PAY-2026-0001'
  })
}));

describe('Integration Test: PaymentModal Component (AC5 & Overpayment Validation)', () => {
  const sampleInvoice: Invoice = {
    id: 'inv-pay-01',
    invoiceNumber: 'INV-2026-0500',
    customerId: 'cust-500',
    customerName: 'Zeta Technologies',
    issueDate: '2026-09-01',
    dueDate: '2026-09-20',
    currency: 'SAR',
    items: [],
    subtotal: 600,
    totalDiscount: 0,
    totalTax: 0,
    grandTotal: 600,
    amountPaid: 0,
    amountDue: 600,
    status: 'UNPAID',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z'
  };

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    mockRecordPayment.mockClear();
    mockOnClose.mockClear();
    mockOnSuccess.mockClear();
  });

  const renderModal = (invoice = sampleInvoice) => {
    return render(
      <DirectionProvider>
        <PaymentModal
          isOpen={true}
          invoice={invoice}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </DirectionProvider>
    );
  };

  it('AC5: defaults payment amount to exact amountDue and submits full payment', async () => {
    renderModal();

    const amountInput = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(amountInput.value).toBe('600.00');

    // Submit payment
    const submitBtn = screen.getByRole('button', { name: /Record Payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRecordPayment).toHaveBeenCalledTimes(1);
    });

    expect(mockRecordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: expect.objectContaining({
          amount: 600,
          invoiceId: 'inv-pay-01',
          paymentNumber: 'PAY-2026-0001'
        })
      })
    );
    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('verifies quick-fill "50%" and "100% Full" buttons calculate accurately', async () => {
    renderModal();

    const amountInput = screen.getByRole('spinbutton') as HTMLInputElement;

    // Click 50%
    const halfBtn = screen.getByRole('button', { name: /50%/i });
    fireEvent.click(halfBtn);
    expect(amountInput.value).toBe('300.00');

    // Click 100% Full
    const fullBtn = screen.getByRole('button', { name: /100% Full/i });
    fireEvent.click(fullBtn);
    expect(amountInput.value).toBe('600.00');
  });

  it('rejects overpayments when entered amount exceeds amountDue', async () => {
    renderModal();

    const amountInput = screen.getByRole('spinbutton') as HTMLInputElement;

    // Attempt to pay 600.01 (exceeds 600.00 amountDue)
    fireEvent.change(amountInput, { target: { value: '600.01' } });

    const submitBtn = screen.getByRole('button', { name: /Record Payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Payment cannot exceed amount due/i)).toBeInTheDocument();
    });
    expect(mockRecordPayment).not.toHaveBeenCalled();
  });

  it('rejects zero and negative payment amounts', async () => {
    renderModal();

    const amountInput = screen.getByRole('spinbutton') as HTMLInputElement;

    // Enter 0
    fireEvent.change(amountInput, { target: { value: '0' } });

    const submitBtn = screen.getByRole('button', { name: /Record Payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Payment amount must be greater than 0.00/i)).toBeInTheDocument();
    });
    expect(mockRecordPayment).not.toHaveBeenCalled();
  });
});
