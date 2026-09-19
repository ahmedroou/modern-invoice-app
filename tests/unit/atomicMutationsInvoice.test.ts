import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/firebase';
import {
  createInvoiceAtomic,
  updateInvoiceAtomic,
  cancelInvoiceAtomic,
  recordPaymentAtomic,
  type CreateInvoiceAtomicParams,
  type UpdateInvoiceAtomicParams,
  type CancelInvoiceAtomicParams,
  type RecordPaymentAtomicParams
} from '@/lib/atomicMutations';
import type { Invoice } from '@/types/domain';

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

describe('Invoice Atomic Mutations (updateInvoiceAtomic & cancelInvoiceAtomic)', () => {
  beforeEach(() => {
    mockCommit.mockClear();
    mockSet.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
  });

  describe('1. createInvoiceAtomic baseline', () => {
    it('creates an invoice document and increments customer debt and invoiced amounts', async () => {
      const params: CreateInvoiceAtomicParams = {
        invoice: {
          id: 'inv-101',
          invoiceNumber: 'INV-2026-0101',
          customerId: 'cust-101',
          customerName: 'Alpha Tech',
          issueDate: '2026-09-01',
          dueDate: '2026-09-15',
          currency: 'SAR',
          items: [],
          subtotal: 1000,
          totalDiscount: 0,
          totalTax: 150,
          grandTotal: 1150
        }
      };

      const result = await createInvoiceAtomic(params, db);
      expect(result.invoiceId).toBe('inv-101');
      expect(mockCommit).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'inv-101',
          grandTotal: 1150,
          amountDue: 1150,
          status: 'UNPAID'
        })
      );
    });
  });

  describe('2. updateInvoiceAtomic', () => {
    it('calculates deltas for amountDue and grandTotal and updates customer document atomically', async () => {
      const oldInvoice: Invoice = {
        id: 'inv-201',
        invoiceNumber: 'INV-2026-0201',
        customerId: 'cust-201',
        customerName: 'Beta Corp',
        issueDate: '2026-09-01',
        dueDate: '2026-09-20',
        currency: 'SAR',
        items: [],
        subtotal: 500,
        totalDiscount: 0,
        totalTax: 75,
        grandTotal: 575,
        amountPaid: 100,
        amountDue: 475,
        status: 'PARTIALLY_PAID',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z'
      };

      const params: UpdateInvoiceAtomicParams = {
        invoiceId: 'inv-201',
        oldInvoice,
        updates: {
          grandTotal: 800,
          subtotal: 700,
          totalTax: 100
        }
      };

      const result = await updateInvoiceAtomic(params, db);

      expect(result.invoiceId).toBe('inv-201');
      expect(result.deltaGrandTotal).toBe(225); // 800 - 575 = 225
      expect(result.deltaAmountDue).toBe(225);   // (800 - 100) - 475 = 700 - 475 = 225
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify customer update was invoked with increments
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          grandTotal: 800,
          amountDue: 700,
          status: 'PARTIALLY_PAID'
        })
      );
    });

    it('auto-transitions invoice status to PAID if edited grandTotal equals amount already paid', async () => {
      const oldInvoice: Invoice = {
        id: 'inv-202',
        invoiceNumber: 'INV-2026-0202',
        customerId: 'cust-202',
        customerName: 'Gamma Ltd',
        issueDate: '2026-09-01',
        dueDate: '2026-09-20',
        currency: 'USD',
        items: [],
        subtotal: 1000,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 1000,
        amountPaid: 500,
        amountDue: 500,
        status: 'PARTIALLY_PAID',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z'
      };

      // Reduce invoice to exactly 500 (matching 500 already paid)
      const params: UpdateInvoiceAtomicParams = {
        invoiceId: 'inv-202',
        oldInvoice,
        updates: {
          grandTotal: 500
        }
      };

      const result = await updateInvoiceAtomic(params, db);
      expect(result.updatedInvoice.status).toBe('PAID');
      expect(result.updatedInvoice.amountDue).toBe(0);
      expect(result.deltaAmountDue).toBe(-500);
    });

    it('handles customer reassignment by debiting new customer and crediting old customer', async () => {
      const oldInvoice: Invoice = {
        id: 'inv-203',
        invoiceNumber: 'INV-2026-0203',
        customerId: 'cust-old',
        customerName: 'Old Customer',
        issueDate: '2026-09-01',
        dueDate: '2026-09-20',
        currency: 'SAR',
        items: [],
        subtotal: 300,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 300,
        amountPaid: 0,
        amountDue: 300,
        status: 'UNPAID',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z'
      };

      const params: UpdateInvoiceAtomicParams = {
        invoiceId: 'inv-203',
        oldInvoice,
        updates: {
          customerId: 'cust-new',
          customerName: 'New Customer',
          grandTotal: 400
        }
      };

      const result = await updateInvoiceAtomic(params, db);
      expect(result.invoiceId).toBe('inv-203');
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. cancelInvoiceAtomic', () => {
    it('sets status to CANCELLED, zeroes amountDue, and decrements customer debt', async () => {
      const currentInvoice: Invoice = {
        id: 'inv-301',
        invoiceNumber: 'INV-2026-0301',
        customerId: 'cust-301',
        customerName: 'Delta Systems',
        issueDate: '2026-09-01',
        dueDate: '2026-09-25',
        currency: 'SAR',
        items: [],
        subtotal: 600,
        totalDiscount: 0,
        totalTax: 90,
        grandTotal: 690,
        amountPaid: 200,
        amountDue: 490,
        status: 'PARTIALLY_PAID',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z'
      };

      const params: CancelInvoiceAtomicParams = {
        invoiceId: 'inv-301',
        currentInvoice,
        reason: 'Customer requested order cancellation'
      };

      const result = await cancelInvoiceAtomic(params, db);
      expect(result.invoiceId).toBe('inv-301');
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify invoice update zeroes amountDue and sets status CANCELLED
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'CANCELLED',
          amountDue: 0
        })
      );
    });

    it('rejects attempt to cancel an invoice that is already CANCELLED', async () => {
      const params: CancelInvoiceAtomicParams = {
        invoiceId: 'inv-302',
        invoiceNumber: 'INV-2026-0302',
        customerId: 'cust-302',
        amountDue: 0,
        currentStatus: 'CANCELLED'
      };

      await expect(cancelInvoiceAtomic(params, db)).rejects.toThrow(
        'Invoice #INV-2026-0302 is already cancelled.'
      );
      expect(mockCommit).not.toHaveBeenCalled();
    });
  });

  describe('4. recordPaymentAtomic enhancements', () => {
    const baseInvoice = {
      id: 'inv-401',
      invoiceNumber: 'INV-2026-0401',
      grandTotal: 500,
      amountPaid: 100,
      amountDue: 400,
      status: 'PARTIALLY_PAID' as const,
      customerId: 'cust-401',
      customerName: 'Epsilon Enterprises'
    };

    it('handles overpayments gracefully by clamping amountDue to 0 and marking PAID', async () => {
      const params: RecordPaymentAtomicParams = {
        payment: {
          paymentNumber: 'PAY-2026-0001',
          invoiceId: baseInvoice.id,
          invoiceNumber: baseInvoice.invoiceNumber,
          customerId: baseInvoice.customerId,
          customerName: baseInvoice.customerName,
          amount: 400.01,
          paymentDate: '2026-09-19',
          paymentMethod: 'CASH'
        },
        currentInvoice: baseInvoice
      };

      const result = await recordPaymentAtomic(params, db);
      expect(result.newAmountDue).toBe(0);
      expect(result.newInvoiceStatus).toBe('PAID');
      expect(result.newAmountPaid).toBe(500.01);
      expect(mockCommit).toHaveBeenCalled();
    });

    it('retains OVERDUE status when partial payment is made on an overdue invoice', async () => {
      const overdueInvoice = {
        ...baseInvoice,
        dueDate: '2026-01-01',
        status: 'OVERDUE' as const
      };

      const params: RecordPaymentAtomicParams = {
        payment: {
          paymentNumber: 'PAY-2026-OVERDUE',
          invoiceId: overdueInvoice.id,
          invoiceNumber: overdueInvoice.invoiceNumber,
          customerId: overdueInvoice.customerId,
          customerName: overdueInvoice.customerName,
          amount: 50,
          paymentDate: '2026-09-19',
          paymentMethod: 'CASH'
        },
        currentInvoice: overdueInvoice
      };

      const result = await recordPaymentAtomic(params, db);
      expect(result.newInvoiceStatus).toBe('OVERDUE');
      expect(result.newAmountDue).toBe(350);
    });

    it('rejects payment on an already PAID invoice', async () => {
      const paidInvoice = {
        ...baseInvoice,
        amountPaid: 500,
        amountDue: 0,
        status: 'PAID' as const
      };

      const params: RecordPaymentAtomicParams = {
        payment: {
          paymentNumber: 'PAY-2026-0002',
          invoiceId: paidInvoice.id,
          invoiceNumber: paidInvoice.invoiceNumber,
          customerId: paidInvoice.customerId,
          customerName: paidInvoice.customerName,
          amount: 50,
          paymentDate: '2026-09-19',
          paymentMethod: 'BANK_TRANSFER'
        },
        currentInvoice: paidInvoice
      };

      await expect(recordPaymentAtomic(params, db)).rejects.toThrow(
        'Invoice is already fully paid'
      );
    });

    it('rejects payment on a CANCELLED invoice', async () => {
      const cancelledInvoice = {
        ...baseInvoice,
        status: 'CANCELLED' as const
      };

      const params: RecordPaymentAtomicParams = {
        payment: {
          paymentNumber: 'PAY-2026-0003',
          invoiceId: cancelledInvoice.id,
          invoiceNumber: cancelledInvoice.invoiceNumber,
          customerId: cancelledInvoice.customerId,
          customerName: cancelledInvoice.customerName,
          amount: 100,
          paymentDate: '2026-09-19',
          paymentMethod: 'CREDIT_CARD'
        },
        currentInvoice: cancelledInvoice
      };

      await expect(recordPaymentAtomic(params, db)).rejects.toThrow(
        'Cannot record payment on a cancelled invoice'
      );
    });

    it('transitions invoice to PAID upon full settlement', async () => {
      const params: RecordPaymentAtomicParams = {
        payment: {
          paymentNumber: 'PAY-2026-0004',
          invoiceId: baseInvoice.id,
          invoiceNumber: baseInvoice.invoiceNumber,
          customerId: baseInvoice.customerId,
          customerName: baseInvoice.customerName,
          amount: 400,
          paymentDate: '2026-09-19',
          paymentMethod: 'BANK_TRANSFER'
        },
        currentInvoice: baseInvoice
      };

      const result = await recordPaymentAtomic(params, db);
      expect(result.newInvoiceStatus).toBe('PAID');
      expect(result.newAmountDue).toBe(0);
      expect(result.newAmountPaid).toBe(500);
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. DRAFT invoice accounting lifecycle', () => {
    it('creates a DRAFT invoice without incrementing customer outstanding debt or total invoiced', async () => {
      const params: CreateInvoiceAtomicParams = {
        invoice: {
          id: 'inv-draft-01',
          invoiceNumber: 'INV-2026-DRAFT',
          customerId: 'cust-draft-1',
          customerName: 'Draft Customer',
          issueDate: '2026-09-19',
          dueDate: '2026-10-01',
          currency: 'SAR',
          items: [],
          subtotal: 1000,
          totalDiscount: 0,
          totalTax: 150,
          grandTotal: 1150,
          status: 'DRAFT'
        }
      };

      const result = await createInvoiceAtomic(params, db);
      expect(result.invoiceId).toBe('inv-draft-01');
      expect(result.invoice.status).toBe('DRAFT');
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify customer update did NOT increment outstandingAmount or totalInvoiced
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({
          outstandingAmount: expect.anything(),
          totalInvoiced: expect.anything()
        })
      );
    });

    it('transitioning DRAFT invoice to UNPAID debits customer outstanding debt and total invoiced', async () => {
      const draftInvoice: Invoice = {
        id: 'inv-draft-02',
        invoiceNumber: 'INV-2026-DRAFT2',
        customerId: 'cust-draft-2',
        customerName: 'Draft Customer 2',
        issueDate: '2026-09-19',
        dueDate: '2026-10-01',
        currency: 'SAR',
        items: [],
        subtotal: 500,
        totalDiscount: 0,
        totalTax: 75,
        grandTotal: 575,
        amountPaid: 0,
        amountDue: 575,
        status: 'DRAFT',
        createdAt: '2026-09-19T10:00:00Z',
        updatedAt: '2026-09-19T10:00:00Z'
      };

      const params: UpdateInvoiceAtomicParams = {
        invoiceId: 'inv-draft-02',
        oldInvoice: draftInvoice,
        updates: {
          status: 'UNPAID'
        }
      };

      const result = await updateInvoiceAtomic(params, db);
      expect(result.invoiceId).toBe('inv-draft-02');
      expect(result.updatedInvoice.status).toBe('UNPAID');
      expect(result.deltaAmountDue).toBe(575);
      expect(result.deltaGrandTotal).toBe(575);
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    it('cancelling a DRAFT invoice zeroes amountDue without decrementing customer debt', async () => {
      const draftInvoice: Invoice = {
        id: 'inv-draft-03',
        invoiceNumber: 'INV-2026-DRAFT3',
        customerId: 'cust-draft-3',
        customerName: 'Draft Customer 3',
        issueDate: '2026-09-19',
        dueDate: '2026-10-01',
        currency: 'SAR',
        items: [],
        subtotal: 200,
        totalDiscount: 0,
        totalTax: 30,
        grandTotal: 230,
        amountPaid: 0,
        amountDue: 230,
        status: 'DRAFT',
        createdAt: '2026-09-19T10:00:00Z',
        updatedAt: '2026-09-19T10:00:00Z'
      };

      const params: CancelInvoiceAtomicParams = {
        invoiceId: 'inv-draft-03',
        currentInvoice: draftInvoice,
        currentStatus: 'DRAFT'
      };

      const result = await cancelInvoiceAtomic(params, db);
      expect(result.invoiceId).toBe('inv-draft-03');
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify customer update did NOT decrement outstandingAmount
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({
          outstandingAmount: expect.anything()
        })
      );
    });
  });
});
