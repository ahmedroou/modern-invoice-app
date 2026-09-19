import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/firebase';
import {
  updateCustomerAtomic,
  archiveCustomerAtomic,
  deleteCustomerAtomic,
  type UpdateCustomerAtomicParams,
  type ArchiveCustomerAtomicParams,
  type DeleteCustomerAtomicParams
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

describe('Customer Atomic Multi-Document Mutations', () => {
  beforeEach(() => {
    mockCommit.mockClear();
    mockSet.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
  });

  describe('1. updateCustomerAtomic', () => {
    it('updates customer profile and records activity log atomically using writeBatch', async () => {
      const params: UpdateCustomerAtomicParams = {
        customerId: 'cust-123',
        updates: {
          name: 'Acme Middle East Ltd',
          phone: '+966 50 111 2222',
          email: 'finance@acme.sa',
          address: 'Riyadh, KSA',
          taxNumber: '300012345600003'
        }
      };

      const result = await updateCustomerAtomic(params, db);

      expect(result.customerId).toBe('cust-123');
      expect(result.updatedFields.name).toBe('Acme Middle East Ltd');
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify customer update called with trimmed fields
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Acme Middle East Ltd',
          phone: '+966 50 111 2222',
          email: 'finance@acme.sa',
          address: 'Riyadh, KSA',
          taxNumber: '300012345600003'
        })
      );

      // Verify activity log recorded
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'CUSTOMER_UPDATED',
          entityType: 'CUSTOMER',
          entityId: 'cust-123'
        })
      );
    });

    it('defensively strips financial fields from updates to protect ledger invariants', async () => {
      const maliciousUpdates: any = {
        name: 'Safe Name',
        outstandingAmount: 0,
        totalInvoiced: 999999,
        totalPaid: 999999
      };

      await updateCustomerAtomic({ customerId: 'cust-123', updates: maliciousUpdates }, db);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({
          outstandingAmount: 0,
          totalInvoiced: 999999,
          totalPaid: 999999
        })
      );
    });
  });

  describe('2. archiveCustomerAtomic', () => {
    it('sets customer status to ARCHIVED and records activity log', async () => {
      const params: ArchiveCustomerAtomicParams = {
        customerId: 'cust-456',
        customerName: 'Old Partner Corp'
      };

      const result = await archiveCustomerAtomic(params, db);

      expect(result.customerId).toBe('cust-456');
      expect(mockCommit).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'ARCHIVED'
        })
      );
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'CUSTOMER_UPDATED',
          metadata: expect.objectContaining({ action: 'ARCHIVED' })
        })
      );
    });
  });

  describe('3. deleteCustomerAtomic', () => {
    it('successfully deletes customer when totalInvoiced === 0 and outstandingAmount === 0', async () => {
      const params: DeleteCustomerAtomicParams = {
        customerId: 'cust-zero',
        customerName: 'Zero Balance Customer',
        totalInvoiced: 0,
        outstandingAmount: 0
      };

      const result = await deleteCustomerAtomic(params, db);

      expect(result.customerId).toBe('cust-zero');
      expect(mockCommit).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledWith(expect.anything());
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'CUSTOMER_UPDATED',
          metadata: expect.objectContaining({ action: 'DELETED' })
        })
      );
    });

    it('throws an error and prevents deletion when totalInvoiced > 0', async () => {
      const params: DeleteCustomerAtomicParams = {
        customerId: 'cust-has-invoices',
        customerName: 'Invoiced Customer',
        totalInvoiced: 5000,
        outstandingAmount: 0
      };

      await expect(deleteCustomerAtomic(params, db)).rejects.toThrow(
        /Cannot delete customer with existing financial history/
      );
      expect(mockCommit).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('throws an error and prevents deletion when outstandingAmount > 0', async () => {
      const params: DeleteCustomerAtomicParams = {
        customerId: 'cust-debtor',
        customerName: 'Debtor Customer',
        totalInvoiced: 0,
        outstandingAmount: 1200
      };

      await expect(deleteCustomerAtomic(params, db)).rejects.toThrow(
        /Cannot delete customer with existing financial history/
      );
      expect(mockCommit).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('throws an error and prevents deletion when customer has a credit balance (outstandingAmount < 0)', async () => {
      const params: DeleteCustomerAtomicParams = {
        customerId: 'cust-credit-balance',
        customerName: 'Credit Balance Customer',
        totalInvoiced: 0,
        outstandingAmount: -350
      };

      await expect(deleteCustomerAtomic(params, db)).rejects.toThrow(
        /Cannot delete customer with existing financial history/
      );
      expect(mockCommit).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('throws an error and prevents deletion when customer has recorded payments (totalPaid > 0)', async () => {
      const params: DeleteCustomerAtomicParams = {
        customerId: 'cust-paid-history',
        customerName: 'Advance Payment Customer',
        totalInvoiced: 0,
        totalPaid: 1000,
        outstandingAmount: 0
      };

      await expect(deleteCustomerAtomic(params, db)).rejects.toThrow(
        /Cannot delete customer with existing financial history/
      );
      expect(mockCommit).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
