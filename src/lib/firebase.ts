/// <reference types="vite/client" />

/**
 * Firebase Firestore Offline-First Configuration
 * 
 * Target: src/lib/firebase.ts
 * Uses Firebase Modular SDK v11 with persistentMultipleTabManager and CACHE_SIZE_UNLIMITED.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
  connectFirestoreEmulator,
  disableNetwork,
  enableNetwork,
  Firestore,
  collection,
  doc,
  writeBatch,
  increment,
  CollectionReference,
  DocumentReference
} from 'firebase/firestore';

import type { Customer, Invoice, Payment, ActivityLog } from '@/types/domain';

// Default configuration with sensible fallbacks for development and offline operation
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-modern-invoice-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'modern-invoice-desktop.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'modern-invoice-desktop',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'modern-invoice-desktop.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef1234567890'
};

// Singleton FirebaseApp initialization
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore with multi-tab persistent IndexedDB cache
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED
    })
  });
} catch {
  // If already initialized (e.g. during HMR or testing), retrieve existing instance
  firestoreInstance = getFirestore(app);
}

export const db: Firestore = firestoreInstance;

/**
 * Validates whether real production Firebase credentials are provided.
 * When false, Firestore runs in strictly isolated offline mode so invalid API keys
 * never hit Google servers and never cause optimistic writes to be rolled back.
 */
export const isRealFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-modern-invoice-key' &&
  !import.meta.env.VITE_FIREBASE_API_KEY.startsWith('demo-')
);

// Optional Local Firestore Emulator Configuration
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' || import.meta.env.VITE_USE_FIREBASE_EMULATOR === '1') {
  const host = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
  const port = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT) || 8080;
  try {
    connectFirestoreEmulator(db, host, port);
    console.info(`[Firebase] Connected Firestore to local emulator at ${host}:${port}`);
  } catch (err) {
    // connectFirestoreEmulator may throw if already connected in HMR
    console.warn('[Firebase] Emulator connection skipped or already initialized:', err);
  }
} else if (typeof window !== 'undefined' && !isRealFirebaseConfigured) {
  // If no real Firebase credentials are provided, disable network calls immediately
  // to ensure 100% reliable local persistence in IndexedDB without Google server rejection rollbacks.
  disableNetwork(db).catch((err) => {
    // Ignore if already disabled or in non-browser context
    console.info('[Firebase] Network disabled for local standalone mode:', err?.message || err);
  });
}

// Network Simulation Helpers for Testing & Offline Verification
export async function simulateOffline(firestore: Firestore = db): Promise<void> {
  await disableNetwork(firestore);
  console.info('[Firebase] Network disabled (offline simulation active).');
}

export async function simulateOnline(firestore: Firestore = db): Promise<void> {
  await enableNetwork(firestore);
  console.info('[Firebase] Network enabled (online cloud sync active).');
}

// Expose simulation helpers on window for Playwright E2E and automated testing
if (typeof window !== 'undefined') {
  (window as any).__TEST_SIMULATE_OFFLINE__ = () => simulateOffline();
  (window as any).__TEST_SIMULATE_ONLINE__ = () => simulateOnline();
  (window as any).__FIREBASE_DB__ = db;
}

// ─── Multi-Account Scoping & Tenant Isolation ───────────────────────────────

let activeAccountId: string = 'default';

/**
 * Sets the active account/tenant ID.
 * When set to an account ID (e.g. 'acc_123'), all queries and document writes
 * route to `accounts/{accountId}/{collection}`.
 * When 'default', routes to root collections (preserves backward compatibility & test isolation).
 */
export function setActiveAccountId(id: string | null | undefined): void {
  activeAccountId = id?.trim() || 'default';
}

export function getActiveAccountId(): string {
  return activeAccountId;
}

export type SupportedAccountCollection =
  | 'customers'
  | 'invoices'
  | 'payments'
  | 'activity_logs'
  | 'vendors'
  | 'expense_bills'
  | 'expense_payments';

export function getAccountCollection<T = any>(
  firestore: Firestore = db,
  name: SupportedAccountCollection,
  accountId?: string
): CollectionReference<T> {
  const accId = accountId || activeAccountId;
  if (!accId || accId === 'default') {
    return collection(firestore, name) as CollectionReference<T>;
  }
  return collection(firestore, 'accounts', accId, name) as CollectionReference<T>;
}

export function getAccountDoc<T = any>(
  firestore: Firestore = db,
  name: SupportedAccountCollection,
  id: string,
  accountId?: string
): DocumentReference<T> {
  const accId = accountId || activeAccountId;
  if (!accId || accId === 'default') {
    return doc(firestore, name, id) as DocumentReference<T>;
  }
  return doc(firestore, 'accounts', accId, name, id) as DocumentReference<T>;
}

// Strongly typed dynamic collection references (resolves to active account)
export const collections = {
  get customers(): CollectionReference<Customer> {
    return getAccountCollection<Customer>(db, 'customers');
  },
  get invoices(): CollectionReference<Invoice> {
    return getAccountCollection<Invoice>(db, 'invoices');
  },
  get payments(): CollectionReference<Payment> {
    return getAccountCollection<Payment>(db, 'payments');
  },
  get activityLogs(): CollectionReference<ActivityLog> {
    return getAccountCollection<ActivityLog>(db, 'activity_logs');
  },
  get vendors(): CollectionReference<any> {
    return getAccountCollection(db, 'vendors');
  },
  get expenseBills(): CollectionReference<any> {
    return getAccountCollection(db, 'expense_bills');
  },
  get expensePayments(): CollectionReference<any> {
    return getAccountCollection(db, 'expense_payments');
  }
};

// Document reference helpers (resolves to active account or specific account)
export const docRefs = {
  customer: (id: string, accountId?: string) => getAccountDoc<Customer>(db, 'customers', id, accountId),
  invoice: (id: string, accountId?: string) => getAccountDoc<Invoice>(db, 'invoices', id, accountId),
  payment: (id: string, accountId?: string) => getAccountDoc<Payment>(db, 'payments', id, accountId),
  activityLog: (id: string, accountId?: string) => getAccountDoc<ActivityLog>(db, 'activity_logs', id, accountId),
  vendor: (id: string, accountId?: string) => getAccountDoc(db, 'vendors', id, accountId),
  expenseBill: (id: string, accountId?: string) => getAccountDoc(db, 'expense_bills', id, accountId),
  expensePayment: (id: string, accountId?: string) => getAccountDoc(db, 'expense_payments', id, accountId)
};

// Re-export core Firestore symbols needed across hooks and services
export {
  writeBatch,
  increment,
  disableNetwork,
  enableNetwork,
  connectFirestoreEmulator
};
