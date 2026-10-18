import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';

const harness = vi.hoisted(() => ({ accountId: 'company-a', subscriptions: [] as { path: string; next: (snapshot: any) => void; stop: ReturnType<typeof vi.fn> }[] }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ currentAccount: { id: harness.accountId } }) }));
vi.mock('firebase/firestore', async importOriginal => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return { ...actual, onSnapshot: (ref: { path: string }, _options: unknown, next: (snapshot: any) => void) => {
    const stop = vi.fn();
    harness.subscriptions.push({ path: ref.path, next, stop });
    return stop;
  } };
});

describe('Dashboard account switching', () => {
  it('clears the previous balance and subscribes to the selected account', () => {
    const { result, rerender } = renderHook(() => useDashboardMetrics());
    expect(harness.subscriptions[0].path).toBe('accounts/company-a/invoices');
    act(() => harness.subscriptions[0].next({ metadata: { hasPendingWrites: false }, docs: [{ id: 'invoice-a', data: () => ({ status: 'UNPAID', grandTotal: 500, amountDue: 500, amountPaid: 0 }) }] }));
    expect(result.current.outstandingReceivables).toBe(500);
    harness.accountId = 'company-b';
    rerender();
    expect(harness.subscriptions[0].stop).toHaveBeenCalledOnce();
    expect(harness.subscriptions[1].path).toBe('accounts/company-b/invoices');
    expect(result.current.outstandingReceivables).toBe(0);
    expect(result.current.recentInvoices).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});
