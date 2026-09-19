# Dispatch: Explorer M3-1 (Customer Domain, CRUD & State Architecture)

**Agent Identity**: teamwork_preview_explorer_m3_1
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_1
**Role**: Customer Domain & State Architecture Specialist
**Milestone**: Milestone 3 (Customer Directory & Financial Dashboard Modules)

## Task Description
Investigate and design the Customer Directory, CRUD forms, and reactive state management:
1. **Data Model & Interface Conformance**:
   - Inspect `src/types/domain.ts` for `Customer` interface (`id`, `name`, `email`, `phone`, `address`, `taxNumber`, `outstandingAmount`, `totalInvoiced`, `totalPaid`, `createdAt`, `updatedAt`).
   - Check `src/lib/atomicMutations.ts` for `createCustomerAtomic` and how customer balance updates are executed.
2. **Hook Design (`useCustomers.ts`)**:
   - Design a reactive hook subscribing to `customers` collection via `onSnapshot` with `includeMetadataChanges: true` against IndexedDB cache.
   - Provide search/filter capabilities (by name, email, phone) and sorting (alphabetical, balance descending, recency).
   - Provide CRUD operations (`createCustomer`, `updateCustomer`, `deleteCustomer`).
3. **Component Architecture (`CustomerList.tsx`, `CustomerModal.tsx`)**:
   - Mobile-first responsive layout (375px mobile card view, desktop table/grid view).
   - Compact styling (<90px card height on mobile, dense rows).
   - Full Arabic RTL support, `<BidiIsolate>` for phone numbers and IDs.
   - Accessible form dialog with validation.
4. Read:
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\types\domain.ts`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\lib\atomicMutations.ts`

Write your comprehensive architectural analysis, component specifications, and concrete recommendations in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_1\handoff.md` and report back via send_message.

## 2026-09-19T09:46:38Z
User Request received to investigate and design Customer Directory, CRUD forms, and reactive state management:
1. Customer Data Model & interface conformance.
2. Hook design (useCustomers.ts) with onSnapshot against Firestore IndexedDB cache, search/filter, and CRUD.
3. Component architecture (CustomerList.tsx, CustomerModal.tsx) with mobile-first (<90px cards, 375px responsive), Arabic RTL, and bidi isolation.
Write findings and actionable specifications in handoff.md and report back via send_message.

