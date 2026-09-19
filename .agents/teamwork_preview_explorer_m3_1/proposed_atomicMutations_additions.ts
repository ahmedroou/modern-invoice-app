/**
 * Proposed Additions for src/lib/atomicMutations.ts
 * 
 * Provides atomic mutations for Customer updates, archiving, and deletion
 * with ActivityLog auditing and financial referential integrity checks.
 * Uses writeBatch() exclusively for 100% offline IndexedDB execution.
 */

import { writeBatch, Firestore, doc, collection, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer, ActivityLog } from '@/types/domain';

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

  const customerRef = doc(firestore, 'customers', customerId);
  const activityLogRef = doc(collection(firestore, 'activity_logs'));
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
  batch.set(activityLogRef, activityLog);

  await batch.commit();

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

  const customerRef = doc(firestore, 'customers', customerId);
  const activityLogRef = doc(collection(firestore, 'activity_logs'));
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
  batch.set(activityLogRef, activityLog);

  await batch.commit();

  return { customerId };
}

export interface DeleteCustomerAtomicParams {
  customerId: string;
  customerName?: string;
  totalInvoiced: number;
  outstandingAmount: number;
}

/**
 * Deletes a customer document ONLY if they have zero invoiced amount and zero outstanding balance.
 * Throws an Error if financial records or outstanding balances exist, protecting referential integrity.
 */
export async function deleteCustomerAtomic(
  params: DeleteCustomerAtomicParams,
  firestore: Firestore = db
): Promise<{ customerId: string }> {
  const { customerId, customerName, totalInvoiced, outstandingAmount } = params;

  if (totalInvoiced > 0 || outstandingAmount > 0) {
    throw new Error(
      `Cannot delete customer with existing financial history (Total Invoiced: ${totalInvoiced}, Outstanding: ${outstandingAmount}). Please archive the customer instead.`
    );
  }

  const batch = writeBatch(firestore);
  const customerRef = doc(firestore, 'customers', customerId);
  const activityLogRef = doc(collection(firestore, 'activity_logs'));
  const now = new Date().toISOString();

  batch.delete(customerRef);

  const activityLog: ActivityLog = {
    id: activityLogRef.id,
    timestamp: now,
    eventType: 'CUSTOMER_UPDATED', // Conforms to domain.ts ActivityLog eventType union
    entityType: 'CUSTOMER',
    entityId: customerId,
    description: `Customer ${customerName || customerId} was permanently deleted`,
    metadata: {
      customerId,
      action: 'DELETED'
    }
  };
  batch.set(activityLogRef, activityLog);

  await batch.commit();

  return { customerId };
}
