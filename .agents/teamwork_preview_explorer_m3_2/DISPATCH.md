# Dispatch: Explorer M3-2 (Customer Ledger, Balance Tracking & Transaction History)

**Agent Identity**: teamwork_preview_explorer_m3_2
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_2
**Role**: Customer Ledger & History Specialist
**Milestone**: Milestone 3 (Customer Directory & Financial Dashboard Modules)

## Task Description
Investigate and design the Customer Profile, Ledger View, and Transaction History (`CustomerLedger.tsx`):
1. **Ledger Data Aggregation & Flow**:
   - How to query and join invoices (`invoices` collection where `customerId == id`) and payments (`payments` collection where `customerId == id`) offline from Firestore IndexedDB cache.
   - Design chronological transaction interleaving (Debit = Invoiced, Credit = Paid) to compute running balance accurately using `roundFinancial`.
2. **Customer Profile & Summary Cards**:
   - Design top summary section: Customer details (tax number, address, phone with `<BidiIsolate>`), Compact KPI cards (<90px height): Total Invoiced, Total Paid, Current Outstanding Balance.
   - Status indicators (e.g. Cleared, Has Balance, Overdue).
3. **UI/UX & Mobile-First RTL Guidelines**:
   - Responsive ledger table / card list adapting from mobile (375px) to desktop.
   - RTL bidi protection: invoice numbers, dates, currency amounts, and phone numbers.
   - Action buttons: Quick New Invoice for Customer, Quick Record Payment for Customer.
4. Read:
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\types\domain.ts`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\lib\calculations.ts`

Write your comprehensive architectural analysis, component specifications, and concrete recommendations in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_2\handoff.md` and report back via send_message.

## 2026-09-19T09:46:38Z
Investigate and design Customer Profile, Ledger View, and Transaction History (CustomerLedger.tsx):
1. Offline query and join of invoices and payments for customer to build chronological ledger with running balance (debit/credit) using roundFinancial.
2. Customer summary card with contact info, tax number, and compact KPI metrics (<90px height).
3. Mobile-first (375px) responsive layout, full Arabic RTL mirroring, and bidi protection.
Write your findings and actionable specifications in c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_2\handoff.md and report back via send_message.
