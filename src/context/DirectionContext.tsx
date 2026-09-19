import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type Direction = 'ltr' | 'rtl';
export type Language = 'en' | 'ar';

export interface DirectionContextValue {
  direction: Direction;
  language: Language;
  isRTL: boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatNumber: (num: number) => string;
}

// Built-in lightweight dictionary for instant RTL/LTR UI shell localization
const DICTIONARY: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.invoices': 'Invoices',
    'nav.customers': 'Customers',
    'nav.payments': 'Payments',
    'nav.statements': 'Statements',
    'nav.settings': 'Settings',
    // Actions
    'action.newInvoice': 'New Invoice',
    'action.newCustomer': 'New Customer',
    'action.recordPayment': 'Record Payment',
    'action.generateStatement': 'Generate Statement',
    'action.search': 'Search...',
    'action.filter': 'Filter',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.print': 'Print',
    'action.export': 'Export',
    'action.collapse': 'Collapse Sidebar',
    'action.expand': 'Expand Sidebar',
    // Status
    'status.draft': 'Draft',
    'status.unpaid': 'Unpaid',
    'status.partiallyPaid': 'Partially Paid',
    'status.paid': 'Paid',
    'status.overdue': 'Overdue',
    'status.cancelled': 'Cancelled',
    // Sync
    'sync.online': 'Online (Synced)',
    'sync.syncing': 'Syncing...',
    'sync.offline': 'Offline (Saved locally)',
    // Theming & Language
    'theme.light': 'Light Mode',
    'theme.dark': 'Dark Mode',
    'theme.system': 'System Theme',
    'lang.arabic': 'العربية',
    'lang.english': 'English',
    // KPI Cards
    'kpi.totalRevenue': 'Total Revenue',
    'kpi.outstandingReceivables': 'Outstanding Receivables',
    'kpi.paidInvoices': 'Paid Invoices',
    'kpi.overdueInvoices': 'Overdue Invoices',
    'kpi.activeCustomers': 'Active Customers',
    // Invoices
    'invoice.title': 'Invoices',
    'invoice.newInvoice': 'New Invoice',
    'invoice.editInvoice': 'Edit Invoice',
    'invoice.invoiceDetails': 'Invoice Details',
    'invoice.invoiceNumber': 'Invoice #',
    'invoice.customer': 'Customer',
    'invoice.selectCustomer': 'Select a customer...',
    'invoice.issueDate': 'Issue Date',
    'invoice.dueDate': 'Due Date',
    'invoice.lineItems': 'Line Items',
    'invoice.description': 'Description',
    'invoice.qty': 'Qty',
    'invoice.unitPrice': 'Unit Price',
    'invoice.discount': 'Discount',
    'invoice.tax': 'Tax',
    'invoice.total': 'Total',
    'invoice.subtotal': 'Subtotal',
    'invoice.totalDiscount': 'Total Discount',
    'invoice.totalTax': 'Total Tax',
    'invoice.grandTotal': 'Grand Total',
    'invoice.amountDue': 'Amount Due',
    'invoice.amountPaid': 'Amount Paid',
    'invoice.addLineItem': 'Add Item (Enter)',
    'invoice.deleteItem': 'Delete Item',
    'invoice.empty': 'No invoices found',
    'invoice.cancelConfirm': 'Are you sure you want to cancel this invoice?',
    'invoice.cancelInvoice': 'Cancel Invoice',
    // Payments
    'payment.title': 'Payments',
    'payment.recordPayment': 'Record Payment',
    'payment.paymentNumber': 'Payment #',
    'payment.amount': 'Amount',
    'payment.method': 'Payment Method',
    'payment.date': 'Payment Date',
    'payment.reference': 'Reference / Transaction ID',
    'payment.notes': 'Notes',
    'payment.cash': 'Cash',
    'payment.bankTransfer': 'Bank Transfer',
    'payment.creditCard': 'Credit Card',
    'payment.check': 'Check',
    'payment.online': 'Online Gateway',
    'payment.other': 'Other',
    'payment.empty': 'No payments recorded',
    'payment.fullAmount': '100% Full',
    'payment.halfAmount': '50%',
    // Statements
    'statement.title': 'Statement of Account',
    'statement.subtitle': 'Customer ledger statement & transaction history',
    'statement.startDate': 'Start Date',
    'statement.endDate': 'End Date',
    'statement.openingBalance': 'Opening Balance',
    'statement.closingBalance': 'Closing Balance',
    'statement.debit': 'Debit (Invoiced)',
    'statement.credit': 'Credit (Paid)',
    'statement.runningBalance': 'Running Balance',
    'statement.noTransactions': 'No transactions during this period',
    'statement.exportCsv': 'Export CSV',
    'statement.printPdf': 'Print / PDF',
    'statement.generate': 'Generate Statement',
    // App Brand
    'app.name': 'Modern Invoice',
    'app.tagline': 'Offline-First Financial Management'
  },
  ar: {
    // Navigation
    'nav.dashboard': 'لوحة التحكم',
    'nav.invoices': 'الفواتير',
    'nav.customers': 'العملاء',
    'nav.payments': 'المدفوعات',
    'nav.statements': 'كشوفات الحساب',
    'nav.settings': 'الإعدادات',
    // Actions
    'action.newInvoice': 'فاتورة جديدة',
    'action.newCustomer': 'عميل جديد',
    'action.recordPayment': 'تسجيل دفعة',
    'action.generateStatement': 'إنشاء كشف حساب',
    'action.search': 'بحث...',
    'action.filter': 'تصفية',
    'action.save': 'حفظ',
    'action.cancel': 'إلغاء',
    'action.delete': 'حذف',
    'action.edit': 'تعديل',
    'action.print': 'طباعة',
    'action.export': 'تصدير',
    'action.collapse': 'طي القائمة',
    'action.expand': 'توسيع القائمة',
    // Status
    'status.draft': 'مسودة',
    'status.unpaid': 'غير مدفوعة',
    'status.partiallyPaid': 'مدفوعة جزئياً',
    'status.paid': 'مدفوعة',
    'status.overdue': 'متأخرة',
    'status.cancelled': 'ملغاة',
    // Sync
    'sync.online': 'متصل (تمت المزامنة)',
    'sync.syncing': 'جارٍ المزامنة...',
    'sync.offline': 'غير متصل (محفوظ محلياً)',
    // Theming & Language
    'theme.light': 'الوضع الفاتح',
    'theme.dark': 'الوضع الداكن',
    'theme.system': 'تلقائي للنظام',
    'lang.arabic': 'العربية',
    'lang.english': 'English',
    // KPI Cards
    'kpi.totalRevenue': 'إجمالي الإيرادات',
    'kpi.outstandingReceivables': 'المستحقات المعلقة',
    'kpi.paidInvoices': 'الفواتير المدفوعة',
    'kpi.overdueInvoices': 'الفواتير المتأخرة',
    'kpi.activeCustomers': 'العملاء النشطون',
    // Invoices
    'invoice.title': 'الفواتير',
    'invoice.newInvoice': 'فاتورة جديدة',
    'invoice.editInvoice': 'تعديل الفاتورة',
    'invoice.invoiceDetails': 'تفاصيل الفاتورة',
    'invoice.invoiceNumber': 'رقم الفاتورة',
    'invoice.customer': 'العميل',
    'invoice.selectCustomer': 'اختر عميلاً...',
    'invoice.issueDate': 'تاريخ الإصدار',
    'invoice.dueDate': 'تاريخ الاستحقاق',
    'invoice.lineItems': 'بنود الفاتورة',
    'invoice.description': 'الوصف',
    'invoice.qty': 'الكمية',
    'invoice.unitPrice': 'سعر الوحدة',
    'invoice.discount': 'الخصم',
    'invoice.tax': 'الضريبة',
    'invoice.total': 'المجموع',
    'invoice.subtotal': 'المجموع الفرعي',
    'invoice.totalDiscount': 'إجمالي الخصم',
    'invoice.totalTax': 'إجمالي الضريبة',
    'invoice.grandTotal': 'المجموع الكلي',
    'invoice.amountDue': 'المبلغ المستحق',
    'invoice.amountPaid': 'المبلغ المدفوع',
    'invoice.addLineItem': 'إضافة بند (Enter)',
    'invoice.deleteItem': 'حذف البند',
    'invoice.empty': 'لا توجد فواتير',
    'invoice.cancelConfirm': 'هل أنت متأكد من إلغاء هذه الفاتورة؟',
    'invoice.cancelInvoice': 'إلغاء الفاتورة',
    // Payments
    'payment.title': 'المدفوعات',
    'payment.recordPayment': 'تسجيل دفعة',
    'payment.paymentNumber': 'رقم الإيصال',
    'payment.amount': 'المبلغ',
    'payment.method': 'طريقة الدفع',
    'payment.date': 'تاريخ الدفع',
    'payment.reference': 'رقم المرجع / المعاملة',
    'payment.notes': 'ملاحظات',
    'payment.cash': 'نقداً',
    'payment.bankTransfer': 'تحويل بنكي',
    'payment.creditCard': 'بطاقة ائتمان',
    'payment.check': 'شيك',
    'payment.online': 'بوابة دفع إلكتروني',
    'payment.other': 'أخرى',
    'payment.empty': 'لا توجد مدفوعات مسجلة',
    'payment.fullAmount': '100% كامل المبلغ',
    'payment.halfAmount': '50%',
    // Statements
    'statement.title': 'كشف حساب',
    'statement.subtitle': 'كشف الحساب المالي وسجل المعاملات',
    'statement.startDate': 'من تاريخ',
    'statement.endDate': 'إلى تاريخ',
    'statement.openingBalance': 'الرصيد الافتتاحي',
    'statement.closingBalance': 'الرصيد الختامي',
    'statement.debit': 'مدين (فواتير)',
    'statement.credit': 'دائن (مدفوعات)',
    'statement.runningBalance': 'الرصيد التراكمي',
    'statement.noTransactions': 'لا توجد معاملات خلال هذه الفترة',
    'statement.exportCsv': 'تصدير CSV',
    'statement.printPdf': 'طباعة / PDF',
    'statement.generate': 'إنشاء كشف الحساب',
    // App Brand
    'app.name': 'مودرن إنفويس',
    'app.tagline': 'إدارة مالية متقدمة دون اتصال'
  }
};

const DirectionContext = createContext<DirectionContextValue | undefined>(undefined);

export const DirectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('app_language');
      return saved === 'ar' || saved === 'en' ? saved : 'en';
    }
    return 'en';
  });

  const direction: Direction = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = direction === 'rtl';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = direction;
      document.documentElement.lang = language;
      document.documentElement.setAttribute('data-direction', direction);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('app_language', language);
    }
  }, [direction, language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState(prev => (prev === 'en' ? 'ar' : 'en'));
  };

  const t = (key: string, fallback?: string): string => {
    const langDict = DICTIONARY[language] || DICTIONARY.en;
    if (langDict[key]) return langDict[key];
    if (DICTIONARY.en[key]) return DICTIONARY.en[key];
    return fallback || key;
  };

  // Safe bidi currency formatting avoiding arithmetic inversion in Arabic
  const formatCurrency = (amount: number, currency: string = 'SAR'): string => {
    const formattedNum = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount));

    const sign = amount < 0 ? '-' : '';
    if (language === 'ar') {
      const symbol = currency === 'SAR' ? 'ر.س' : currency;
      return `${sign}${formattedNum} ${symbol}`;
    }
    const symbol = currency === 'USD' ? '$' : `${currency} `;
    return `${sign}${symbol}${formattedNum}`;
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const value = useMemo(
    () => ({
      direction,
      language,
      isRTL,
      setLanguage,
      toggleLanguage,
      t,
      formatCurrency,
      formatNumber
    }),
    [direction, language, isRTL]
  );

  return <DirectionContext.Provider value={value}>{children}</DirectionContext.Provider>;
};

export const useDirection = (): DirectionContextValue => {
  const context = useContext(DirectionContext);
  if (!context) {
    throw new Error('useDirection must be used within a DirectionProvider');
  }
  return context;
};
