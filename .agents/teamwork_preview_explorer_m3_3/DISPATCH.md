## 2026-09-19T09:46:38Z

# Dispatch: Explorer M3-3 (Real-Time Financial Dashboard & Activity Log)

**Agent Identity**: teamwork_preview_explorer_m3_3
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_3
**Role**: Real-Time Dashboard & Activity Log Specialist
**Milestone**: Milestone 3 (Customer Directory & Financial Dashboard Modules)

## Task Description
Investigate and design the Real-Time Financial Dashboard and Chronological Activity Log:
1. **Dynamic Metrics Calculation (`useDashboardMetrics.ts`)**:
   - Design reactive calculation from live Firestore snapshot data:
     - Total Revenue: Total amount collected across all payments (or paid invoices).
     - Outstanding Receivables: Total unpaid amount across all non-cancelled invoices (must match sum of customer outstanding balances).
     - Paid Invoices Count: Total count of invoices with status `PAID`.
     - Overdue Invoices Count: Total count of invoices where `dueDate < today` and `amountDue > 0`.
   - Ensure calculations use `roundFinancial` from `src/lib/calculations.ts`.
2. **Dashboard Layout & Compact Metric Cards (`DashboardView.tsx`, `MetricsGrid.tsx`)**:
   - Layout strictly obeying User Global Rules:
     - Compact card designs by default (<90px height, actual: 82px).
     - Mobile-first responsive layout (375px viewport with 2-column mobile grid, 4-column desktop grid).
     - Full Arabic RTL mirroring and `<BidiIsolate>` for formatted currencies and numeric trends.
3. **Real-Time Chronological Activity Log (`ActivityFeed.tsx`)**:
   - Subscribes to `activity_logs` collection ordered by `timestamp desc` with limit (e.g. 10–20 recent items).
   - Event types: `CUSTOMER_CREATED`, `CUSTOMER_UPDATED`, `INVOICE_CREATED`, `PAYMENT_RECORDED`, `INVOICE_STATUS_CHANGED`.
   - Visual icons, relative time formatting (e.g. "just now", "2 hours ago" in English & Arabic), and entity tags.
   - Mobile-first compact feed list.
4. Read:
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\components\common\CompactMetricCard.tsx`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\types\domain.ts`

Write your comprehensive architectural analysis, component specifications, and concrete recommendations in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_3\handoff.md` and report back via send_message.
