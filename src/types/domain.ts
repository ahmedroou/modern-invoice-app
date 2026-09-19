export type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'ONLINE_GATEWAY' | 'OTHER';

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  currency: string;
  outstandingAmount: number;
  totalInvoiced: number;
  totalPaid: number;
  notes?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'PERCENTAGE' | 'FIXED';
  taxRate: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  items: InvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  status: InvoiceStatus;
  notes?: string;
  terms?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'synced' | 'pending' | 'syncing' | 'error';
}

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  eventType: 'CUSTOMER_CREATED' | 'CUSTOMER_UPDATED' | 'INVOICE_CREATED' | 'INVOICE_UPDATED' | 'INVOICE_STATUS_CHANGED' | 'PAYMENT_RECORDED';
  entityType: 'CUSTOMER' | 'INVOICE' | 'PAYMENT';
  entityId: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface StatementDateRange {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
}

export interface StatementEntry {
  id: string;
  type: 'INVOICE' | 'PAYMENT';
  date: string;          // "YYYY-MM-DD"
  createdAt: string;     // ISO timestamp for tie-breaking
  referenceNumber: string; // Invoice # or Payment #
  description: string;
  debit: number;         // Positive for INVOICE, 0 for PAYMENT
  credit: number;        // 0 for INVOICE, positive for PAYMENT
  runningBalance: number;// Cumulative balance after this entry
  currency: string;
  status?: InvoiceStatus;
  paymentMethod?: PaymentMethod;
}

export interface StatementSummary {
  customer: Customer;
  dateRange: StatementDateRange;
  openingBalance: number;
  totalInvoiced: number; // Sum of debits in period
  totalPaid: number;     // Sum of credits in period
  netChange: number;     // totalInvoiced - totalPaid
  closingBalance: number;// openingBalance + netChange
  entries: StatementEntry[];
  generatedAt: string;
}

// ─── Accounts Payable & Expenses (المصروفات والمشتريات والموردين) ──────────────

export type ExpenseBillStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type ExpenseCategory =
  | 'GOODS'        // مشتريات بضائع ومخزون
  | 'RENT'         // إيجارات ومقرات
  | 'SALARIES'     // أجور ومستحقات أفراد
  | 'UTILITIES'    // فواتير تشغيلية (كهرباء، ماء، إنترنت)
  | 'MAINTENANCE'  // صيانة وخدمات فنية
  | 'SHIPPING'     // شحن ونقل وتوصيل
  | 'MARKETING'    // تسويق وإعلانات
  | 'OTHER';       // أخرى

export interface Vendor {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  category?: string;
  currency: string;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  status: 'ACTIVE' | 'ARCHIVED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseBillItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

export interface ExpenseBill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  issueDate: string;
  dueDate: string;
  category: ExpenseCategory;
  currency: string;
  items: ExpenseBillItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  status: ExpenseBillStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'synced' | 'pending' | 'syncing' | 'error';
}

export interface ExpensePayment {
  id: string;
  voucherNumber: string;
  billId?: string;
  billNumber?: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}


