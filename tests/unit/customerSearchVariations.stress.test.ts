import { describe, it, expect } from 'vitest';
import { customerMatchesSearch } from '../../src/hooks/useCustomers';
import { Customer } from '../../src/types/domain';

describe('Empirical Challenger M3 Fix 1: Search Formatted Variations & Whitespace Stress', () => {
  const customerA: Customer = {
    id: 'cust-sa-1',
    name: 'مؤسسة الأفق العالمية للتجارة',
    email: 'billing@alofooq.sa',
    phone: '+966 50 123 4567',
    taxNumber: '300123456700003',
    currency: 'SAR',
    outstandingAmount: 2450.5,
    totalInvoiced: 12450.5,
    totalPaid: 10000.0,
    status: 'ACTIVE',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z'
  };

  const customerB: Customer = {
    id: 'cust-sa-2',
    name: 'شركة التقنية الحديثة',
    email: 'info@moderntech.sa',
    phone: '0501234567', // Stored in local 050 format without country code
    taxNumber: '300987654300003',
    currency: 'SAR',
    outstandingAmount: 0,
    totalInvoiced: 50000,
    totalPaid: 50000,
    status: 'ACTIVE',
    createdAt: '2026-02-15T09:30:00Z',
    updatedAt: '2026-02-15T09:30:00Z'
  };

  const customerHyphenated: Customer = {
    id: 'cust-hyphen',
    name: 'Global Connect Systems',
    email: 'support@globalconnect.com',
    phone: '+966-50-123-4567', // Stored with hyphens
    taxNumber: '3001-2345-6700-003', // Stored with hyphens
    currency: 'SAR',
    outstandingAmount: 100,
    totalInvoiced: 500,
    totalPaid: 400,
    status: 'ACTIVE',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z'
  };

  // =========================================================================
  // 1. Whitespace Remediation Verification
  // =========================================================================
  describe('1. Whitespace Remediation Verification', () => {
    it('1.1 matches full formatted phone with spaces (+966 50 123 4567)', () => {
      expect(customerMatchesSearch(customerA, '+966 50 123 4567')).toBe(true);
    });

    it('1.2 matches partial phone with spaces (+966 50)', () => {
      expect(customerMatchesSearch(customerA, '+966 50')).toBe(true);
    });

    it('1.3 matches internal slice with spaces (50 123)', () => {
      expect(customerMatchesSearch(customerA, '50 123')).toBe(true);
      expect(customerMatchesSearch(customerA, '123 4567')).toBe(true);
    });

    it('1.4 matches full 15-digit ZATCA tax ID formatted with spaces (3001 2345 6700 003)', () => {
      expect(customerMatchesSearch(customerA, '3001 2345 6700 003')).toBe(true);
    });

    it('1.5 matches partial ZATCA tax ID with spaces (3001 2345)', () => {
      expect(customerMatchesSearch(customerA, '3001 2345')).toBe(true);
      expect(customerMatchesSearch(customerA, '6700 003')).toBe(true);
    });

    it('1.6 handles irregular multi-spaces and tabs in query', () => {
      expect(customerMatchesSearch(customerA, '+966   50   123')).toBe(true);
      expect(customerMatchesSearch(customerA, '3001\t2345\t6700')).toBe(true);
    });
  });

  // =========================================================================
  // 2. Formatted Variations (Hyphens, Local vs International Prefix)
  // =========================================================================
  describe('2. Formatted Variations Stress (Hyphens and Prefix Variations)', () => {
    it('2.1 evaluates hyphenated phone query (+966-50)', () => {
      // When customer phone is stored as '+966 50 123 4567' (no hyphens):
      // The whitespace remediation strips \s+, leaving '+966-50' with the hyphen intact.
      // '+966501234567'.includes('+966-50') evaluates to false.
      const matchesUnpunctuated = customerMatchesSearch(customerA, '+966-50');
      expect(matchesUnpunctuated).toBe(false);

      // But when customer phone in DB has hyphens '+966-50-123-4567':
      const matchesHyphenatedRecord = customerMatchesSearch(customerHyphenated, '+966-50');
      expect(matchesHyphenatedRecord).toBe(true);
    });

    it('2.2 evaluates local vs international phone prefix (050 123 4567 vs +966 50 123 4567)', () => {
      // Customer A is stored as international '+966 50 123 4567' (compact: '+966501234567')
      // Query '050 123 4567' (compact: '0501234567')
      // '+966501234567'.includes('0501234567') -> false (different country trunk prefix)
      expect(customerMatchesSearch(customerA, '050 123 4567')).toBe(false);

      // Searching without the local trunk prefix '0' (e.g. '50 123 4567') succeeds against international:
      expect(customerMatchesSearch(customerA, '50 123 4567')).toBe(true);

      // Customer B is stored in local format '0501234567':
      // Query '050 123 4567' succeeds against customer B!
      expect(customerMatchesSearch(customerB, '050 123 4567')).toBe(true);
    });

    it('2.3 evaluates hyphenated tax ID query (3001-2345)', () => {
      // Customer A has unhyphenated taxNumber '300123456700003':
      // Query '3001-2345' contains hyphen, so '300123456700003'.includes('3001-2345') is false:
      expect(customerMatchesSearch(customerA, '3001-2345')).toBe(false);

      // If customer record in DB contains hyphens, it matches:
      expect(customerMatchesSearch(customerHyphenated, '3001-2345')).toBe(true);
    });
  });

  // =========================================================================
  // 3. Negative Cases and Boundary Conditions
  // =========================================================================
  describe('3. Boundary Conditions & Safety', () => {
    it('3.1 does not false-match on empty string or whitespace queries', () => {
      // Per contract: empty query returns true (no filter applied)
      expect(customerMatchesSearch(customerA, '')).toBe(true);
      expect(customerMatchesSearch(customerA, '   ')).toBe(true);
    });

    it('3.2 correctly rejects non-matching phone and tax numbers', () => {
      expect(customerMatchesSearch(customerA, '+966 59 999 9999')).toBe(false);
      expect(customerMatchesSearch(customerA, '3009 9999 9999 999')).toBe(false);
    });

    it('3.3 safely handles customer with null/undefined optional fields', () => {
      const bareCustomer: Customer = {
        id: 'cust-bare',
        name: 'Simple Customer',
        currency: 'SAR',
        outstandingAmount: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      expect(customerMatchesSearch(bareCustomer, '+966 50')).toBe(false);
      expect(customerMatchesSearch(bareCustomer, '3001 2345')).toBe(false);
      expect(customerMatchesSearch(bareCustomer, 'Simple')).toBe(true);
    });
  });
});
