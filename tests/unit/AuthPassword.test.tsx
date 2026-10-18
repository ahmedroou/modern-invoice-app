import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';

describe('Protected local account sign-in', () => {
  beforeEach(() => localStorage.clear());

  it('rejects an omitted or blank password for a protected account', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => { await result.current.signUp({ name: 'Test business', email: 'secure-test', password: 'correct-password' }); });
    act(() => result.current.signOut());
    await act(async () => {
      await expect(result.current.signIn({ email: 'secure-test' })).rejects.toThrow(/Incorrect password/);
    });
    expect(result.current.currentAccount).toBeNull();
    await act(async () => {
      await expect(result.current.signIn({ email: 'secure-test', password: '' })).rejects.toThrow(/Incorrect password/);
    });
    expect(result.current.currentAccount).toBeNull();
    await act(async () => { await result.current.signIn({ email: 'secure-test', password: 'correct-password' }); });
    expect(result.current.currentAccount?.email).toBe('secure-test');
  });

  it('keeps password-free accounts usable', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => { await result.current.signUp({ name: 'Local workspace', email: 'local-test' }); });
    act(() => result.current.signOut());
    await act(async () => { await result.current.signIn({ email: 'local-test' }); });
    expect(result.current.currentAccount?.name).toBe('Local workspace');
  });
});
