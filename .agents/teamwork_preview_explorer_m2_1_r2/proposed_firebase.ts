/// <reference types="vite/client" />

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

import type { Customer, Invoice, Payment, ActivityLog } from '../../src/types/domain';

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
if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'test')) {
  (window as unknown as { __TEST_SIMULATE_OFFLINE__?: () => Promise<void> }).__TEST_SIMULATE_OFFLINE__ = () => simulateOffline();
  (window as unknown as { __TEST_SIMULATE_ONLINE__?: () => Promise<void> }).__TEST_SIMULATE_ONLINE__ = () => simulateOnline();
}

// Strongly typed collection references
export const collections = {
  customers: collection(db, 'customers') as CollectionReference<Customer>,
  invoices: collection(db, 'invoices') as CollectionReference<Invoice>,
  payments: collection(db, 'payments') as CollectionReference<Payment>,
  activityLogs: collection(db, 'activity_logs') as CollectionReference<ActivityLog>
};

// Document reference helpers
export const docRefs = {
  customer: (id: string) => doc(db, 'customers', id) as DocumentReference<Customer>,
  invoice: (id: string) => doc(db, 'invoices', id) as DocumentReference<Invoice>,
  payment: (id: string) => doc(db, 'payments', id) as DocumentReference<Payment>,
  activityLog: (id: string) => doc(db, 'activity_logs', id) as DocumentReference<ActivityLog>
};

// Re-export core Firestore symbols needed across hooks and services
export {
  writeBatch,
  increment,
  disableNetwork,
  enableNetwork,
  connectFirestoreEmulator
};
