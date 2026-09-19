import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/firebase';
import {
  deleteCustomerAtomic,
  type DeleteCustomerAtomicParams
} from '@/lib/atomicMutations';
import { normalizeSearchText, customerMatchesSearch } from '@/hooks/useCustomers';
import type { Customer } from '@/types/domain';

// Mock Firestore batch
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

describe('Empirical Challenger M3-5: Remediation Stress Harness', () => {
  beforeEach(() => {
    mockCommit.mockClear();
    mockSet.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
  });

  // =========================================================================
  // FOCUS 1: Stress-testing deleteCustomerAtomic
  // =========================================================================
  describe('1. deleteCustomerAtomic Financial Integrity Stress Tests', () => {
    describe('1.1 Credit Balances (outstandingAmount < 0)', () => {
      const creditBalances = [-0.01, -0.05, -1.0, -250.75, -5000, -999999.99];

      creditBalances.forEach((credit) => {
        it(`rejects customer deletion when customer has credit balance of ${credit}`, async () => {
          const params: DeleteCustomerAtomicParams = {
            customerId: `cust-credit-${Math.abs(credit)}`,
            customerName: 'Customer with Credit',
            totalInvoiced: 0,
            totalPaid: 0,
            outstandingAmount: credit
          };

          await expect(deleteCustomerAtomic(params, db)).rejects.toThrow(
            /Cannot delete customer with existing financial history/
          );
          expect(mockCommit).not.toHaveBeenCalled();
          expect(mockDelete).not.toHaveBeenCalled();
        });
      });
    });

    describe('1.2 Recorded Payments (totalPaid > 0)', () => {
      const paymentAmounts = [0.01, 1.0, 50.0, 1500.5, 25000];

      paymentAmounts.forEach((paid) => {
        it(`rejects deletion when customer has recorded payment history of ${paid} even if outstandingAmount is 0`, async () => {
          const params: DeleteCustomerAtomicParams = {
            customerId: `cust-paid-${paid}`,
            customerName: 'Customer with Payment History',
            totalInvoiced: 0,
            totalPaid: paid,
            outstandingAmount: 0
          };

          await expect(deleteCustomerAtomic(params, db)).rejects.toThrow(
            /Cannot delete customer with existing financial history/
          );
          expect(mockCommit).not.toHaveBeenCalled();
          expect(mockDelete).not.toHaveBeenCalled();
        });
      });

      it('defaults totalPaid to 0 when omitted from parameters', async () => {
        const params: DeleteCustomerAtomicParams = {
          customerId: 'cust-no-paid-field',
          customerName: 'Zero Balance Customer',
          totalInvoiced: 0,
          outstandingAmount: 0
        };

        const result = await deleteCustomerAtomic(params, db);
        expect(result.customerId).toBe('cust-no-paid-field');
        expect(mockCommit).toHaveBeenCalledTimes(1);
        expect(mockDelete).toHaveBeenCalledTimes(1);
      });
    });

    describe('1.3 Near-Zero Floating Point Boundaries (Math.abs(outstandingAmount) > 0.001)', () => {
      it('permits deletion for negligible IEEE-754 sub-millicent precision epsilon (e.g. 1e-12)', async () => {
        const params: DeleteCustomerAtomicParams = {
          customerId: 'cust-epsilon-pos',
          customerName: 'Epsilon Positive',
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingAmount: 0.0000000000001
        };

        const result = await deleteCustomerAtomic(params, db);
        expect(result.customerId).toBe('cust-epsilon-pos');
        expect(mockCommit).toHaveBeenCalledTimes(1);
        expect(mockDelete).toHaveBeenCalledTimes(1);
      });

      it('permits deletion for negative negligible IEEE-754 epsilon (e.g. -1e-12)', async () => {
        const params: DeleteCustomerAtomicParams = {
          customerId: 'cust-epsilon-neg',
          customerName: 'Epsilon Negative',
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingAmount: -0.0000000000001
        };

        const result = await deleteCustomerAtomic(params, db);
        expect(result.customerId).toBe('cust-epsilon-neg');
        expect(mockCommit).toHaveBeenCalledTimes(1);
        expect(mockDelete).toHaveBeenCalledTimes(1);
      });

      it('permits deletion when balance is exactly within threshold (0.0009)', async () => {
        const params: DeleteCustomerAtomicParams = {
          customerId: 'cust-sub-milli',
          customerName: 'Sub-Milli Customer',
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingAmount: 0.0009
        };

        const result = await deleteCustomerAtomic(params, db);
        expect(result.customerId).toBe('cust-sub-milli');
        expect(mockCommit).toHaveBeenCalledTimes(1);
      });

      it('rejects deletion when balance strictly exceeds threshold (0.0011)', async () => {
        const params: DeleteCustomerAtomicParams = {
          customerId: 'cust-above-milli',
          customerName: 'Above-Milli Customer',
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingAmount: 0.0011
        };

        await expect(deleteCustomerAtomic(params, db)).rejects.toThrow(
          /Cannot delete customer with existing financial history/
        );
        expect(mockCommit).not.toHaveBeenCalled();
      });

      it('rejects deletion when negative balance strictly exceeds threshold (-0.0011)', async () => {
        const params: DeleteCustomerAtomicParams = {
          customerId: 'cust-neg-above-milli',
          customerName: 'Negative Above-Milli Customer',
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingAmount: -0.0011
        };

        await expect(deleteCustomerAtomic(params, db)).rejects.toThrow(
          /Cannot delete customer with existing financial history/
        );
        expect(mockCommit).not.toHaveBeenCalled();
      });

      it('rejects deletion for standard 1 cent / 1 halala balance (0.01)', async () => {
        const params: DeleteCustomerAtomicParams = {
          customerId: 'cust-one-cent',
          customerName: 'One Cent Debtor',
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingAmount: 0.01
        };

        await expect(deleteCustomerAtomic(params, db)).rejects.toThrow(
          /Cannot delete customer with existing financial history/
        );
        expect(mockCommit).not.toHaveBeenCalled();
      });

      it('rejects deletion for standard 1 cent / 1 halala credit balance (-0.01)', async () => {
        const params: DeleteCustomerAtomicParams = {
          customerId: 'cust-one-cent-credit',
          customerName: 'One Cent Creditor',
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingAmount: -0.01
        };

        await expect(deleteCustomerAtomic(params, db)).rejects.toThrow(
          /Cannot delete customer with existing financial history/
        );
        expect(mockCommit).not.toHaveBeenCalled();
      });
    });

    describe('1.4 Deletion Execution & Audit Trail when Safe', () => {
      it('executes atomic deletion and writes CUSTOMER_UPDATED activity log with action DELETED', async () => {
        const params: DeleteCustomerAtomicParams = {
          customerId: 'cust-clean-123',
          customerName: 'Clean Company LLC',
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingAmount: 0
        };

        const result = await deleteCustomerAtomic(params, db);
        expect(result.customerId).toBe('cust-clean-123');
        expect(mockDelete).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            eventType: 'CUSTOMER_UPDATED',
            entityType: 'CUSTOMER',
            entityId: 'cust-clean-123',
            description: 'Customer Clean Company LLC was permanently deleted',
            metadata: {
              customerId: 'cust-clean-123',
              action: 'DELETED'
            }
          })
        );
        expect(mockCommit).toHaveBeenCalledTimes(1);
      });

      it('falls back to customerId in description when customerName is undefined', async () => {
        const params: DeleteCustomerAtomicParams = {
          customerId: 'cust-nameless',
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingAmount: 0
        };

        await deleteCustomerAtomic(params, db);
        expect(mockSet).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            description: 'Customer cust-nameless was permanently deleted'
          })
        );
      });
    });
  });

  // =========================================================================
  // FOCUS 2: Stress-testing normalizeSearchText with Tatweel combinations
  // =========================================================================
  describe('2. normalizeSearchText Tatweel (ـ) Stress Tests', () => {
    describe('2.1 Variable Tatweel Densities & Repetitions', () => {
      it('strips single Tatweel between letters', () => {
        expect(normalizeSearchText('شـركة')).toBe('شركه');
        expect(normalizeSearchText('عـميل')).toBe('عميل');
        expect(normalizeSearchText('فـاتـورة')).toBe('فاتوره');
      });

      it('strips repeated consecutive Tatweels (3, 5, 10, 50 iterations)', () => {
        expect(normalizeSearchText('شـــركــة')).toBe('شركه');
        expect(normalizeSearchText('شـــــركـــــة')).toBe('شركه');
        expect(normalizeSearchText('شــــــــــركــــــــــة')).toBe('شركه');

        const extremeElongated = 'ش' + 'ـ'.repeat(50) + 'ر' + 'ـ'.repeat(50) + 'كة';
        expect(normalizeSearchText(extremeElongated)).toBe('شركه');
      });

      it('handles leading and trailing Tatweels', () => {
        expect(normalizeSearchText('ـشركة')).toBe('شركه');
        expect(normalizeSearchText('شركةـ')).toBe('شركه');
        expect(normalizeSearchText('ـشركةـ')).toBe('شركه');
        expect(normalizeSearchText('ـــفاتورةـــ')).toBe('فاتوره');
      });

      it('handles strings composed exclusively of Tatweels', () => {
        expect(normalizeSearchText('ـ')).toBe('');
        expect(normalizeSearchText('ــــــــــ')).toBe('');
      });
    });

    describe('2.2 Tatweel Mixed with Diacritics (Harakat & Tashkeel)', () => {
      it('strips Tatweel interleaved with Fatha, Damma, Kasra, Sukun', () => {
        // Al-Riyadh with tatweel and tashkeel
        expect(normalizeSearchText('الـرَّيـَــاض')).toBe('الرياض');
        // Mu'amalah with tatweel and harakat
        expect(normalizeSearchText('مُـعـَـامَـلَـة')).toBe('معامله');
        // Mustawda'at with multiple tatweels
        expect(normalizeSearchText('مُـسْتَوْدَعـَات')).toBe('مستودعات');
        // Sharikah with tanwin and tatweel
        expect(normalizeSearchText('شَـــــرِكـَـــةٌ')).toBe('شركه');
      });

      it('strips stacked Shaddah and Tanwin surrounded by Tatweel', () => {
        expect(normalizeSearchText('مُـحَـمَّـدٌ')).toBe('محمد');
        expect(normalizeSearchText('عـَـلِــيٌّ')).toBe('علي');
      });
    });

    describe('2.3 Tatweel Mixed with Hamza Forms & Alef Variants', () => {
      it('normalizes Muassasa with various Tatweel and Hamza spellings to "موسسه"', () => {
        expect(normalizeSearchText('مـؤسـســة')).toBe('موسسه');
        expect(normalizeSearchText('مـَــؤُسَّـسَـــة')).toBe('موسسه');
        expect(normalizeSearchText('مؤسـســة')).toBe('موسسه');
        expect(normalizeSearchText('مــــؤســــســــة')).toBe('موسسه');
      });

      it('normalizes I\'lan and Ajhiza with Tatweels and Alef variants', () => {
        expect(normalizeSearchText('إِعْـــــلَان')).toBe('اعلان');
        expect(normalizeSearchText('أَجْـــــهِـزَة')).toBe('اجهزه');
        expect(normalizeSearchText('آلَـــــات')).toBe('الات');
      });

      it('normalizes Yeh with Hamza and Waw with Hamza surrounded by Tatweel', () => {
        expect(normalizeSearchText('هَـــــيْـئَـــة')).toBe('هييه');
        expect(normalizeSearchText('مَـــــسْـؤُول')).toBe('مسوول');
      });
    });

    describe('2.4 Realistic Multi-Word Arabic Business Names', () => {
      const names = [
        {
          stylized: 'مـؤسـســة الـنـــور لـلـتـجـارة والـمـقـاولات',
          plain: 'مؤسسة النور للتجارة والمقاولات'
        },
        {
          stylized: 'شـركـة وادي الـتـقـنـيـة الـعـالـمـيـة الـمـحـدودة',
          plain: 'شركة وادي التقنية العالمية المحدودة'
        },
        {
          stylized: 'مـكـتـب الأُفُــــق لـلـخـدمـات اللـوجـسـتـيـة',
          plain: 'مكتب الأفق للخدمات اللوجستية'
        }
      ];

      names.forEach(({ stylized, plain }) => {
        it(`normalizes stylized "${stylized}" identically to plain "${plain}"`, () => {
          expect(normalizeSearchText(stylized)).toBe(normalizeSearchText(plain));
        });
      });
    });

    describe('2.5 Search Matching Invariance (customerMatchesSearch)', () => {
      const sampleCustomer: Customer = {
        id: 'cust-tatweel-1',
        name: 'شــــركـة الـــنور الـتـجـاريـة',
        email: 'info@alnoor.sa',
        phone: '+966 50 123 4567',
        taxNumber: '300012345600003',
        currency: 'SAR',
        outstandingAmount: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      it('matches when user query is plain Arabic without Tatweel', () => {
        expect(customerMatchesSearch(sampleCustomer, 'شركة النور')).toBe(true);
        expect(customerMatchesSearch(sampleCustomer, 'التجارية')).toBe(true);
      });

      it('matches when user query contains arbitrary Tatweel characters', () => {
        expect(customerMatchesSearch(sampleCustomer, 'شـــــركة')).toBe(true);
        expect(customerMatchesSearch(sampleCustomer, 'الـنـــور')).toBe(true);
        expect(customerMatchesSearch(sampleCustomer, 'الـتـجـاريـة')).toBe(true);
      });

      it('matches when query contains Tashkeel, Hamzas, and Tatweels', () => {
        expect(customerMatchesSearch(sampleCustomer, 'شَـــــرِكـَةُ الـنُّـــورِ')).toBe(true);
      });

      it('returns true when query consists purely of Tatweels (evaluates to empty search)', () => {
        expect(customerMatchesSearch(sampleCustomer, 'ـــــــــ')).toBe(true);
      });

      it('matches customer phone and taxNumber even when spaces, formatting, or Tatweels are in query', () => {
        expect(customerMatchesSearch(sampleCustomer, '50 123 4567')).toBe(true);
        expect(customerMatchesSearch(sampleCustomer, '+966 50 123 4567')).toBe(true);
        expect(customerMatchesSearch(sampleCustomer, '3000 1234 5600 003')).toBe(true);
        // Query with Tatweel in tax number or phone digits
        expect(customerMatchesSearch(sampleCustomer, '3000ـ1234ـ5600ـ003')).toBe(true);
      });
    });
  });
});
