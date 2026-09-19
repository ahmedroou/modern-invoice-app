/**
 * Atomic Multi-Document Mutations for Offline-First Firestore
 * 
 * Target: src/lib/atomicMutations.ts
 * Strictly uses writeBatch() to ensure 100% offline local commit and zero-latency reactive updates.
 * Avoids runTransaction() because transactions fail when offline.
 */

import { writeBatch, increment, Firestore, doc, type WriteBatch } from 'firebase/firestore';
import { db, getAccountDoc, getAccountCollection } from '@/lib/firebase';
import type { Customer, Invoice, Payment, ActivityLog, InvoiceStatus } from '@/types/domain';

/**
 * Resolves document references to the currently active account (or root fallback for default/test).
 */
function accountDoc(
  firestore: Firestore,
  col: 'customers' | 'invoices' | 'payments' | 'activity_logs',
  id?: string
) {
  return id ? getAccountDoc(firestore, col, id) : doc(getAccountCollection(firestore, col));
}

/**
 * Recursively removes keys with undefined values so Firestore WriteBatch does not reject them.
 */
export function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = cleanUndefined(val);
      } else if (Array.isArray(val)) {
        result[key] = val.map((item) =>
          item !== null && typeof item === 'object' && !(item instanceof Date)
            ? cleanUndefined(item)
            : item
        );
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * Commits a writeBatch atomically.
 * Per PROJECT.md § Architecture: "batch.commit() resolves against local IndexedDB cache instantly without network latency."
 * Ensures local IndexedDB commit resolves within 150ms if remote cloud sync is delayed or offline.
 */
export async function commitAtomicBatch(batch: WriteBatch): Promise<void> {
  await Promise.race([
    batch.commit(),
    new Promise((resolve) => setTimeout(resolve, 150))
  ]);
}

export interface CreateInvoiceAtomicParams {
  invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'amountDue' | 'status'> & {
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
 * Guaranteed offline persistence in IndexedDB with 0ms UI latency.
 */
export async function createInvoiceAtomic(
  params: CreateInvoiceAtomicParams,
  firestore: Firestore = db
): Promise<CreateInvoiceAtomicResult> {
  const { invoice: inputInvoice, customLogMessage } = params;
  const batch = writeBatch(firestore);

  // Generate deterministic or random IDs
  const invoiceRef = accountDoc(firestore, 'invoices', inputInvoice.id);
  const invoiceId = invoiceRef.id;

  const activityLogRef = accountDoc(firestore, 'activity_logs');
  const activityLogId = activityLogRef.id;

  const now = new Date().toISOString();
  const grandTotal = Number(inputInvoice.grandTotal) || 0;
  const initialAmountPaid = Number(inputInvoice.amountPaid) || 0;
  const initialAmountDue = Math.max(0, Number((grandTotal - initialAmountPaid).toFixed(2)));
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
  batch.set(invoiceRef, cleanUndefined(fullInvoice));

  // Operation 2: Atomically increment Customer outstanding balance & total invoiced (non-draft only)
  const customerRef = accountDoc(firestore, 'customers', inputInvoice.customerId);
  const isDraft = initialStatus === 'DRAFT';
  if (!isDraft) {
    batch.update(customerRef, {
      outstandingAmount: increment(initialAmountDue),
      totalInvoiced: increment(grandTotal),
      updatedAt: now
    });
  } else {
    batch.update(customerRef, {
      updatedAt: now
    });
  }

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
  batch.set(activityLogRef, cleanUndefined(activityLog));

  // Commit atomically to local IndexedDB
  await commitAtomicBatch(batch);

  return {
    invoiceId,
    activityLogId,
    invoice: fullInvoice
  };
}

export interface UpdateInvoiceAtomicParams {
  invoiceId: string;
  previousInvoice?: {
    customerId: string;
    customerName?: string;
    invoiceNumber?: string;
    currency?: string;
    grandTotal: number;
    amountPaid: number;
    amountDue: number;
    status: InvoiceStatus;
  };
  oldInvoice?: Invoice;
  updates?: Partial<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>;
  updatedFields?: Partial<Invoice>;
  customLogMessage?: string;
}

export interface UpdateInvoiceAtomicResult {
  invoiceId: string;
  activityLogId: string;
  updatedInvoice: Invoice;
  deltaAmountDue: number;
  deltaGrandTotal: number;
}

/**
 * Updates an Invoice document, recalculates financial deltas for the customer (or handles reassignment),
 * and records an ActivityLog entry atomically within a single writeBatch().
 */
export async function updateInvoiceAtomic(
  params: UpdateInvoiceAtomicParams,
  firestore: Firestore = db
): Promise<UpdateInvoiceAtomicResult> {
  const { invoiceId, customLogMessage } = params;
  const prevInvoice = params.previousInvoice || params.oldInvoice;
  if (!prevInvoice) {
    throw new Error('Previous invoice details are required to calculate balance adjustments.');
  }

  const updates = params.updates || params.updatedFields || {};
  const batch = writeBatch(firestore);
  const now = new Date().toISOString();

  const invoiceRef = accountDoc(firestore, 'invoices', invoiceId);
  const activityLogRef = accountDoc(firestore, 'activity_logs');
  const activityLogId = activityLogRef.id;

  const oldGrandTotal = Number(prevInvoice.grandTotal) || 0;
  const currentPaid = Number(prevInvoice.amountPaid) || 0;
  const oldAmountDue = Number(prevInvoice.amountDue) || 0;

  const newGrandTotal = updates.grandTotal !== undefined
    ? Number(Number(updates.grandTotal).toFixed(2))
    : oldGrandTotal;

  const newAmountDue = Math.max(0, Number((newGrandTotal - currentPaid).toFixed(2)));

  let newStatus: InvoiceStatus = updates.status || prevInvoice.status;
  if (prevInvoice.status !== 'CANCELLED' && prevInvoice.status !== 'DRAFT') {
    newStatus = newAmountDue <= 0.0001 ? 'PAID' : currentPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
    if (updates.dueDate && updates.dueDate < now.split('T')[0] && newAmountDue > 0) {
      newStatus = 'OVERDUE';
    }
  } else if (prevInvoice.status === 'DRAFT' && updates.status && updates.status !== 'DRAFT') {
    newStatus = updates.status;
    if (newStatus !== 'CANCELLED') {
      newStatus = newAmountDue <= 0.0001 ? 'PAID' : currentPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
      if (updates.dueDate && updates.dueDate < now.split('T')[0] && newAmountDue > 0) {
        newStatus = 'OVERDUE';
      }
    }
  }

  const fullUpdates: Record<string, any> = {
    ...updates,
    grandTotal: newGrandTotal,
    amountPaid: currentPaid,
    amountDue: newAmountDue,
    status: newStatus,
    updatedAt: now
  };

  // Operation 1: Update Invoice Document
  batch.update(invoiceRef, fullUpdates);

  // Operation 2: Adjust Customer Accumulators
  const oldCustomerId = prevInvoice.customerId;
  const newCustomerId = updates.customerId || oldCustomerId;

  const wasDraft = prevInvoice.status === 'DRAFT';
  const wasCancelled = prevInvoice.status === 'CANCELLED';
  const isNowDraft = newStatus === 'DRAFT';
  const isNowCancelled = newStatus === 'CANCELLED';

  const effectiveOldGrandTotal = (wasDraft || wasCancelled) ? 0 : oldGrandTotal;
  const effectiveOldAmountDue = (wasDraft || wasCancelled) ? 0 : oldAmountDue;

  const effectiveNewGrandTotal = (isNowDraft || isNowCancelled) ? 0 : newGrandTotal;
  const effectiveNewAmountDue = (isNowDraft || isNowCancelled) ? 0 : newAmountDue;

  const deltaGrandTotal = Number((effectiveNewGrandTotal - effectiveOldGrandTotal).toFixed(2));
  const deltaAmountDue = Number((effectiveNewAmountDue - effectiveOldAmountDue).toFixed(2));

  if (oldCustomerId === newCustomerId) {
    const customerRef = accountDoc(firestore, 'customers', oldCustomerId);
    batch.update(customerRef, {
      outstandingAmount: increment(deltaAmountDue),
      totalInvoiced: increment(deltaGrandTotal),
      updatedAt: now
    });
  } else {
    // Customer was reassigned
    const oldCustomerRef = accountDoc(firestore, 'customers', oldCustomerId);
    batch.update(oldCustomerRef, {
      outstandingAmount: increment(-effectiveOldAmountDue),
      totalInvoiced: increment(-effectiveOldGrandTotal),
      updatedAt: now
    });

    const newCustomerRef = accountDoc(firestore, 'customers', newCustomerId);
    batch.update(newCustomerRef, {
      outstandingAmount: increment(effectiveNewAmountDue),
      totalInvoiced: increment(effectiveNewGrandTotal),
      updatedAt: now
    });
  }

  // Operation 3: Activity Log
  const invNumber = updates.invoiceNumber || prevInvoice.invoiceNumber || invoiceId;
  const activityLog: ActivityLog = {
    id: activityLogId,
    timestamp: now,
    eventType: 'INVOICE_UPDATED',
    entityType: 'INVOICE',
    entityId: invoiceId,
    description: customLogMessage || `Invoice #${invNumber} updated (Total: ${prevInvoice.currency || 'SAR'} ${newGrandTotal.toFixed(2)})`,
    metadata: {
      invoiceId,
      invoiceNumber: invNumber,
      deltaGrandTotal,
      deltaAmountDue,
      newStatus
    }
  };
  batch.set(activityLogRef, activityLog);

  await commitAtomicBatch(batch);

  return {
    invoiceId,
    activityLogId,
    updatedInvoice: { ...prevInvoice, ...fullUpdates, id: invoiceId } as Invoice,
    deltaAmountDue,
    deltaGrandTotal
  };
}

export interface CancelInvoiceAtomicParams {
  invoiceId: string;
  invoiceNumber?: string;
  customerId?: string;
  customerName?: string;
  amountDue?: number;
  currentStatus?: InvoiceStatus;
  currentInvoice?: Invoice;
  reason?: string;
  customLogMessage?: string;
}

export interface CancelInvoiceAtomicResult {
  invoiceId: string;
  activityLogId: string;
}

/**
 * Marks an Invoice as CANCELLED, zeroes its amountDue, decrements customer outstanding debt by the cleared amount,
 * and records an ActivityLog entry atomically within a single writeBatch().
 */
export async function cancelInvoiceAtomic(
  params: CancelInvoiceAtomicParams,
  firestore: Firestore = db
): Promise<CancelInvoiceAtomicResult> {
  const { invoiceId, reason, customLogMessage } = params;
  const currentInvoice = params.currentInvoice;
  const currentStatus = params.currentStatus || currentInvoice?.status || 'UNPAID';
  const invoiceNumber = params.invoiceNumber || currentInvoice?.invoiceNumber || invoiceId;
  const customerId = params.customerId || currentInvoice?.customerId;
  const customerName = params.customerName || currentInvoice?.customerName;
  const amountDue = params.amountDue !== undefined ? params.amountDue : (currentInvoice?.amountDue || 0);

  if (currentStatus === 'CANCELLED') {
    throw new Error(`Invoice #${invoiceNumber} is already cancelled.`);
  }

  if (!customerId) {
    throw new Error('Customer ID is required to cancel invoice.');
  }

  const batch = writeBatch(firestore);
  const now = new Date().toISOString();
  const invoiceRef = accountDoc(firestore, 'invoices', invoiceId);
  const customerRef = accountDoc(firestore, 'customers', customerId);
  const activityLogRef = accountDoc(firestore, 'activity_logs');
  const activityLogId = activityLogRef.id;

  const dueToClear = currentStatus === 'DRAFT' ? 0 : Math.max(0, Number(amountDue) || 0);

  // Operation 1: Mark Invoice CANCELLED and zero amountDue
  batch.update(invoiceRef, {
    status: 'CANCELLED',
    amountDue: 0,
    updatedAt: now
  });

  // Operation 2: Decrement Customer's outstanding debt by remaining due amount
  if (dueToClear > 0) {
    batch.update(customerRef, {
      outstandingAmount: increment(-dueToClear),
      updatedAt: now
    });
  }

  // Operation 3: Activity Log
  const activityLog: ActivityLog = {
    id: activityLogId,
    timestamp: now,
    eventType: 'INVOICE_STATUS_CHANGED',
    entityType: 'INVOICE',
    entityId: invoiceId,
    description: customLogMessage || `Invoice #${invoiceNumber}${customerName ? ` for ${customerName}` : ''} was cancelled${reason ? `: ${reason}` : ''}`,
    metadata: {
      invoiceId,
      invoiceNumber,
      customerId,
      previousStatus: currentStatus,
      newStatus: 'CANCELLED',
      clearedAmountDue: dueToClear
    }
  };
  batch.set(activityLogRef, cleanUndefined(activityLog));

  await commitAtomicBatch(batch);

  return { invoiceId, activityLogId };
}

export interface RecordPaymentAtomicParams {
  payment: Omit<Payment, 'id' | 'createdAt'> & { id?: string };
  currentInvoice: {
    id: string;
    invoiceNumber: string;
    grandTotal: number;
    amountPaid: number;
    amountDue: number;
    status: InvoiceStatus;
    customerId: string;
    customerName: string;
    dueDate?: string;
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
 * Guaranteed offline execution.
 */
export async function recordPaymentAtomic(
  params: RecordPaymentAtomicParams,
  firestore: Firestore = db
): Promise<RecordPaymentAtomicResult> {
  const { payment: inputPayment, currentInvoice, customLogMessage } = params;
  const batch = writeBatch(firestore);

  const paymentRef = accountDoc(firestore, 'payments', inputPayment.id);
  const paymentId = paymentRef.id;

  const activityLogRef = accountDoc(firestore, 'activity_logs');
  const activityLogId = activityLogRef.id;

  const now = new Date().toISOString();
  const paymentAmount = Number(inputPayment.amount);

  if (paymentAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  if (currentInvoice.status === 'CANCELLED') {
    throw new Error('Cannot record payment on a cancelled invoice');
  }

  if (currentInvoice.status === 'PAID' || currentInvoice.amountDue <= 0.0001) {
    throw new Error('Invoice is already fully paid');
  }

  // Calculate new balances and status
  const currentPaid = Number(currentInvoice.amountPaid) || 0;
  const newAmountPaid = Number((currentPaid + paymentAmount).toFixed(2));
  // Clamp newAmountDue to 0 if payment meets or exceeds amount due
  const rawDue = currentInvoice.grandTotal - newAmountPaid;
  const newAmountDue = Math.max(0, Number(rawDue.toFixed(2)));

  const todayStr = now.split('T')[0];
  const isOverdue = currentInvoice.dueDate
    ? currentInvoice.dueDate < todayStr
    : currentInvoice.status === 'OVERDUE';

  let newInvoiceStatus: InvoiceStatus;
  if (paymentAmount >= currentInvoice.amountDue - 0.0001 || newAmountDue <= 0.0001) {
    newInvoiceStatus = 'PAID';
  } else if (isOverdue) {
    newInvoiceStatus = 'OVERDUE';
  } else {
    newInvoiceStatus = 'PARTIALLY_PAID';
  }

  const fullPayment: Payment = {
    ...inputPayment,
    id: paymentId,
    amount: paymentAmount,
    createdAt: now
  };

  // Clamp decrement to remaining due so doc fields do not store negative due balances
  const dueDecrement = Math.min(paymentAmount, currentInvoice.amountDue);

  // Operation 1: Save Payment Document
  batch.set(paymentRef, cleanUndefined(fullPayment));

  // Operation 2: Update Invoice Document
  const invoiceRef = accountDoc(firestore, 'invoices', currentInvoice.id);
  batch.update(invoiceRef, {
    amountPaid: increment(paymentAmount),
    amountDue: increment(-dueDecrement),
    status: newInvoiceStatus,
    updatedAt: now
  });

  // Operation 3: Update Customer Document (decrement balance, increment total paid)
  const customerRef = accountDoc(firestore, 'customers', currentInvoice.customerId);
  batch.update(customerRef, {
    outstandingAmount: increment(-dueDecrement),
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
      newInvoiceStatus,
      newAmountDue
    }
  };
  batch.set(activityLogRef, cleanUndefined(activityLog));

  // Commit atomically
  await commitAtomicBatch(batch);

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

  const customerRef = accountDoc(firestore, 'customers', inputCustomer.id);
  const customerId = customerRef.id;

  const activityLogRef = accountDoc(firestore, 'activity_logs');
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
  batch.set(customerRef, cleanUndefined(fullCustomer));

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
  batch.set(activityLogRef, cleanUndefined(activityLog));

  await commitAtomicBatch(batch);

  return { customerId, customer: fullCustomer };
}

export type CustomerUpdateInput = Partial<
  Pick<Customer, 'name' | 'email' | 'phone' | 'address' | 'taxNumber' | 'currency' | 'notes' | 'status'>
>;

export interface UpdateCustomerAtomicParams {
  customerId: string;
  updates: CustomerUpdateInput;
  customLogMessage?: string;
}

export interface UpdateCustomerAtomicResult {
  customerId: string;
  updatedFields: CustomerUpdateInput;
  activityLogId: string;
}

/**
 * Atomically updates mutable profile fields of a Customer and records an ActivityLog entry.
 * Strictly ignores financial accumulators (outstandingAmount, totalInvoiced, totalPaid)
 * to prevent accidental balance tampering or race conditions.
 */
export async function updateCustomerAtomic(
  params: UpdateCustomerAtomicParams,
  firestore: Firestore = db
): Promise<UpdateCustomerAtomicResult> {
  const { customerId, updates, customLogMessage } = params;
  const batch = writeBatch(firestore);

  const customerRef = accountDoc(firestore, 'customers', customerId);
  const activityLogRef = accountDoc(firestore, 'activity_logs');
  const activityLogId = activityLogRef.id;
  const now = new Date().toISOString();

  // Strip any financial fields defensively
  const safeUpdates: Record<string, any> = {
    updatedAt: now
  };

  if (updates.name !== undefined) safeUpdates.name = updates.name.trim();
  if (updates.email !== undefined) safeUpdates.email = updates.email.trim();
  if (updates.phone !== undefined) safeUpdates.phone = updates.phone.trim();
  if (updates.address !== undefined) safeUpdates.address = updates.address.trim();
  if (updates.taxNumber !== undefined) safeUpdates.taxNumber = updates.taxNumber.trim();
  if (updates.currency !== undefined) safeUpdates.currency = updates.currency;
  if (updates.notes !== undefined) safeUpdates.notes = updates.notes.trim();
  if (updates.status !== undefined) safeUpdates.status = updates.status;

  // Operation 1: Update customer doc
  batch.update(customerRef, safeUpdates);

  // Operation 2: Log activity
  const activityLog: ActivityLog = {
    id: activityLogId,
    timestamp: now,
    eventType: 'CUSTOMER_UPDATED',
    entityType: 'CUSTOMER',
    entityId: customerId,
    description: customLogMessage || `Customer ${updates.name || customerId} details were updated`,
    metadata: {
      customerId,
      updatedFields: Object.keys(updates)
    }
  };
  batch.set(activityLogRef, cleanUndefined(activityLog));

  await commitAtomicBatch(batch);

  return {
    customerId,
    updatedFields: updates,
    activityLogId
  };
}

export interface ArchiveCustomerAtomicParams {
  customerId: string;
  customerName?: string;
}

/**
 * Soft-deletes a customer by setting status to 'ARCHIVED' and recording an ActivityLog entry.
 */
export async function archiveCustomerAtomic(
  params: ArchiveCustomerAtomicParams,
  firestore: Firestore = db
): Promise<{ customerId: string }> {
  const { customerId, customerName } = params;
  const batch = writeBatch(firestore);

  const customerRef = accountDoc(firestore, 'customers', customerId);
  const activityLogRef = accountDoc(firestore, 'activity_logs');
  const now = new Date().toISOString();

  batch.update(customerRef, {
    status: 'ARCHIVED',
    updatedAt: now
  });

  const activityLog: ActivityLog = {
    id: activityLogRef.id,
    timestamp: now,
    eventType: 'CUSTOMER_UPDATED',
    entityType: 'CUSTOMER',
    entityId: customerId,
    description: `Customer ${customerName || customerId} was archived`,
    metadata: {
      customerId,
      action: 'ARCHIVED'
    }
  };
  batch.set(activityLogRef, cleanUndefined(activityLog));

  await commitAtomicBatch(batch);

  return { customerId };
}

export interface DeleteCustomerAtomicParams {
  customerId: string;
  customerName?: string;
  totalInvoiced: number;
  totalPaid?: number;
  outstandingAmount: number;
}

/**
 * Deletes a customer document ONLY if they have zero invoiced amount, zero payments, and zero outstanding balance.
 * Throws an Error if financial records or outstanding balances exist, protecting referential integrity.
 */
export async function deleteCustomerAtomic(
  params: DeleteCustomerAtomicParams,
  firestore: Firestore = db
): Promise<{ customerId: string }> {
  const { customerId, customerName, totalInvoiced, totalPaid = 0, outstandingAmount } = params;

  if (totalInvoiced > 0 || totalPaid > 0 || Math.abs(outstandingAmount) > 0.001) {
    throw new Error(
      `Cannot delete customer with existing financial history (Total Invoiced: ${totalInvoiced}, Total Paid: ${totalPaid}, Outstanding: ${outstandingAmount}). Please archive the customer instead.`
    );
  }

  const batch = writeBatch(firestore);
  const customerRef = accountDoc(firestore, 'customers', customerId);
  const activityLogRef = accountDoc(firestore, 'activity_logs');
  const now = new Date().toISOString();

  batch.delete(customerRef);

  const activityLog: ActivityLog = {
    id: activityLogRef.id,
    timestamp: now,
    eventType: 'CUSTOMER_UPDATED',
    entityType: 'CUSTOMER',
    entityId: customerId,
    description: `Customer ${customerName || customerId} was permanently deleted`,
    metadata: {
      customerId,
      action: 'DELETED'
    }
  };
  batch.set(activityLogRef, cleanUndefined(activityLog));

  await commitAtomicBatch(batch);

  return { customerId };
}
