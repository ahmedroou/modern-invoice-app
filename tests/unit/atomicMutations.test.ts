import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/firebase';
import {
  createInvoiceAtomic,
  recordPaymentAtomic,
  createCustomerAtomic,
  type CreateInvoiceAtomicParams,
  type RecordPaymentAtomicParams
} from '@/lib/atomicMutations';

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

describe('Atomic Multi-Document Mutations (src/lib/atomicMutations.ts)', () => {
  beforeEach(() => {
    mockCommit.mockClear();
    mockSet.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
  });

  describe('1. createInvoiceAtomic', () => {
    it('atomically creates invoice, updates customer balance, and records activity log', async () => {
      const params: CreateInvoiceAtomicParams = {
        invoice: {
          id: 'inv-test-001',
          invoiceNumber: 'INV-2026-001',
          customerId: 'cust-100',
          customerName: 'Acme Corp',
          issueDate: '2026-09-19',
          dueDate: '2026-10-19',
          currency: 'USD',
          items: [
            {
              id: 'item-1',
              description: 'Consulting Services',
              quantity: 10,
              unitPrice: 150,
              discount: 10,
              discountType: 'PERCENTAGE',
              taxRate: 15,
              lineDiscount: 150,
              lineTax: 202.5,
              lineTotal: 1552.5
            }
          ],
          subtotal: 1500,
          totalDiscount: 150,
          totalTax: 202.5,
          grandTotal: 1552.5,
          amountPaid: 0
        }
      };

      const result = await createInvoiceAtomic(params, db);

      expect(result.invoiceId).toBe('inv-test-001');
      expect(result.invoice.amountDue).toBe(1552.5);
      expect(result.invoice.status).toBe('UNPAID');
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify 3 operations in batch:
      // 1. Invoice set
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'inv-test-001',
          grandTotal: 1552.5,
          amountDue: 1552.5,
          status: 'UNPAID'
        })
      );

      // 2. Customer update (increment outstanding balance and total invoiced)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          outstandingAmount: expect.anything(),
          totalInvoiced: expect.anything()
        })
      );

      // 3. Activity log set
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'INVOICE_CREATED',
          entityType: 'INVOICE',
          entityId: 'inv-test-001'
        })
      );
    });

    it('marks invoice as PAID immediately when amountPaid equals grandTotal', async () => {
      const params: CreateInvoiceAtomicParams = {
        invoice: {
          id: 'inv-paid-001',
          invoiceNumber: 'INV-2026-PAID',
          customerId: 'cust-100',
          customerName: 'Acme Corp',
          issueDate: '2026-09-19',
          dueDate: '2026-10-19',
          currency: 'USD',
          items: [],
          subtotal: 100,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 100,
          amountPaid: 100
        }
      };

      const result = await createInvoiceAtomic(params, db);
      expect(result.invoice.amountDue).toBe(0);
      expect(result.invoice.status).toBe('PAID');
    });
  });

  describe('2. recordPaymentAtomic', () => {
    it('atomically records full payment, transitions invoice to PAID, and decrements balance', async () => {
      const params: RecordPaymentAtomicParams = {
        payment: {
          id: 'pay-001',
          paymentNumber: 'PAY-2026-001',
          invoiceId: 'inv-test-001',
          invoiceNumber: 'INV-2026-001',
          customerId: 'cust-100',
          customerName: 'Acme Corp',
          amount: 500,
          paymentDate: '2026-09-19',
          paymentMethod: 'BANK_TRANSFER'
        },
        currentInvoice: {
          id: 'inv-test-001',
          invoiceNumber: 'INV-2026-001',
          grandTotal: 500,
          amountPaid: 0,
          amountDue: 500,
          status: 'UNPAID',
          customerId: 'cust-100',
          customerName: 'Acme Corp'
        }
      };

      const result = await recordPaymentAtomic(params, db);

      expect(result.paymentId).toBe('pay-001');
      expect(result.newInvoiceStatus).toBe('PAID');
      expect(result.newAmountDue).toBe(0);
      expect(result.newAmountPaid).toBe(500);
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify operations:
      // 1. Payment doc set
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'pay-001',
          amount: 500,
          paymentMethod: 'BANK_TRANSFER'
        })
      );

      // 2. Invoice doc updated (status PAID)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'PAID'
        })
      );

      // 3. Customer doc updated
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          outstandingAmount: expect.anything(),
          totalPaid: expect.anything()
        })
      );

      // 4. Activity Log set
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'PAYMENT_RECORDED',
          entityType: 'PAYMENT',
          entityId: 'pay-001'
        })
      );
    });

    it('atomically records partial payment and transitions invoice to PARTIALLY_PAID', async () => {
      const params: RecordPaymentAtomicParams = {
        payment: {
          id: 'pay-partial-001',
          paymentNumber: 'PAY-2026-002',
          invoiceId: 'inv-test-001',
          invoiceNumber: 'INV-2026-001',
          customerId: 'cust-100',
          customerName: 'Acme Corp',
          amount: 200,
          paymentDate: '2026-09-19',
          paymentMethod: 'CASH'
        },
        currentInvoice: {
          id: 'inv-test-001',
          invoiceNumber: 'INV-2026-001',
          grandTotal: 500,
          amountPaid: 0,
          amountDue: 500,
          status: 'UNPAID',
          customerId: 'cust-100',
          customerName: 'Acme Corp'
        }
      };

      const result = await recordPaymentAtomic(params, db);

      expect(result.newInvoiceStatus).toBe('PARTIALLY_PAID');
      expect(result.newAmountDue).toBe(300);
      expect(result.newAmountPaid).toBe(200);
    });

    it('throws error when payment amount is zero or negative', async () => {
      const invalidParams: RecordPaymentAtomicParams = {
        payment: {
          paymentNumber: 'PAY-000',
          invoiceId: 'inv-1',
          invoiceNumber: 'INV-1',
          customerId: 'cust-1',
          customerName: 'Customer',
          amount: 0,
          paymentDate: '2026-09-19',
          paymentMethod: 'CASH'
        },
        currentInvoice: {
          id: 'inv-1',
          invoiceNumber: 'INV-1',
          grandTotal: 100,
          amountPaid: 0,
          amountDue: 100,
          status: 'UNPAID',
          customerId: 'cust-1',
          customerName: 'Customer'
        }
      };

      await expect(recordPaymentAtomic(invalidParams, db)).rejects.toThrow(
        'Payment amount must be greater than 0'
      );
    });
  });

  describe('3. createCustomerAtomic', () => {
    it('creates customer with zero initial balances and logs registration event', async () => {
      const result = await createCustomerAtomic(
        {
          customer: {
            id: 'cust-new-001',
            name: 'Saudi Arabian Enterprises',
            currency: 'SAR',
            status: 'ACTIVE'
          }
        },
        db
      );

      expect(result.customerId).toBe('cust-new-001');
      expect(result.customer.outstandingAmount).toBe(0);
      expect(result.customer.totalInvoiced).toBe(0);
      expect(result.customer.totalPaid).toBe(0);
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify customer set
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'cust-new-001',
          name: 'Saudi Arabian Enterprises',
          outstandingAmount: 0
        })
      );

      // Verify activity log set
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'CUSTOMER_CREATED',
          entityType: 'CUSTOMER',
          entityId: 'cust-new-001'
        })
      );
    });
  });
});
