# Milestone 4 Code Review & Adversarial Challenge Report

> **Reviewer & Adversarial Critic**: `teamwork_preview_reviewer_m4_1`  
> **Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_reviewer_m4_1`  
> **Target Scope**: Milestone 4 (Invoices, Payments, Statements)  
> **Verdict**: **APPROVE**  
> **Date**: 2026-09-19T12:45:30Z  

---

## 1. Observation

### 1.1 `src/components/modules/invoices/InvoiceForm.tsx`
1. **Ref Guards for Initialization**:
   In `src/components/modules/invoices/InvoiceForm.tsx` lines 87–104 and line 153:
   ```typescript
   const prevOpenRef = useRef(false);
   const prevInvoiceIdRef = useRef<string | undefined>(undefined);

   // Initialize or reset form on open
   useEffect(() => {
     if (!isOpen) {
       prevOpenRef.current = false;
       prevInvoiceIdRef.current = undefined;
       return;
     }

     const isJustOpened = !prevOpenRef.current;
     const isDifferentInvoice = invoice?.id !== prevInvoiceIdRef.current;
     if (!isJustOpened && !isDifferentInvoice) return;

     prevOpenRef.current = true;
     prevInvoiceIdRef.current = invoice?.id;
     ...
   }, [isOpen, invoice?.id, defaultInvoiceNumber, initialCustomerId, isEdit]);
   ```
   - Direct observation: `customers` was removed from the `useEffect` dependency array.
   - When the modal is open (`isOpen: true`), `isJustOpened` evaluates to `false` and `isDifferentInvoice` evaluates to `false` unless a different invoice ID is passed. Background updates to the customer collection or parent re-renders no longer re-trigger the effect or overwrite `items`.
   - When the modal is closed (`isOpen: false`), `prevOpenRef.current` resets to `false` and `prevInvoiceIdRef.current` resets to `undefined`.

2. **Real-Time Calculation & Zero Calculate Button (AC 3)**:
   - Line 709: `<div id="grand-total-display" className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">` displays `<BidiIsolate>{formatCurrency(totals.grandTotal, currency)}</BidiIsolate>`.
   - Lines 189–226: `calculatedItems` and `totals` are computed dynamically via `useMemo` hooks calling `calculateLineItem` and `calculateInvoiceTotals` from `@/lib/calculations`.
   - There are zero calculate or recalculate buttons rendered anywhere in the modal.
   - Lines 512–518 & 535–541: Keyboard event listeners call `handleGridCellKeyDown`, enabling Enter to add rows and arrow navigation.

### 1.2 `src/lib/atomicMutations.ts` & `src/services/atomicMutations.ts`
1. **Pure `writeBatch(firestore)` & Zero `runTransaction`**:
   - Grep search for `runTransaction` across the entire codebase returned zero code invocations (only line 6 of `atomicMutations.ts` documenting why transactions fail offline).
   - All mutations (`createInvoiceAtomic`, `updateInvoiceAtomic`, `cancelInvoiceAtomic`, `recordPaymentAtomic`, `createCustomerAtomic`, `updateCustomerAtomic`, `archiveCustomerAtomic`, `deleteCustomerAtomic`) instantiate `const batch = writeBatch(firestore)` and finish with `await batch.commit()`.

2. **DRAFT Invoice Balance Isolation & Lifecycle Transition**:
   - `createInvoiceAtomic` (lines 71–82):
     ```typescript
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
     ```
     Observed: When `status === 'DRAFT'`, customer financial accumulators are untouched.
   - `updateInvoiceAtomic` (lines 203–223):
     ```typescript
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
     ```
     Observed: Moving from DRAFT to UNPAID computes positive deltas equal to the new totals; updating within DRAFT yields deltas of 0.
   - `cancelInvoiceAtomic` (line 319):
     ```typescript
     const dueToClear = currentStatus === 'DRAFT' ? 0 : Math.max(0, Number(amountDue) || 0);
     ```
     Observed: Cancelling a DRAFT does not decrement customer balance.
   - Re-export shim: `src/services/atomicMutations.ts` exists and re-exports all members from `@/lib/atomicMutations`.

### 1.3 `src/App.tsx` Routes & Query Parameter Handling
1. **Routing in `src/App.tsx`**:
   - Lines 33–46:
     ```tsx
     <Route path="/" element={<AppLayout />}>
       <Route index element={<DashboardView />} />
       <Route path="invoices" element={<InvoiceList />} />
       <Route path="invoices/new" element={<InvoiceList />} />
       <Route path="invoices/:id" element={<InvoiceList />} />
       <Route path="customers" element={<CustomerList />} />
       <Route path="customers/:id" element={<CustomerList />} />
       <Route path="payments" element={<PaymentList />} />
       <Route path="statements" element={<StatementOfAccount />} />
       <Route path="statements/:customerId" element={<StatementOfAccount />} />
       <Route path="settings" element={<PlaceholderView titleKey="nav.settings" />} />
       <Route path="*" element={<Navigate to="/" replace />} />
     </Route>
     ```
2. **Deep-linking & Search Params**:
   - `InvoiceList.tsx` (lines 80–94): reads `searchParams.get('new') === '1'` and `pathname.endsWith('/new')` to pop the New Invoice modal; reads `routeParams.id || searchParams.get('id')` to view an invoice.
   - `PaymentList.tsx` (lines 72–95): reads `searchParams.get('new') === '1'`, `searchParams.get('invoiceId')`, and `searchParams.get('customerId')`.
   - `StatementGenerator.tsx` (lines 107–118): reads `routeParams.customerId || searchParams.get('customerId')`.

### 1.4 Verification Command Results
1. **Production Build (`npm run build`)**:
   - Command: `tsc && vite build`
   - Exit code: `0`
   - Output: `dist/index.html`, CSS bundle, JS bundle, and `dist-electron/main.js`, `dist-electron/preload.cjs` generated cleanly with zero TypeScript errors.
2. **Automated Vitest Suite (`npm test`)**:
   - Command: `vitest run`
   - Test files: **36 passed (36)**
   - Tests: **420 passed (420)**
   - Failures: **0**
   - Duration: 21.96s
3. **Headless Electron Smoke Test (`npm run test:smoke`)**:
   - Command: `node tests/smoke/electron-launch.smoke.mjs`
   - Exit code: `0`
   - Verified: 10 of 10 `window.electronAPI` methods active in headless Electron window.
4. **Empirical Sandbox IPC Test (`node tests/smoke/empirical-sandbox-ipc.smoke.mjs`)**:
   - Exit code: `0`
   - Verified: Sandboxing, context isolation, preload CJS integrity, IPC call concurrency.

---

## 2. Logic Chain

1. **Premise**: In an offline-first desktop application using React and Firestore with local IndexedDB persistence:
   - React state re-renders must be stable. Form inputs must never be wiped by asynchronous background subscription updates (such as `useCustomers` or Firestore snapshots).
   - Modals must distinguish between being freshly opened vs. staying open during background re-renders.
2. **Inference for `InvoiceForm.tsx`**:
   - By retaining references `prevOpenRef` and `prevInvoiceIdRef`, the initialization effect triggers if and only if `!prevOpenRef.current` (just opened) or `invoice?.id !== prevInvoiceIdRef.current` (switched target invoice).
   - Removing `customers` from the dependency array breaks the infinite reference loop caused by `useCustomers()` hook re-renders.
   - Direct test execution in `tests/integration/InvoiceForm.spec.tsx` and `tests/unit/invoices.test.tsx` confirms that `InvoiceForm` renders cleanly, computes totals reactively without any calculate button, and does not hang or loop.
3. **Inference for `atomicMutations.ts`**:
   - Firestore transactions (`runTransaction`) fail completely when a client is offline, because transactions require round-trip server communication.
   - Therefore, `writeBatch(firestore)` is the strictly correct and necessary mechanism for offline-first local commits.
   - For accounting invariants, DRAFT invoices are non-posted documents and must not debit customer accounts. By checking `isDraft` in `createInvoiceAtomic`, applying conditional deltas (`effectiveOld` vs `effectiveNew`) in `updateInvoiceAtomic`, and zeroing `dueToClear` in `cancelInvoiceAtomic`, draft invoices are isolated from accounts receivable while posting and cancellation preserve exact balance invariants.
4. **Inference for Integrity**:
   - No mock short-circuiting or hardcoded test outputs were detected in application code.
   - All tests execute actual source modules against realistic or simulated Firestore batches.

---

## 3. Caveats

- **No Caveats**: The Milestone 4 deliverables satisfy all specifications in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `TEST_INFRA.md`.
- **Note on Overpayments**: In `recordPaymentAtomic`, overpayments clamp `amountDue` to 0 and decrement customer `outstandingAmount` by `Math.min(paymentAmount, currentInvoice.amountDue)` rather than creating negative debt. This is consistent with standard accounts receivable accounting where credit balances are tracked as liabilities or unallocated payments rather than negative receivables.

---

## 4. Conclusion

- The implementation of Milestone 4 (Invoices, Payments, and Statements) is **robust, well-structured, compliant with project contracts, and fully verified**.
- The `InvoiceForm` ref guards completely resolve the infinite render loop and prevent user data loss during customer syncs.
- `atomicMutations` strictly utilizes `writeBatch(firestore)` with 0 `runTransaction` calls, isolates DRAFT invoices from customer balances, and computes exact delta arithmetic for customer accumulators.
- Application routing in `App.tsx` and query parameter parsing across `InvoiceList`, `PaymentList`, and `StatementOfAccount` provide comprehensive deep-linking capabilities.
- Build compiles with 0 type errors; 420 of 420 tests pass; headless Electron smoke and IPC tests pass with 100% success.
- **Review Verdict**: **APPROVE**.

---

## 5. Verification Method

To independently reproduce and verify this review, run:

```bash
# 1. Verify TypeScript compilation and Vite packaging
npm run build

# 2. Run the complete automated test suite (36 files, 420 tests)
npm test

# 3. Verify headless Electron launch and window.electronAPI IPC
npm run test:smoke

# 4. Verify empirical sandbox IPC integrity
node tests/smoke/empirical-sandbox-ipc.smoke.mjs
```

### Invalidation Conditions
- Any occurrence of `runTransaction` in `src/`
- Any regression causing `InvoiceForm` to reset line items on background customer query update
- Any failure or timeout in `npm test` or `npm run build`
