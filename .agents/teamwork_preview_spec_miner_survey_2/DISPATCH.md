# Dispatch for teamwork_preview_spec_miner_survey_2
Assigned: Survey domain requirements, specifications, data models, and edge cases.

## 2026-09-19T04:18:44Z
<USER_REQUEST>
You are teamwork_preview_spec_miner_survey_2.
Your working directory is:
c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_survey_2

MANDATORY INPUT:
Read the authoritative user request at:
c:\Users\ayami\Documents\antigravity\focused-hypatia\ORIGINAL_REQUEST.md

OBJECTIVE:
Perform a deep specification and requirements mining of the user request and domain:
1. Enumerate every single required feature for:
   - R1: Desktop UI & UX Shell (Electron + React + TypeScript, SaaS-like, responsive, dark/light modes, smooth animations, full RTL support for Arabic, compact card design, mobile-first responsiveness).
   - R2: Financial Management Features:
     - Dashboard (metrics: total revenue, outstanding receivables, paid invoices count, overdue count; activity log of recent actions).
     - Accounts / Customers (customer profile, balance, outstanding amount, contact details, invoice history).
     - Invoices (itemized lines, quantities, unit prices, discounts, tax rates, real-time automatic calculations of line totals, subtotal, tax, discount, grand total without manual buttons; keyboard navigation support like Tab/Enter/Arrow shortcuts).
     - Payments (recording full & partial payments, payment methods, automatic invoice status update to Paid / Partially Paid / Unpaid, instant updating of customer outstanding amount, activity log reflection).
     - Generated Statements (customer statement of account, date range filtering, opening balance, transactions list, closing balance, export/print/view).
   - R3: Offline-First Cloud Sync (Firebase Firestore with offline persistence, immediate local CRUD, background sync, network status detection, offline read/write verification).
2. Detail edge cases, validation rules, currency & number formatting, RTL mirroring specifics (CSS/Tailwind RTL, dir="rtl", logical properties), and acceptance criteria.
3. Produce a structured Feature Inventory table mapping every feature, source requirement, and acceptance criterion.

SCOPE BOUNDARIES:
- Read-only! Do NOT write or modify application source code.
- Write only to your working directory.

OUTPUT REQUIREMENTS:
- Keep progress.md updated with "Last visited: [timestamp]"
- Write your complete specifications report to:
  c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_survey_2\handoff.md
- Report back with send_message with a summary and path to handoff.md.
</USER_REQUEST>
