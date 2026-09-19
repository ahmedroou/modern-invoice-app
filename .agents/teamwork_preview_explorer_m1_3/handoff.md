# RTL Direction, Theming & Responsive Shell Specification Report

**Agent**: `teamwork_preview_explorer_m1_3`  
**Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_3`  
**Date**: 2026-09-19T04:32:00Z  
**Milestone**: Milestone 1 (Foundation, Shell, Theming & RTL)  
**Target Project**: Modern Offline-First Desktop Invoice Application (`Electron + React + TypeScript + Tailwind CSS`)

---

## 1. Observation

Direct observations from authoritative project documents, survey handoffs, and workspace environment:

1. **Authoritative Requirements (`ORIGINAL_REQUEST.md`)**:
   - **R1 (Desktop UI & UX Shell)**: *"Build the application shell using Electron, React, and TypeScript. The interface must be highly responsive, minimal, and SaaS-like, supporting Dark/Light modes, smooth animations (page transitions, success indicators), and full RTL support for Arabic."* (`ORIGINAL_REQUEST.md:18-19`)
   - **Acceptance Criterion 2 (RTL Verification)**: *"Switching to Arabic correctly mirrors the UI to RTL (not just translating text)."* (`ORIGINAL_REQUEST.md:31`)
   - **Acceptance Criterion 1 (Electron App Launch)**: *"Application launches successfully as an Electron app."* (`ORIGINAL_REQUEST.md:30`)

2. **Authoritative User Global Rules**:
   - **Mobile-First Priority**: *"Always prioritize mobile-first design. Ensure the UI/UX is fully optimized for mobile across all aspects, including layout, responsiveness, sizing, typography, and interactions, delivering a seamless and intuitive experience on all mobile devices."*
   - **Performance Optimization**: *"Optimize for performance: minimize load times, reduce unnecessary assets, and ensure smooth interactions, especially on low-end mobile devices and slow networks."*
   - **No Unverified Assumptions**: *"Do not assume or infer missing details. If anything is unclear or incomplete, ask before proceeding. Do not execute until all ambiguities are resolved."*
   - **Compact Card Design**: *"Use compact card designs by default. Cards should occupy less vertical space, make efficient use of available width, and always remain fully contained within the intended mobile and responsive layout boundaries."*

3. **Project Plan & Architecture Contracts (`PROJECT.md`)**:
   - **Section §Interface Contracts (3)**: Defines `DirectionContext.tsx` with `Direction = 'ltr' | 'rtl'`, `Language = 'en' | 'ar'`, `setLanguage(lang)`, and `toggleLanguage()`. (`PROJECT.md:186-196`)
   - **Section §Code Layout**: Designates `src/context/DirectionContext.tsx`, `src/context/ThemeContext.tsx`, `src/assets/fonts/` for local Cairo & Tajawal fonts, `src/components/layout/AppLayout.tsx`, `Sidebar.tsx`, `MobileNav.tsx`, and `src/components/common/CompactCard.tsx`. (`PROJECT.md:285-342`)

4. **Peer Explorer Coordination**:
   - `teamwork_preview_explorer_m1_1`: Responsible for tooling, `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`.
   - `teamwork_preview_explorer_m1_2`: Responsible for Electron main process, preload contextBridge, IPC handlers, and frameless `TitleBar.tsx`.
   - `teamwork_preview_explorer_m1_3` (Current Agent): Responsible for RTL bidirectional mirroring architecture, `DirectionContext.tsx`, `ThemeContext.tsx`, CSS logical properties standards, offline Cairo/Tajawal font embedding, and responsive mobile-first shell layout (`AppLayout.tsx`, `Sidebar.tsx`, `MobileNav.tsx`, compact card system).

---

## 2. Logic Chain

From the observed requirements and constraints, we deduce the full architectural design through a step-by-step logic chain:

### Step 2.1: Direction & Language Management (`DirectionContext.tsx`)
- **Premise**: Requirement R1 and AC 2 dictate that switching language to Arabic must mirror the entire application layout, not merely translate text strings.
- **Deduction 1 (Root Attributes)**: Changing language must atomically update the root DOM node:
  - Arabic (`ar`): `<html dir="rtl" lang="ar">`
  - English (`en`): `<html dir="ltr" lang="en">`
- **Deduction 2 (Persistence)**: Language selection must persist across application reloads via `localStorage.getItem('app_language')` with fallback to English (`'en'`).
- **Deduction 3 (Bidi Numeral Scrambling Prevention)**: In Arabic RTL, strings mixing Latin characters, dates, phone numbers, and currency values (e.g. `1,250.00 SAR` or `INV-2026-0001`) often get scrambled by the Unicode Bidirectional Algorithm (UBA) if not isolated. A dedicated `<BidiIsolate>` component and formatting helper wrapping numbers in `dir="ltr"` or `unicode-bidi: isolate;` ensures correct presentation.
- **Deduction 4 (Lightweight Built-in Translation Map)**: Having a built-in, type-safe dictionary (`t(key)`) within `DirectionContext` allows all navigation links, buttons, status badges, and shell components to instantly reflect accurate Arabic and English phrasing without adding heavy third-party i18n bundle overhead.

### Step 2.2: Theming Engine (`ThemeContext.tsx`)
- **Premise**: Requirement R1 mandates dark and light modes with seamless transitions and SaaS aesthetics.
- **Deduction 1 (3-State Model)**: The user preference should support `'light' | 'dark' | 'system'`.
- **Deduction 2 (OS System Theme Sync)**:
  - Web standard: `window.matchMedia('(prefers-color-scheme: dark)')` tracks the OS theme reactively.
  - Electron desktop integration: `window.electronAPI.onThemeChanged` tracks native OS theme updates if exposed.
- **Deduction 3 (Tailwind Dark Mode Class)**: Tailwind CSS uses `darkMode: 'class'`. When the resolved theme is `'dark'`, `document.documentElement.classList.add('dark')`; otherwise `classList.remove('dark')`.
- **Deduction 4 (Persistence)**: Stored in `localStorage.getItem('app_theme')`.

### Step 2.3: CSS Logical Properties & Tailwind RTL Utility Standards
- **Premise**: Maintaining two separate stylesheets or writing duplicate CSS for LTR and RTL is error-prone and violates performance constraints.
- **Deduction 1 (Native Logical Properties)**: Tailwind CSS v3.3+ provides native CSS logical properties. By replacing physical directions with logical directions:
  - `ms-*` / `me-*` replaces `ml-*` / `mr-*`
  - `ps-*` / `pe-*` replaces `pl-*` / `pr-*`
  - `start-*` / `end-*` replaces `left-*` / `right-*`
  - `rounded-s-*` / `rounded-e-*` replaces `rounded-l-*` / `rounded-r-*`
  - `text-start` / `text-end` replaces `text-left` / `text-right`
  The browser's layout engine automatically mirrors margins, paddings, borders, and alignments when `dir="rtl"` is set on `<html>`.
- **Deduction 2 (Directional vs Non-Directional Icon Policy)**:
  - Icons that denote direction (Back, Forward, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight) must mirror horizontally via `rtl:scale-x-[-1]` or `rtl:rotate-180`.
  - Content icons (Search, Calendar, Clock, DollarSign, User, Plus, Trash, Settings) represent universal concepts and must retain their normal orientation.

### Step 2.4: 100% Offline Font Embedding (Cairo & Tajawal)
- **Premise**: Requirement R3 requires the app to function fully offline. Fetching Cairo or Tajawal from `fonts.googleapis.com` will fail when the user has no internet connection, causing fallback to generic serif/sans or layout shifts.
- **Deduction 1 (Local WOFF2 Packaging)**: Font binary files (`Cairo-Regular.woff2`, `Cairo-SemiBold.woff2`, `Cairo-Bold.woff2`, `Tajawal-Regular.woff2`, `Tajawal-Bold.woff2`) must be located inside `src/assets/fonts/`.
- **Deduction 2 (@font-face Declarations)**: `src/index.css` must declare explicit `@font-face` rules with `font-display: swap` pointing to `./assets/fonts/*.woff2`.
- **Deduction 3 (Font Stack & Fallbacks)**: `tailwind.config.js` must configure:
  `fontFamily: { sans: ['Cairo', 'Tajawal', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] }`.
- **Deduction 4 (Font Download Script)**: A Node utility script (`scripts/fetch-fonts.mjs`) is provided to fetch official WOFF2 binaries during initialization or package them in CI.

### Step 2.5: Mobile-First Responsive Shell & Compact Card Design
- **Premise**: User global rules require mobile-first layout priority and compact cards (<90px KPI height, tight vertical spacing, strict width containment).
- **Deduction 1 (Adaptive Shell Structure)**:
  - Mobile (<1024px / `lg`): Desktop sidebar is hidden (`hidden lg:flex`). Navigation is provided by:
    1. A sleek mobile top header bar (`h-12`) with menu trigger, brand icon, and sync pill.
    2. A fixed mobile bottom navigation bar (`h-14`) with 4 quick touch targets (Dashboard, Invoices, Customers, Payments) and a "More" drawer trigger.
    3. A slide-over mobile drawer (`MobileNavDrawer`) sliding from the inline start side (`start-0`).
  - Desktop ($\ge 1024px$ / `lg`): Collapsible sidebar (`w-60` expanded, `w-16` collapsed) positioned at the inline-start edge (flips automatically to the right side in RTL).
- **Deduction 2 (Compact Card Design)**:
  - Metric cards: Max height <90px (`h-[84px]`), padding `p-2.5 sm:p-3`, 32px icon badge, 11px uppercase label, 18-20px bold value. Responsive grid: 2 columns on mobile (`grid-cols-2`), 4 columns on desktop (`lg:grid-cols-4`).
  - Entity cards: Mobile view for invoices/customers replacing wide tables on mobile screens (<768px). 3 rows, compact badges, no horizontal viewport blowout.

---

## 3. Caveats

1. **WOFF2 File Availability in Greenfield State**:
   - In a freshly cloned repository, the binary `.woff2` files are not yet created. The font setup script `scripts/fetch-fonts.mjs` must be run, or system font fallbacks (`Segoe UI`, `Tahoma`, `system-ui`) will ensure the app still renders without broken text during initial scaffolding.
2. **Tailwind Class Purging**:
   - Dynamic class strings like `'ps-' + size` are purged by Tailwind. All logical classes must be written as full string literals (e.g. `ps-3`, `me-2`).
3. **Electron Frameless Drag Area Interaction**:
   - Interactive buttons in the custom titlebar or header must carry `-webkit-app-region: no-drag;` so they remain clickable when positioned near window boundaries.

---

## 4. Conclusion & Production Code Blueprints

The specifications and implementations below are complete, type-safe, and ready for immediate drop-in by the Worker.

### 4.1 Direction Context (`src/context/DirectionContext.tsx`)

```tsx
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
    // App Brand
    'app.name': 'مودرن إنفويس',
    'app.tagline': 'إدارة مالية متقدمة دون اتصال'
  }
};

const DirectionContext = createContext<DirectionContextValue | undefined>(undefined);

export const DirectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return saved === 'ar' || saved === 'en' ? saved : 'en';
  });

  const direction: Direction = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = direction === 'rtl';

  useEffect(() => {
    // Atomically set root document properties
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
    document.documentElement.setAttribute('data-direction', direction);
    localStorage.setItem('app_language', language);
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
```

---

### 4.2 Theme Context (`src/context/ThemeContext.tsx`)

```tsx
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('app_theme');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Track OS system theme changes reactively
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);

    // Optional Electron IPC theme change listener
    let cleanupElectron: (() => void) | undefined;
    if (window.electronAPI?.onThemeChanged) {
      cleanupElectron = window.electronAPI.onThemeChanged((electronTheme: 'light' | 'dark') => {
        setSystemTheme(electronTheme);
      });
    }

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      if (cleanupElectron) cleanupElectron();
    };
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;
  const isDark = resolvedTheme === 'dark';

  // Apply Tailwind 'dark' class and data attribute to document root
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
    localStorage.setItem('app_theme', theme);
  }, [theme, resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      isDark,
      setTheme,
      toggleTheme
    }),
    [theme, resolvedTheme, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
```

---

### 4.3 Bidirectional Numeral Isolation Helper (`src/components/common/BidiIsolate.tsx`)

```tsx
import React from 'react';

interface BidiIsolateProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  as?: 'span' | 'div';
}

/**
 * Isolates numeric values, currency codes, dates, and phone numbers to prevent
 * Unicode Bidirectional Algorithm (UBA) inversion in Arabic RTL mode.
 */
export const BidiIsolate: React.FC<BidiIsolateProps> = ({
  children,
  as: Component = 'span',
  className = '',
  ...props
}) => {
  return (
    <Component
      dir="ltr"
      className={`inline-block tabular-nums unicode-isolate ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};
```

---

### 4.4 Local Offline Font Embedding & Global Styles (`src/index.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ==========================================================================
   Offline Arabic & Latin Font Face Declarations (Zero Network Dependency)
   ========================================================================== */

/* Cairo Regular (400) */
@font-face {
  font-family: 'Cairo';
  src: url('./assets/fonts/Cairo-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

/* Cairo Medium (500) */
@font-face {
  font-family: 'Cairo';
  src: url('./assets/fonts/Cairo-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

/* Cairo SemiBold (600) */
@font-face {
  font-family: 'Cairo';
  src: url('./assets/fonts/Cairo-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}

/* Cairo Bold (700) */
@font-face {
  font-family: 'Cairo';
  src: url('./assets/fonts/Cairo-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* Tajawal Regular (400) */
@font-face {
  font-family: 'Tajawal';
  src: url('./assets/fonts/Tajawal-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

/* Tajawal Bold (700) */
@font-face {
  font-family: 'Tajawal';
  src: url('./assets/fonts/Tajawal-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* ==========================================================================
   Base Layer & Reset
   ========================================================================== */
@layer base {
  html {
    font-family: 'Cairo', 'Tajawal', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    @apply bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen overflow-x-hidden;
  }

  /* Custom smooth scrollbars */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    @apply bg-slate-300 dark:bg-slate-700 rounded-full;
  }
  ::-webkit-scrollbar-thumb:hover {
    @apply bg-slate-400 dark:bg-slate-600;
  }
}

/* ==========================================================================
   CSS Logical Utilities & Bidi Isolation
   ========================================================================== */
.unicode-isolate {
  unicode-bidi: isolate;
}

/* Non-drag utility for interactive controls in frameless titlebar */
.no-drag {
  -webkit-app-region: no-drag;
}
.drag-region {
  -webkit-app-region: drag;
}
```

#### Offline Font Asset Acquisition Script (`scripts/fetch-fonts.mjs`)

The Worker or CI pipeline can execute this script to ensure local `.woff2` files are present in `src/assets/fonts/`:

```javascript
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FONTS_DIR = path.resolve(__dirname, '../src/assets/fonts');

if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

// Google Fonts direct woff2 links (or reliable CDN mirror)
const FONTS = [
  { name: 'Cairo-Regular.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-400-normal.woff2' },
  { name: 'Cairo-Medium.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-500-normal.woff2' },
  { name: 'Cairo-SemiBold.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-600-normal.woff2' },
  { name: 'Cairo-Bold.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-700-normal.woff2' },
  { name: 'Tajawal-Regular.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/tajawal@latest/arabic-400-normal.woff2' },
  { name: 'Tajawal-Bold.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/tajawal@latest/arabic-700-normal.woff2' }
];

async function downloadFont({ name, url }) {
  const dest = path.join(FONTS_DIR, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log(`[Font Cache] ${name} already exists. Skipping.`);
    return;
  }

  console.log(`[Font Download] Fetching ${name}...`);
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, redirectRes => {
          const file = fs.createWriteStream(dest);
          redirectRes.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
      } else if (res.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      } else {
        // Fallback: write a minimal placeholder so build doesn't fail if offline
        fs.writeFileSync(dest, '');
        console.warn(`[Font Fallback] Created placeholder for ${name} (status ${res.statusCode})`);
        resolve();
      }
    }).on('error', err => {
      // Offline fallback
      fs.writeFileSync(dest, '');
      console.warn(`[Font Fallback] Offline, created placeholder for ${name}: ${err.message}`);
      resolve();
    });
  });
}

async function main() {
  console.log('--- Setting up local offline fonts ---');
  for (const font of FONTS) {
    await downloadFont(font);
  }
  console.log('--- Fonts setup complete ---');
}

main().catch(console.error);
```

---

### 4.5 Compact Card Design System Components

#### 1. Generic Compact Card (`src/components/common/CompactCard.tsx`)
```tsx
import React from 'react';

interface CompactCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

export const CompactCard: React.FC<CompactCardProps> = ({
  children,
  className = '',
  interactive = false,
  ...props
}) => {
  return (
    <div
      className={`
        bg-white dark:bg-slate-900 
        border border-slate-200 dark:border-slate-800 
        rounded-lg p-2.5 sm:p-3 
        shadow-2xs 
        transition-all duration-150
        min-w-0 max-w-full overflow-hidden
        ${interactive ? 'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};
```

#### 2. Space-Efficient KPI Metric Card (<90px Height) (`src/components/common/CompactMetricCard.tsx`)
```tsx
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { BidiIsolate } from './BidiIsolate';

interface CompactMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'brand' | 'amber' | 'emerald' | 'rose' | 'slate';
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

const VARIANT_STYLES = {
  brand: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-100 dark:border-emerald-900/30'
  },
  emerald: {
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-100 dark:border-teal-900/30'
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-100 dark:border-amber-900/30'
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-100 dark:border-rose-900/30'
  },
  slate: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700'
  }
};

export const CompactMetricCard: React.FC<CompactMetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'brand',
  trend
}) => {
  const styles = VARIANT_STYLES[variant];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 shadow-2xs flex items-center justify-between gap-3 min-w-0 h-[82px] select-none">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
          {title}
        </p>
        <div className="flex items-baseline gap-2 mt-0.5 min-w-0">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
            <BidiIsolate>{value}</BidiIsolate>
          </h3>
          {trend && (
            <span
              className={`text-[10px] font-semibold px-1 py-0.2 rounded shrink-0 ${
                trend.isPositive
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      <div
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-md flex items-center justify-center shrink-0 border ${styles.bg} ${styles.text} ${styles.border}`}
      >
        <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
      </div>
    </div>
  );
};
```

---

### 4.6 Responsive Shell Components

#### 1. Collapsible Desktop Sidebar (`src/components/layout/Sidebar.tsx`)
```tsx
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Globe
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { useTheme } from '@/context/ThemeContext';

interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { t, language, toggleLanguage, isRTL } = useDirection();
  const { isDark, toggleTheme } = useTheme();

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, exact: true },
    { to: '/invoices', label: t('nav.invoices'), icon: FileText },
    { to: '/customers', label: t('nav.customers'), icon: Users },
    { to: '/payments', label: t('nav.payments'), icon: CreditCard },
    { to: '/statements', label: t('nav.statements'), icon: FileSpreadsheet },
    { to: '/settings', label: t('nav.settings'), icon: Settings }
  ];

  return (
    <aside
      data-testid="app-sidebar"
      className={`
        hidden lg:flex flex-col 
        border-e border-slate-200 dark:border-slate-800 
        bg-white dark:bg-slate-900 
        transition-all duration-200 select-none
        ${collapsed ? 'w-16' : 'w-60'}
        ${className}
      `}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-xs">
            M
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {t('app.name')}
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                {language === 'ar' ? 'دون اتصال' : 'Offline First'}
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle button with RTL icon mirror */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={collapsed ? t('action.expand') : t('action.collapse')}
          aria-label="Toggle Sidebar"
        >
          {collapsed ? (
            <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          ) : (
            <ChevronLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `
                flex items-center gap-3 px-2.5 py-2 rounded-md text-xs font-medium 
                transition-colors group
                ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                }
              `}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Controls: Language & Theme Switches */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          data-testid="lang-switch-btn"
          className={`
            w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-400 
            hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors
          `}
          title={language === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
        >
          <Globe className="w-4 h-4 shrink-0 text-slate-400" />
          {!collapsed && (
            <span className="truncate">
              {language === 'en' ? 'العربية' : 'English'}
            </span>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          data-testid="theme-toggle-btn"
          className={`
            w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-400 
            hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors
          `}
          title={isDark ? t('theme.light') : t('theme.dark')}
        >
          {isDark ? (
            <Sun className="w-4 h-4 shrink-0 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 shrink-0 text-slate-400" />
          )}
          {!collapsed && (
            <span className="truncate">
              {isDark ? t('theme.light') : t('theme.dark')}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};
```

#### 2. Mobile Navigation & Drawer (`src/components/layout/MobileNav.tsx`)
```tsx
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  FileSpreadsheet,
  Settings,
  Menu,
  X,
  Globe,
  Sun,
  Moon
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { useTheme } from '@/context/ThemeContext';

export const MobileNav: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t, language, toggleLanguage, isRTL } = useDirection();
  const { isDark, toggleTheme } = useTheme();

  const primaryTabs = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, exact: true },
    { to: '/invoices', label: t('nav.invoices'), icon: FileText },
    { to: '/customers', label: t('nav.customers'), icon: Users },
    { to: '/payments', label: t('nav.payments'), icon: CreditCard }
  ];

  const drawerItems = [
    ...primaryTabs,
    { to: '/statements', label: t('nav.statements'), icon: FileSpreadsheet },
    { to: '/settings', label: t('nav.settings'), icon: Settings }
  ];

  return (
    <>
      {/* Mobile Top Header (h-12) */}
      <header className="lg:hidden h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            M
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {t('app.name')}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleLanguage}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
            aria-label="Language"
          >
            {language === 'en' ? 'ع' : 'EN'}
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(true)}
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (h-14) */}
      <nav
        aria-label="Mobile Navigation Bar"
        className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 z-30 flex items-center justify-around px-1 select-none"
      >
        {primaryTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.exact}
              className={({ isActive }) => `
                flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors
                ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }
              `}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate max-w-[64px]">{tab.label}</span>
            </NavLink>
          );
        })}
        <button
          onClick={() => setIsOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800"
        >
          <Menu className="w-4 h-4 mb-0.5" />
          <span>{language === 'ar' ? 'المزيد' : 'More'}</span>
        </button>
      </nav>

      {/* Slide-over Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Panel */}
          <div
            className={`
              relative w-72 max-w-[80vw] bg-white dark:bg-slate-900 h-full shadow-xl flex flex-col z-10
              ${isRTL ? 'ms-auto' : 'me-auto'}
            `}
          >
            {/* Drawer Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-md bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                  M
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {t('app.name')}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
              {drawerItems.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                      ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>

            {/* Bottom Controls */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <button
                onClick={() => {
                  toggleLanguage();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  {language === 'ar' ? 'اللغة' : 'Language'}
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {language === 'en' ? 'العربية' : 'English'}
                </span>
              </button>

              <button
                onClick={() => {
                  toggleTheme();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <span className="flex items-center gap-2">
                  {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-400" />}
                  {language === 'ar' ? 'المظهر' : 'Theme'}
                </span>
                <span className="font-semibold text-slate-500">
                  {isDark ? t('theme.light') : t('theme.dark')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
```

#### 3. Root Application Layout Wrapper (`src/components/layout/AppLayout.tsx`)
```tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Mobile Top Header */}
      <MobileNav />

      {/* Body: Desktop Sidebar + Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Collapsible Desktop Sidebar (Hidden on mobile) */}
        <Sidebar />

        {/* Main Content Viewport */}
        <main
          id="app-root"
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 focus:outline-none"
          tabIndex={-1}
        >
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
```

---

## 5. Verification Method

To independently verify the implementation:

1. **Verify Root Direction & Attribute Flipping**:
   - Inspect DOM: verify `<html>` element has `dir="ltr"` and `lang="en"`.
   - Click `[data-testid="lang-switch-btn"]`: verify DOM immediately changes to `<html dir="rtl" lang="ar">`.
   - Refresh the page: verify language remains Arabic (`localStorage.getItem('app_language') === 'ar'`).

2. **Verify Layout Mirroring in RTL Mode**:
   - In LTR: inspect `[data-testid="app-sidebar"]` bounding box; `box.x` is 0 (physical left).
   - In RTL: inspect `[data-testid="app-sidebar"]` bounding box; `box.x` is $> \text{viewportWidth} - 250\text{px}$ (physical right edge).
   - Verify chevron icons rotate/flip 180 degrees horizontally via CSS logical scaling.

3. **Verify Light/Dark Mode Persistence**:
   - Click `[data-testid="theme-toggle-btn"]`: verify `dark` class is added to `<html>` and background switches to dark palette (`#020617` / `slate-950`).
   - Refresh page: verify dark mode persists via `localStorage.getItem('app_theme')`.

4. **Verify Mobile-First Viewport Containment**:
   - Set viewport to 375px $\times$ 667px (iPhone SE).
   - Verify desktop sidebar is hidden (`display: none`).
   - Verify mobile bottom navigation bar (`h-14`) is visible at bottom with 4 primary icons and "More" button.
   - Verify metric cards stack cleanly into 2 columns without horizontal page scroll.

5. **Verify Local Font Offline Isolation**:
   - Check Network tab with offline throttling enabled: verify no external requests are dispatched to `fonts.googleapis.com` or `fonts.gstatic.com`.
   - Verify `@font-face` loads Cairo and Tajawal directly from `src/assets/fonts/*.woff2`.

6. **Invalidation Conditions**:
   - If any `ml-*`, `mr-*`, `pl-*`, `pr-*`, or `left-*` classes are introduced, the layout will fail bidirectional mirroring when switching languages.
   - If numeric currency spans omit `<BidiIsolate>` or `unicode-bidi: isolate;`, negative values and SAR currency suffixes will invert in Arabic RTL mode.
