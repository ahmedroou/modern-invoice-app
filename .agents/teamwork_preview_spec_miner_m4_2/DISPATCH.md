## 2026-09-19T11:45:53Z
You are the Payments and Statements Spec Miner for Milestone 4 of the Modern Offline-First Desktop Invoice Application.
Working directory: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_m4_2

MANDATORY FIRST STEP:
Read the following authoritative specification files:
1. c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md (Authoritative User Request)
2. c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md (Project Architecture, Milestones, and Interface Contracts)
3. c:\Users\ayami\Documents\antigravity\focused-hypatia\TEST_INFRA.md (Acceptance Criteria & Test Specifications)

Your Mission:
Mine exact specifications and behavioral requirements for Payments and Statements:
1. Payments Module:
   - Recording partial and full payments against an invoice.
   - Payment method support: CASH, BANK_TRANSFER, CREDIT_CARD, CHECK, ONLINE_GATEWAY, OTHER, with optional reference number and notes.
   - Invoice status auto-transition:
     - If amountPaid >= grandTotal -> status becomes PAID.
     - If amountPaid > 0 and amountPaid < grandTotal -> status becomes PARTIALLY_PAID.
   - Balance synchronization:
     - Invoice: amountPaid += paymentAmount, amountDue = grandTotal - amountPaid.
     - Customer: outstandingAmount -= paymentAmount, totalPaid += paymentAmount.
     - Dashboard metrics: Total Revenue increments by paymentAmount, Outstanding Receivables decrements by paymentAmount, Paid Invoices counter increments if fully paid.
   - Activity Log: Instantly record PAYMENT_RECORDED event in activity_log collection.
   - Atomic batch: All above mutations executed in a single writeBatch for 100% offline reliability.
2. Statements Module (Statement of Account):
   - Customer statement generation with customizable date range (startDate, endDate).
   - Opening balance calculation: Cumulative unpaid balance before startDate (sum of invoices before start minus sum of payments before start).
   - Ledger transaction lines within date range: Invoices (Debit), Payments (Credit), with running balance column (prevBalance + debit - credit).
   - Closing balance calculation: Opening Balance + Total Invoiced in period - Total Paid in period.
   - Export & Print capabilities:
     - Print preview / PDF export layout (clean margins, company branding, no UI buttons).
     - CSV export with RFC 4180 escaping and UTF-8 BOM (\uFEFF) for Arabic character support in Excel.
   - Full Arabic RTL mirroring and Tajawal/Cairo typography support.

Deliverable:
Write a detailed specification and implementation guidance report to:
c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_m4_2\handoff.md
Detail:
- Exact data schemas and validation rules for Payment and Statement data structures.
- Math invariants and edge cases (e.g. overpayment prevention, date boundary filtering 00:00:00 to 23:59:59, cancelled invoice handling).
- UI component designs for PaymentModal.tsx, PaymentList.tsx, StatementGenerator.tsx, StatementPrintView.tsx, and usePayments.ts.
- Recommended implementation instructions for the Worker.
When done, message the orchestrator with your findings.
