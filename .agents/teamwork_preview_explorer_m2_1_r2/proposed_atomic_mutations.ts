/**
 * Atomic Multi-Document Mutations for Offline-First Firestore
 * 
 * Blueprint for atomic financial operations using writeBatch().
 * Strictly avoids runTransaction() because transactions fail when offline.
 */

import { writeBatch, increment, Firestore, doc, collection } from 'firebase/firestore';
import { db } from './proposed_firebase';
import type { Customer, Invoice, Payment, ActivityLog, InvoiceStatus } from '../../src/types/domain';

export interface CreateInvoiceAtomicParams {
  invoice: Omit<Invoice, 'createdAt' | 'updatedAt' | 'amountPaid' | 'amountDue' | 'status'> & {
    id?: string;
    status?: InvoiceStatus;
    amountPaid?: number;
  };
  customLogMessage?: string;
}

export interface CreateInvoiceAtomicResult {
  invoiceId: string;
  activityLogId: string;
  invoice: Invoice;
}

/**
 * Creates an Invoice document, updates Customer outstandingAmount & totalInvoiced,
 * and records an ActivityLog entry atomically within a single writeBatch().
 * 
 * Guarantees offline local persistence in IndexedDB with 0ms latency.
 */
export async function createInvoiceAtomic(
  params: CreateInvoiceAtomicParams,
  firestore: Firestore = db
): Promise<CreateInvoiceAtomicResult> {
  const { invoice: inputInvoice, customLogMessage } = params;
  const batch = writeBatch(firestore);

  // Generate IDs if not provided
  const invoiceRef = inputInvoice.id 
    ? doc(firestore, 'invoices', inputInvoice.id)
    : doc(collection(firestore, 'invoices'));
  const invoiceId = invoiceRef.id;

  const activityLogRef = doc(collection(firestore, 'activity_logs'));
  const activityLogId = activityLogRef.id;

  const now = new Date().toISOString();
  const grandTotal = Number(inputInvoice.grandTotal) || 0;
  const initialAmountPaid = Number(inputInvoice.amountPaid) || 0;
  const initialAmountDue = Math.max(0, grandTotal - initialAmountPaid);
  const initialStatus: InvoiceStatus = inputInvoice.status || (initialAmountDue === 0 ? 'PAID' : 'UNPAID');

  const fullInvoice: Invoice = {
    ...inputInvoice,
    id: invoiceId,
    amountPaid: initialAmountPaid,
    amountDue: initialAmountDue,
    status: initialStatus,
    createdAt: now,
    updatedAt: now
  };

  // Operation 1: Save Invoice Document
  batch.set(invoiceRef, fullInvoice);

  // Operation 2: Atomically increment Customer outstanding balance & total invoiced
  const customerRef = doc(firestore, 'customers', inputInvoice.customerId);
  batch.update(customerRef, {
    outstandingAmount: increment(initialAmountDue),
    totalInvoiced: increment(grandTotal),
    updatedAt: now
  });

  // Operation 3: Record Activity Log Entry
  const activityLog: ActivityLog = {
    id: activityLogId,
    timestamp: now,
    eventType: 'INVOICE_CREATED',
    entityType: 'INVOICE',
    entityId: invoiceId,
    description: customLogMessage || `Invoice #${fullInvoice.invoiceNumber} created for ${fullInvoice.customerName} (${fullInvoice.currency} ${fullInvoice.grandTotal.toFixed(2)})`,
    metadata: {
      invoiceNumber: fullInvoice.invoiceNumber,
      customerId: fullInvoice.customerId,
      customerName: fullInvoice.customerName,
      grandTotal: fullInvoice.grandTotal,
      currency: fullInvoice.currency,
      status: fullInvoice.status
    }
  };
  batch.set(activityLogRef, activityLog);

  // Commit atomically to local IndexedDB (resolves immediately in offline mode)
  await batch.commit();

  return {
    invoiceId,
    activityLogId,
    invoice: fullInvoice
  };
}

export interface RecordPaymentAtomicParams {
  payment: Omit<Payment, 'createdAt'> & { id?: string };
  currentInvoice: {
    id: string;
    invoiceNumber: string;
    grandTotal: number;
    amountPaid: number;
    amountDue: number;
    status: InvoiceStatus;
    customerId: string;
    customerName: string;
  };
  customLogMessage?: string;
}

export interface RecordPaymentAtomicResult {
  paymentId: string;
  activityLogId: string;
  newInvoiceStatus: InvoiceStatus;
  newAmountDue: number;
  newAmountPaid: number;
}

/**
 * Records a Payment document, updates Invoice amountPaid, amountDue & status,
 * decrements Customer outstandingAmount, increments Customer totalPaid,
 * and records an ActivityLog entry atomically within a single writeBatch().
 * 
 * Works 100% offline without network roundtrip.
 */
export async function recordPaymentAtomic(
  params: RecordPaymentAtomicParams,
  firestore: Firestore = db
): Promise<RecordPaymentAtomicResult> {
  const { payment: inputPayment, currentInvoice, customLogMessage } = params;
  const batch = writeBatch(firestore);

  const paymentRef = inputPayment.id
    ? doc(firestore, 'payments', inputPayment.id)
    : doc(collection(firestore, 'payments'));
  const paymentId = paymentRef.id;

  const activityLogRef = doc(collection(firestore, 'activity_logs'));
  const activityLogId = activityLogRef.id;

  const now = new Date().toISOString();
  const paymentAmount = Number(inputPayment.amount);

  if (paymentAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  // Calculate new balances and status
  const currentPaid = Number(currentInvoice.amountPaid) || 0;
  const newAmountPaid = Number((currentPaid + paymentAmount).toFixed(2));
  const newAmountDue = Math.max(0, Number((currentInvoice.grandTotal - newAmountPaid).toFixed(2)));
  const newInvoiceStatus: InvoiceStatus = newAmountDue <= 0.0001 ? 'PAID' : 'PARTIALLY_PAID';

  const fullPayment: Payment = {
    ...inputPayment,
    id: paymentId,
    amount: paymentAmount,
    createdAt: now
  };

  // Operation 1: Save Payment Document
  batch.set(paymentRef, fullPayment);

  // Operation 2: Update Invoice Document
  const invoiceRef = doc(firestore, 'invoices', currentInvoice.id);
  batch.update(invoiceRef, {
    amountPaid: increment(paymentAmount),
    amountDue: increment(-paymentAmount),
    status: newInvoiceStatus,
    updatedAt: now
  });

  // Operation 3: Update Customer Document (decrement outstanding balance, increment total paid)
  const customerRef = doc(firestore, 'customers', currentInvoice.customerId);
  batch.update(customerRef, {
    outstandingAmount: increment(-paymentAmount),
    totalPaid: increment(paymentAmount),
    updatedAt: now
  });

  // Operation 4: Record Activity Log Entry
  const activityLog: ActivityLog = {
    id: activityLogId,
    timestamp: now,
    eventType: 'PAYMENT_RECORDED',
    entityType: 'PAYMENT',
    entityId: paymentId,
    description: customLogMessage || `Recorded payment of ${paymentAmount.toFixed(2)} for Invoice #${currentInvoice.invoiceNumber} (${currentInvoice.customerName})`,
    metadata: {
      paymentNumber: fullPayment.paymentNumber,
      invoiceId: currentInvoice.id,
      invoiceNumber: currentInvoice.invoiceNumber,
      customerId: currentInvoice.customerId,
      amount: paymentAmount,
      paymentMethod: fullPayment.paymentMethod,
      newInvoiceStatus
    }
  };
  batch.set(activityLogRef, activityLog);

  // Commit atomically
  await batch.commit();

  return {
    paymentId,
    activityLogId,
    newInvoiceStatus,
    newAmountDue,
    newAmountPaid
  };
}

export interface CreateCustomerAtomicParams {
  customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'outstandingAmount' | 'totalInvoiced' | 'totalPaid'> & {
    id?: string;
  };
}

/**
 * Creates a Customer document with zero initial balances and logs an ActivityLog entry.
 */
export async function createCustomerAtomic(
  params: CreateCustomerAtomicParams,
  firestore: Firestore = db
): Promise<{ customerId: string; customer: Customer }> {
  const { customer: inputCustomer } = params;
  const batch = writeBatch(firestore);

  const customerRef = inputCustomer.id
    ? doc(firestore, 'customers', inputCustomer.id)
    : doc(collection(firestore, 'customers'));
  const customerId = customerRef.id;

  const activityLogRef = doc(collection(firestore, 'activity_logs'));
  const now = new Date().toISOString();

  const fullCustomer: Customer = {
    ...inputCustomer,
    id: customerId,
    outstandingAmount: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    status: inputCustomer.status || 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };

  // Operation 1: Save Customer Document
  batch.set(customerRef, fullCustomer);

  // Operation 2: Activity Log Entry
  const activityLog: ActivityLog = {
    id: activityLogRef.id,
    timestamp: now,
    eventType: 'CUSTOMER_CREATED',
    entityType: 'CUSTOMER',
    entityId: customerId,
    description: `Customer ${fullCustomer.name} was registered`,
    metadata: {
      customerId,
      customerName: fullCustomer.name,
      currency: fullCustomer.currency
    }
  };
  batch.set(activityLogRef, activityLog);

  await batch.commit();

  return { customerId, customer: fullCustomer };
}
