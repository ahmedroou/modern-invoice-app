export const ACCOUNT_CACHE_CHANGE_EVENT = 'meezan:account-cache-changed';

export function readAccountCache<T>(key: string): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function writeAccountCache<T>(key: string, items: T[]): void {
  const value = JSON.stringify(items);
  if (localStorage.getItem(key) === value) return;
  localStorage.setItem(key, value);
  queueMicrotask(() => window.dispatchEvent(new CustomEvent(ACCOUNT_CACHE_CHANGE_EVENT, { detail: { key } })));
}

export function subscribeAccountCache(key: string, listener: () => void): () => void {
  const onChange = (event: Event) => {
    if ((event as CustomEvent<{ key: string }>).detail?.key === key) listener();
  };
  const onStorage = (event: StorageEvent) => { if (event.key === key) listener(); };
  window.addEventListener(ACCOUNT_CACHE_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ACCOUNT_CACHE_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
