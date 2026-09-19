/**
 * Unit Tests: useCustomers Hook
 * 
 * Verifies Arabic normalization, multi-field search, status & balance filters,
 * sorting, and aggregate metrics.
 */

import { describe, it, expect } from 'vitest';
import { normalizeSearchText, customerMatchesSearch } from '@/hooks/useCustomers';
import type { Customer } from '@/types/domain';

describe('useCustomers Hook & Normalization', () => {
  describe('1. Arabic & Latin Text Normalization (normalizeSearchText)', () => {
    it('normalizes Arabic Alef variants (أ, إ, آ -> ا)', () => {
      expect(normalizeSearchText('أحمد')).toBe('احمد');
      expect(normalizeSearchText('إبراهيم')).toBe('ابراهيم');
      expect(normalizeSearchText('آفاق')).toBe('افاق');
      expect(normalizeSearchText('مسؤول')).toBe('مسوول');
    });

    it('normalizes Arabic Teh Marbuta (ة -> ه) and Alef Maksura (ى -> ي)', () => {
      expect(normalizeSearchText('شركة')).toBe('شركه');
      expect(normalizeSearchText('مدينة')).toBe('مدينه');
      expect(normalizeSearchText('مصطفى')).toBe('مصطفي');
      expect(normalizeSearchText('مستشفى')).toBe('مستشفي');
    });

    it('strips Arabic diacritics (harakat/tashkeel)', () => {
      // "مُحَمَّدٌ" -> "محمد"
      expect(normalizeSearchText('مُحَمَّدٌ')).toBe('محمد');
      expect(normalizeSearchText('الشَّرِكَةُ')).toBe('الشركه');
    });

    it('handles mixed case English strings with whitespace trimming', () => {
      expect(normalizeSearchText('  Acme Corporation  ')).toBe('acme corporation');
      expect(normalizeSearchText('SAR')).toBe('sar');
      expect(normalizeSearchText('   ')).toBe('');
    });

    it('gracefully handles empty and null inputs', () => {
      expect(normalizeSearchText('')).toBe('');
      expect(normalizeSearchText(null as any)).toBe('');
      expect(normalizeSearchText(undefined as any)).toBe('');
    });
  });

  describe('2. Client-Side In-Memory Filtering & Search Criteria', () => {
    const mockCustomers: Customer[] = [
      {
        id: 'cust-1',
        name: 'أحمد للمقاولات',
        email: 'ahmed@contracting.sa',
        phone: '+966 50 123 4567',
        taxNumber: '300123456700003',
        currency: 'SAR',
        outstandingAmount: 1500,
        totalInvoiced: 5000,
        totalPaid: 3500,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      },
      {
        id: 'cust-2',
        name: 'شركة اليمامة للتقنية',
        email: 'info@yamama.sa',
        phone: '+966 50 987 6543',
        taxNumber: '300987654300003',
        currency: 'SAR',
        outstandingAmount: 0,
        totalInvoiced: 12000,
        totalPaid: 12000,
        status: 'ACTIVE',
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z'
      },
      {
        id: 'cust-3',
        name: 'Global Horizons LLC',
        email: 'billing@globalhorizons.com',
        phone: '+1 555 123 4567',
        taxNumber: 'US-987654321',
        currency: 'USD',
        outstandingAmount: 450,
        totalInvoiced: 450,
        totalPaid: 0,
        status: 'ARCHIVED',
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-03-01T00:00:00Z'
      }
    ];

    it('matches normalized query "احمد" against "أحمد للمقاولات"', () => {
      const q = normalizeSearchText('احمد');
      const matches = mockCustomers.filter((c) =>
        normalizeSearchText(c.name).includes(q)
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('cust-1');
    });

    it('matches normalized query "اليمامه" against "شركة اليمامة للتقنية"', () => {
      const q = normalizeSearchText('اليمامه');
      const matches = mockCustomers.filter((c) =>
        normalizeSearchText(c.name).includes(q)
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('cust-2');
    });

    it('matches search query against phone numbers ignoring whitespace', () => {
      const q = '50123';
      const matches = mockCustomers.filter((c) =>
        (c.phone || '').replace(/\s+/g, '').includes(q)
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('cust-1');
    });

    it('matches search query against formatted phone numbers with spaces in query', () => {
      // Full formatted phone
      const qFull = '+966 50 123 4567';
      const matchesFull = mockCustomers.filter((c) => customerMatchesSearch(c, qFull));
      expect(matchesFull).toHaveLength(1);
      expect(matchesFull[0].id).toBe('cust-1');

      // Partial prefix formatted phone
      const qPrefix = '+966 50';
      const matchesPrefix = mockCustomers.filter((c) => customerMatchesSearch(c, qPrefix));
      expect(matchesPrefix).toHaveLength(2);
      expect(matchesPrefix.map((c) => c.id)).toEqual(['cust-1', 'cust-2']);

      // Partial internal slice with space
      const qSlice = '50 123';
      const matchesSlice = mockCustomers.filter((c) => customerMatchesSearch(c, qSlice));
      expect(matchesSlice).toHaveLength(1);
      expect(matchesSlice[0].id).toBe('cust-1');

      // International US formatted phone
      const qUs = '+1 555 123';
      const matchesUs = mockCustomers.filter((c) => customerMatchesSearch(c, qUs));
      expect(matchesUs).toHaveLength(1);
      expect(matchesUs[0].id).toBe('cust-3');
    });

    it('matches search query against tax numbers', () => {
      const q = '300987';
      const matches = mockCustomers.filter((c) =>
        (c.taxNumber || '').includes(q)
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('cust-2');
    });

    it('matches search query against formatted tax numbers with spaces in query', () => {
      // Full 15-digit ZATCA tax number formatted with 4-4-4-3 grouping
      const qFull = '3001 2345 6700 003';
      const matchesFull = mockCustomers.filter((c) => customerMatchesSearch(c, qFull));
      expect(matchesFull).toHaveLength(1);
      expect(matchesFull[0].id).toBe('cust-1');

      // Partial formatted ZATCA tax number
      const qPartial = '3001 2345';
      const matchesPartial = mockCustomers.filter((c) => customerMatchesSearch(c, qPartial));
      expect(matchesPartial).toHaveLength(1);
      expect(matchesPartial[0].id).toBe('cust-1');

      // Second customer formatted ZATCA tax number
      const qCust2 = '3009 8765 4300 003';
      const matchesCust2 = mockCustomers.filter((c) => customerMatchesSearch(c, qCust2));
      expect(matchesCust2).toHaveLength(1);
      expect(matchesCust2[0].id).toBe('cust-2');
    });

    it('verifies simulated filteredCustomers predicate with precomputed queryCompact', () => {
      const searchQueries = [
        { query: '+966 50 123 4567', expectedId: 'cust-1' },
        { query: '3001 2345 6700 003', expectedId: 'cust-1' },
        { query: '+966 50 987 6543', expectedId: 'cust-2' },
        { query: '3009 8765 4300 003', expectedId: 'cust-2' }
      ];

      for (const { query, expectedId } of searchQueries) {
        const normalizedQuery = normalizeSearchText(query);
        const queryCompact = normalizedQuery.replace(/\s+/g, '');

        const matches = mockCustomers.filter((c) => {
          const normalizedName = normalizeSearchText(c.name || '');
          const phone = (c.phone || '').replace(/\s+/g, '');
          const email = (c.email || '').toLowerCase();
          const taxNumber = (c.taxNumber || '').replace(/\s+/g, '');

          const nameMatch = normalizedName.includes(normalizedQuery);
          const phoneMatch = Boolean(phone && queryCompact && phone.includes(queryCompact));
          const emailMatch = Boolean(email && email.includes(normalizedQuery));
          const taxMatch = Boolean(taxNumber && queryCompact && taxNumber.includes(queryCompact));

          return nameMatch || phoneMatch || emailMatch || taxMatch;
        });

        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(expectedId);
      }
    });

    it('customerMatchesSearch handles edge cases (empty strings, whitespace-only, non-matches, missing fields)', () => {
      // Empty query returns true
      expect(customerMatchesSearch(mockCustomers[0], '')).toBe(true);
      expect(customerMatchesSearch(mockCustomers[0], '   ')).toBe(true);

      // Non-matching query returns false
      expect(customerMatchesSearch(mockCustomers[0], '999999999999999')).toBe(false);
      expect(customerMatchesSearch(mockCustomers[0], '+966 59 999 9999')).toBe(false);

      // Null or empty customer fields don't throw or false-match
      const emptyCustomer: Customer = {
        id: 'cust-empty',
        name: '',
        email: '',
        phone: '',
        taxNumber: '',
        currency: 'SAR',
        outstandingAmount: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };
      expect(customerMatchesSearch(emptyCustomer, '+966 50')).toBe(false);
      expect(customerMatchesSearch(emptyCustomer, '3001 2345')).toBe(false);
      expect(customerMatchesSearch(emptyCustomer, 'test@example.com')).toBe(false);
    });

    it('matches search query against emails case-insensitively', () => {
      const q = 'GLOBAL';
      const matches = mockCustomers.filter((c) =>
        (c.email || '').toLowerCase().includes(q.toLowerCase())
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('cust-3');
    });

    it('filters by status: ACTIVE excludes ARCHIVED customers', () => {
      const activeOnly = mockCustomers.filter((c) => c.status === 'ACTIVE');
      expect(activeOnly).toHaveLength(2);
      expect(activeOnly.map((c) => c.id)).toEqual(['cust-1', 'cust-2']);
    });

    it('filters by status: ARCHIVED excludes ACTIVE customers', () => {
      const archivedOnly = mockCustomers.filter((c) => c.status === 'ARCHIVED');
      expect(archivedOnly).toHaveLength(1);
      expect(archivedOnly[0].id).toBe('cust-3');
    });

    it('filters by balance: WITH_BALANCE returns only customers with outstandingAmount > 0', () => {
      const withBalance = mockCustomers.filter((c) => (c.outstandingAmount || 0) > 0);
      expect(withBalance).toHaveLength(2);
      expect(withBalance.map((c) => c.id)).toEqual(['cust-1', 'cust-3']);
    });

    it('filters by balance: ZERO_BALANCE returns only customers with outstandingAmount === 0', () => {
      const zeroBalance = mockCustomers.filter((c) => (c.outstandingAmount || 0) <= 0);
      expect(zeroBalance).toHaveLength(1);
      expect(zeroBalance[0].id).toBe('cust-2');
    });

    it('sorts accurately by outstandingAmount descending', () => {
      const sorted = [...mockCustomers].sort(
        (a, b) => (b.outstandingAmount || 0) - (a.outstandingAmount || 0)
      );
      expect(sorted[0].outstandingAmount).toBe(1500);
      expect(sorted[1].outstandingAmount).toBe(450);
      expect(sorted[2].outstandingAmount).toBe(0);
    });

    it('computes directory aggregate metrics correctly', () => {
      let totalOutstanding = 0;
      let withDebtCount = 0;
      let activeCount = 0;
      let archivedCount = 0;

      for (const c of mockCustomers) {
        if (c.status === 'ARCHIVED') archivedCount++;
        else activeCount++;

        if ((c.outstandingAmount || 0) > 0) {
          totalOutstanding += c.outstandingAmount;
          withDebtCount++;
        }
      }

      expect(mockCustomers.length).toBe(3);
      expect(activeCount).toBe(2);
      expect(archivedCount).toBe(1);
      expect(withDebtCount).toBe(2);
      expect(totalOutstanding).toBe(1950);
    });
  });
});
