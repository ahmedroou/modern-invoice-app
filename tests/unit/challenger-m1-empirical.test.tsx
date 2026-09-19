import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DirectionProvider, useDirection } from '@/context/DirectionContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { MobileNav } from '@/components/layout/MobileNav';
import { App } from '@/App';
import { DollarSign } from 'lucide-react';

// Consumer component for DirectionContext stress testing
const DirectionStressConsumer: React.FC = () => {
  const {
    direction,
    language,
    isRTL,
    setLanguage,
    toggleLanguage,
    t,
    formatCurrency,
    formatNumber
  } = useDirection();

  return (
    <div>
      <span data-testid="dir">{direction}</span>
      <span data-testid="lang">{language}</span>
      <span data-testid="is-rtl">{isRTL ? 'true' : 'false'}</span>
      <span data-testid="currency-pos-sar">{formatCurrency(45280.75, 'SAR')}</span>
      <span data-testid="currency-neg-sar">{formatCurrency(-1250.5, 'SAR')}</span>
      <span data-testid="currency-zero-sar">{formatCurrency(0, 'SAR')}</span>
      <span data-testid="currency-usd">{formatCurrency(100, 'USD')}</span>
      <span data-testid="number-large">{formatNumber(1000000)}</span>
      <span data-testid="dict-invoice">{t('nav.invoices')}</span>
      <span data-testid="dict-unknown">{t('nonexistent.key', 'Fallback')}</span>
      <button data-testid="btn-toggle" onClick={toggleLanguage}>Toggle</button>
      <button data-testid="btn-ar" onClick={() => setLanguage('ar')}>AR</button>
      <button data-testid="btn-en" onClick={() => setLanguage('en')}>EN</button>
    </div>
  );
};

// Consumer component for ThemeContext stress testing
const ThemeStressConsumer: React.FC = () => {
  const { theme, resolvedTheme, isDark, setTheme, toggleTheme } = useTheme();

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <span data-testid="is-dark">{isDark ? 'true' : 'false'}</span>
      <button data-testid="btn-set-dark" onClick={() => setTheme('dark')}>Dark</button>
      <button data-testid="btn-set-light" onClick={() => setTheme('light')}>Light</button>
      <button data-testid="btn-set-system" onClick={() => setTheme('system')}>System</button>
      <button data-testid="btn-toggle-theme" onClick={toggleTheme}>Toggle</button>
    </div>
  );
};

describe('Empirical Stress Testing — Milestone 1', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-direction');
    document.documentElement.style.colorScheme = '';
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    localStorage.clear();
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. RTL Direction Mirroring & Localization Resilience
  // =========================================================================
  describe('1. RTL Direction Mirroring & Edge Cases', () => {
    it('handles corrupted localStorage language values gracefully by falling back to "en"', () => {
      localStorage.setItem('app_language', 'invalid-lang-code');

      render(
        <DirectionProvider>
          <DirectionStressConsumer />
        </DirectionProvider>
      );

      // Must fallback to 'en' / 'ltr' without throwing
      expect(screen.getByTestId('lang')).toHaveTextContent('en');
      expect(screen.getByTestId('dir')).toHaveTextContent('ltr');
      expect(screen.getByTestId('is-rtl')).toHaveTextContent('false');
      expect(document.documentElement.dir).toBe('ltr');
      expect(document.documentElement.lang).toBe('en');
    });

    it('handles empty string or null localStorage gracefully', () => {
      localStorage.setItem('app_language', '');

      render(
        <DirectionProvider>
          <DirectionStressConsumer />
        </DirectionProvider>
      );

      expect(screen.getByTestId('lang')).toHaveTextContent('en');
      expect(screen.getByTestId('dir')).toHaveTextContent('ltr');
    });

    it('empirically flips document attributes on switching to Arabic', () => {
      render(
        <DirectionProvider>
          <DirectionStressConsumer />
        </DirectionProvider>
      );

      fireEvent.click(screen.getByTestId('btn-ar'));

      expect(screen.getByTestId('lang')).toHaveTextContent('ar');
      expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
      expect(screen.getByTestId('is-rtl')).toHaveTextContent('true');
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.lang).toBe('ar');
      expect(document.documentElement.getAttribute('data-direction')).toBe('rtl');
      expect(localStorage.getItem('app_language')).toBe('ar');
    });

    it('correctly isolates numbers and negative currencies in Arabic RTL without arithmetic inversion', () => {
      render(
        <DirectionProvider>
          <DirectionStressConsumer />
        </DirectionProvider>
      );

      // In English
      expect(screen.getByTestId('currency-pos-sar')).toHaveTextContent('SAR 45,280.75');
      expect(screen.getByTestId('currency-neg-sar')).toHaveTextContent('-SAR 1,250.50');
      expect(screen.getByTestId('currency-zero-sar')).toHaveTextContent('SAR 0.00');

      // Switch to Arabic
      fireEvent.click(screen.getByTestId('btn-ar'));

      // In Arabic: currency symbol "ر.س" is placed after the number
      expect(screen.getByTestId('currency-pos-sar')).toHaveTextContent('45,280.75 ر.س');
      expect(screen.getByTestId('currency-neg-sar')).toHaveTextContent('-1,250.50 ر.س');
      expect(screen.getByTestId('currency-zero-sar')).toHaveTextContent('0.00 ر.س');
    });

    it('persists language selection across page reloads', () => {
      // First session: user sets Arabic
      const { unmount } = render(
        <DirectionProvider>
          <DirectionStressConsumer />
        </DirectionProvider>
      );

      fireEvent.click(screen.getByTestId('btn-ar'));
      expect(localStorage.getItem('app_language')).toBe('ar');
      unmount();

      // Second session (simulate reload): mount fresh DirectionProvider
      render(
        <DirectionProvider>
          <DirectionStressConsumer />
        </DirectionProvider>
      );

      expect(screen.getByTestId('lang')).toHaveTextContent('ar');
      expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.lang).toBe('ar');
    });
  });

  // =========================================================================
  // 2. Theming Engine & Media Query Handling
  // =========================================================================
  describe('2. Theming Engine & Media Query Handling', () => {
    it('handles corrupted localStorage theme values gracefully by falling back to "system"', () => {
      localStorage.setItem('app_theme', 'corrupt_theme_value');

      render(
        <ThemeProvider>
          <ThemeStressConsumer />
        </ThemeProvider>
      );

      // Must safely fallback to 'system'
      expect(screen.getByTestId('theme')).toHaveTextContent('system');
    });

    it('synchronizes document attributes and colorScheme in dark mode', () => {
      render(
        <ThemeProvider>
          <ThemeStressConsumer />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('btn-set-dark'));

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
      expect(screen.getByTestId('is-dark')).toHaveTextContent('true');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.style.colorScheme).toBe('dark');
      expect(localStorage.getItem('app_theme')).toBe('dark');
    });

    it('synchronizes document attributes and colorScheme in light mode', () => {
      render(
        <ThemeProvider>
          <ThemeStressConsumer />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('btn-set-light'));

      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(screen.getByTestId('resolved')).toHaveTextContent('light');
      expect(screen.getByTestId('is-dark')).toHaveTextContent('false');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.style.colorScheme).toBe('light');
      expect(localStorage.getItem('app_theme')).toBe('light');
    });

    it('reacts dynamically to OS media query changes when theme is "system"', () => {
      let mediaQueryCallback: ((e: any) => void) | null = null;
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false, // light by default
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn().mockImplementation((_, cb) => {
          mediaQueryCallback = cb;
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      render(
        <ThemeProvider>
          <ThemeStressConsumer />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('btn-set-system'));
      expect(screen.getByTestId('resolved')).toHaveTextContent('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Simulate OS switching to dark mode
      act(() => {
        if (mediaQueryCallback) {
          mediaQueryCallback({ matches: true } as MediaQueryListEvent);
        }
      });

      expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.style.colorScheme).toBe('dark');

      // Simulate OS switching back to light mode
      act(() => {
        if (mediaQueryCallback) {
          mediaQueryCallback({ matches: false } as MediaQueryListEvent);
        }
      });

      expect(screen.getByTestId('resolved')).toHaveTextContent('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('persists theme selection across reloads', () => {
      // First session: set dark
      const { unmount } = render(
        <ThemeProvider>
          <ThemeStressConsumer />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('btn-set-dark'));
      expect(localStorage.getItem('app_theme')).toBe('dark');
      unmount();

      // Second session: mount fresh ThemeProvider
      render(
        <ThemeProvider>
          <ThemeStressConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  // =========================================================================
  // 3. Typography & Compact Card Height Verification
  // =========================================================================
  describe('3. Typography & Compact Density Specifications', () => {
    it('renders CompactMetricCard strictly under 90px height specification', () => {
      const { container } = render(
        <CompactMetricCard
          title="Receivables"
          value="12,500 SAR"
          icon={DollarSign}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toBeInTheDocument();
      // Verify the Tailwind height utility class matches h-[82px] (< 90px specification)
      expect(card.className).toContain('h-[82px]');
    });

    it('enforces tabular-nums and unicode-isolate in BidiIsolate wrapper', () => {
      const { container } = render(
        <BidiIsolate>+966 50 123 4567</BidiIsolate>
      );

      const span = container.firstChild as HTMLElement;
      expect(span).toHaveAttribute('dir', 'ltr');
      expect(span.className).toContain('tabular-nums');
      expect(span.className).toContain('unicode-isolate');
    });
  });

  // =========================================================================
  // 4. Mobile Layout & Full Application Tree Smoke Test
  // =========================================================================
  describe('4. Full Application Tree & Mobile Layout Smoke Test', () => {
    it('renders full App hierarchy without crashing', () => {
      render(<App />);

      // Verify dashboard content is present
      expect(screen.getAllByText(/Meezan|Modern Invoice/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
      expect(screen.getByTestId('metrics-grid')).toBeInTheDocument();
    });

    it('verifies MobileNav drawer behavior and class attributes', () => {
      render(
        <ThemeProvider>
          <DirectionProvider>
            <MemoryRouter>
              <MobileNav />
            </MemoryRouter>
          </DirectionProvider>
        </ThemeProvider>
      );

      // Bottom nav is present
      const nav = screen.getByLabelText('Mobile Navigation Bar');
      expect(nav).toBeInTheDocument();

      // Open menu
      const openBtn = screen.getByLabelText('Open Menu');
      fireEvent.click(openBtn);

      // Verify drawer opens
      expect(screen.getByText('Statements')).toBeInTheDocument();
    });
  });
});
