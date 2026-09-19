import { describe, it, expect, beforeEach } from 'vitest';
import { setActiveAccountId, getActiveAccountId, getAccountCollection, getAccountDoc, db } from '@/lib/firebase';

describe('Multi-Account & Data Isolation Architecture', () => {
  beforeEach(() => {
    setActiveAccountId('default');
    localStorage.clear();
  });

  it('defaults to root collections when accountId is default or omitted', () => {
    expect(getActiveAccountId()).toBe('default');
    const col = getAccountCollection(db, 'customers');
    expect(col.path).toBe('customers');
    const invoiceDoc = getAccountDoc(db, 'invoices', 'inv_123');
    expect(invoiceDoc.path).toBe('invoices/inv_123');
  });

  it('scopes collections to accounts/{accountId}/... when active account is set', () => {
    setActiveAccountId('acc_company_alpha');
    expect(getActiveAccountId()).toBe('acc_company_alpha');

    const customersCol = getAccountCollection(db, 'customers');
    expect(customersCol.path).toBe('accounts/acc_company_alpha/customers');

    const invoicesCol = getAccountCollection(db, 'invoices');
    expect(invoicesCol.path).toBe('accounts/acc_company_alpha/invoices');

    const paymentsCol = getAccountCollection(db, 'payments');
    expect(paymentsCol.path).toBe('accounts/acc_company_alpha/payments');

    const activityCol = getAccountCollection(db, 'activity_logs');
    expect(activityCol.path).toBe('accounts/acc_company_alpha/activity_logs');
  });

  it('strictly isolates data between two different accounts', () => {
    const account1 = 'acc_tenant_1';
    const account2 = 'acc_tenant_2';

    const col1 = getAccountCollection(db, 'invoices', account1);
    const col2 = getAccountCollection(db, 'invoices', account2);

    expect(col1.path).toBe('accounts/acc_tenant_1/invoices');
    expect(col2.path).toBe('accounts/acc_tenant_2/invoices');
    expect(col1.path).not.toBe(col2.path);

    const doc1 = getAccountDoc(db, 'customers', 'cust_common_id', account1);
    const doc2 = getAccountDoc(db, 'customers', 'cust_common_id', account2);

    expect(doc1.path).toBe('accounts/acc_tenant_1/customers/cust_common_id');
    expect(doc2.path).toBe('accounts/acc_tenant_2/customers/cust_common_id');
    expect(doc1.path).not.toBe(doc2.path);
  });

  it('handles switching accounts dynamically and updates paths', () => {
    setActiveAccountId('acc_store_1');
    expect(getAccountCollection(db, 'customers').path).toBe('accounts/acc_store_1/customers');

    setActiveAccountId('acc_store_2');
    expect(getAccountCollection(db, 'customers').path).toBe('accounts/acc_store_2/customers');

    setActiveAccountId(null);
    expect(getAccountCollection(db, 'customers').path).toBe('customers');
  });
});
