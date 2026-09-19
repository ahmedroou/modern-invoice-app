import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { TitleBar } from '@/components/layout/TitleBar';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { CompactCard } from '@/components/common/CompactCard';
import { MobileNav } from '@/components/layout/MobileNav';
import { DirectionProvider } from '@/context/DirectionContext';
import { ThemeProvider } from '@/context/ThemeContext';
import App from '@/App';

describe('Empirical Challenger M1-2: Electron Shell & Responsive Verification', () => {
  // -------------------------------------------------------------------------
  // 1. Electron Desktop Shell IPC Contracts
  // -------------------------------------------------------------------------
  describe('1. Electron IPC Interface Contracts & Preload Verification', () => {
    let mockIpcRenderer: any;

    beforeEach(() => {
      mockIpcRenderer = {
        invoke: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn()
      };
    });

    it('empirically verifies preload exposes all required IElectronAPI methods with correct signatures', async () => {
      const { registerPreloadHarness } = await import('./helpers/electronHarness');
      const electronAPI = registerPreloadHarness(mockIpcRenderer);

      // Verify all methods specified in PROJECT.md interface contract:
      expect(typeof electronAPI.minimizeWindow).toBe('function');
      expect(typeof electronAPI.maximizeWindow).toBe('function');
      expect(typeof electronAPI.closeWindow).toBe('function');
      expect(typeof electronAPI.isMaximized).toBe('function');
      expect(typeof electronAPI.printInvoicePDF).toBe('function');
      expect(typeof electronAPI.exportFile).toBe('function');
      expect(typeof electronAPI.getAppVersion).toBe('function');
      expect(typeof electronAPI.getSystemTheme).toBe('function');
      expect(typeof electronAPI.onThemeChanged).toBe('function');
      expect(typeof electronAPI.onWindowStateChanged).toBe('function');

      // Test minimizeWindow invokes 'window:minimize'
      mockIpcRenderer.invoke.mockResolvedValueOnce(undefined);
      await electronAPI.minimizeWindow();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('window:minimize');

      // Test maximizeWindow invokes 'window:maximize'
      mockIpcRenderer.invoke.mockResolvedValueOnce(undefined);
      await electronAPI.maximizeWindow();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('window:maximize');

      // Test closeWindow invokes 'window:close'
      mockIpcRenderer.invoke.mockResolvedValueOnce(undefined);
      await electronAPI.closeWindow();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('window:close');

      // Test isMaximized invokes 'window:isMaximized'
      mockIpcRenderer.invoke.mockResolvedValueOnce(true);
      const isMax = await electronAPI.isMaximized();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('window:isMaximized');
      expect(isMax).toBe(true);

      // Test getAppVersion invokes 'app:version'
      mockIpcRenderer.invoke.mockResolvedValueOnce('1.0.0');
      const version = await electronAPI.getAppVersion();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('app:version');
      expect(version).toBe('1.0.0');

      // Test getSystemTheme invokes 'app:theme'
      mockIpcRenderer.invoke.mockResolvedValueOnce('dark');
      const theme = await electronAPI.getSystemTheme();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('app:theme');
      expect(theme).toBe('dark');
    });

    it('empirically verifies printInvoicePDF rejects invalid or malformed arguments', async () => {
      const { registerPreloadHarness } = await import('./helpers/electronHarness');
      const electronAPI = registerPreloadHarness(mockIpcRenderer);

      // Null argument
      await expect(electronAPI.printInvoicePDF(null as any)).rejects.toThrow('Invalid print options');

      // Non-object argument
      await expect(electronAPI.printInvoicePDF('bad-param' as any)).rejects.toThrow('Invalid print options');

      // Valid call invokes 'invoice:print-pdf'
      mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true, filePath: 'C:/invoice.pdf' });
      const validOptions = { invoiceId: 'inv-101', invoiceNumber: 'INV-2026-001' };
      const res = await electronAPI.printInvoicePDF(validOptions);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('invoice:print-pdf', validOptions);
      expect(res.success).toBe(true);
      expect(res.filePath).toBe('C:/invoice.pdf');
    });

    it('empirically verifies exportFile rejects malformed arguments and handles csv/json formats', async () => {
      const { registerPreloadHarness } = await import('./helpers/electronHarness');
      const electronAPI = registerPreloadHarness(mockIpcRenderer);

      // Null or missing fields
      await expect(electronAPI.exportFile(null as any)).rejects.toThrow('Invalid export options');
      await expect(electronAPI.exportFile({ format: 'csv' } as any)).rejects.toThrow('Invalid export options');
      await expect(electronAPI.exportFile({ data: 'col1,col2' } as any)).rejects.toThrow('Invalid export options');

      // Valid CSV export
      mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true, filePath: 'C:/export.csv' });
      const csvOptions = { format: 'csv' as const, data: 'a,b\n1,2', suggestedFilename: 'customers.csv' };
      const res = await electronAPI.exportFile(csvOptions);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('file:export', csvOptions);
      expect(res.success).toBe(true);
    });

    it('empirically verifies onThemeChanged and onWindowStateChanged subscribe and cleanup listeners', async () => {
      const { registerPreloadHarness } = await import('./helpers/electronHarness');
      const electronAPI = registerPreloadHarness(mockIpcRenderer);

      // onThemeChanged
      const themeCb = vi.fn();
      const unsubTheme = electronAPI.onThemeChanged(themeCb);
      expect(mockIpcRenderer.on).toHaveBeenCalledWith('theme:changed', expect.any(Function));
      unsubTheme();
      expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('theme:changed', expect.any(Function));

      // onWindowStateChanged
      const stateCb = vi.fn();
      const unsubState = electronAPI.onWindowStateChanged!(stateCb);
      expect(mockIpcRenderer.on).toHaveBeenCalledWith('window:state-changed', expect.any(Function));
      unsubState();
      expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('window:state-changed', expect.any(Function));
    });

    it('empirically verifies IPC handler registration matching channels', async () => {
      const { registerIPCHandlersHarness } = await import('./helpers/electronHarness');
      const { handlers, mockWindow } = registerIPCHandlersHarness();

      // Ensure all 8 channels are registered
      expect(handlers['window:minimize']).toBeDefined();
      expect(handlers['window:maximize']).toBeDefined();
      expect(handlers['window:close']).toBeDefined();
      expect(handlers['window:isMaximized']).toBeDefined();
      expect(handlers['app:version']).toBeDefined();
      expect(handlers['app:theme']).toBeDefined();
      expect(handlers['invoice:print-pdf']).toBeDefined();
      expect(handlers['file:export']).toBeDefined();

      // Test window:minimize handler calls window.minimize
      handlers['window:minimize']();
      expect(mockWindow.minimize).toHaveBeenCalled();

      // Test window:maximize toggles maximize/unmaximize
      mockWindow.isMaximized.mockReturnValueOnce(false);
      handlers['window:maximize']();
      expect(mockWindow.maximize).toHaveBeenCalled();

      mockWindow.isMaximized.mockReturnValueOnce(true);
      handlers['window:maximize']();
      expect(mockWindow.unmaximize).toHaveBeenCalled();

      // Test window:close handler calls window.close
      handlers['window:close']();
      expect(mockWindow.close).toHaveBeenCalled();

      // Test window:isMaximized handler queries window.isMaximized
      mockWindow.isMaximized.mockReturnValueOnce(true);
      expect(handlers['window:isMaximized']()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Responsiveness & Compact Card Limits (<90px height)
  // -------------------------------------------------------------------------
  describe('2. Responsiveness & Compact Metric Card Height Specification', () => {
    it('empirically verifies CompactMetricCard height is strictly <90px (exact h-[82px])', () => {
      const { container } = render(
        <CompactMetricCard
          title="Revenue"
          value="$12,000"
          subtitle="Monthly target"
          icon={TrendingUp}
          variant="brand"
          trend={{ value: '+8%', isPositive: true }}
        />
      );

      const card = container.firstElementChild as HTMLElement;
      expect(card).toBeInTheDocument();

      // Verify strict height class
      expect(card.className).toContain('h-[82px]');

      // Extract explicit pixel height from Tailwind arbitrary class h-[82px]
      const match = card.className.match(/h-\[(\d+)px\]/);
      expect(match).not.toBeNull();
      const heightInPx = parseInt(match![1], 10);
      expect(heightInPx).toBe(82);
      expect(heightInPx).toBeLessThan(90);
    });

    it('empirically verifies card structure does not break or expand with minimal or extreme props', () => {
      // 1. Without subtitle and trend
      const { container: minimalContainer } = render(
        <CompactMetricCard
          title="Simple Metric"
          value="42"
          icon={DollarSign}
        />
      );
      const minCard = minimalContainer.firstElementChild as HTMLElement;
      expect(minCard.className).toContain('h-[82px]');

      // 2. With adversarial long string values
      const longTitle = 'Extremely Long Metric Title Designed To Test Truncation And Overflow Prevention';
      const longValue = 'USD 999,999,999,999.9999999';
      const longSubtitle = 'A Very Long Detailed Description of the Metric That Should Never Push The Card Height Over 90px';

      const { container: stressContainer } = render(
        <CompactMetricCard
          title={longTitle}
          value={longValue}
          subtitle={longSubtitle}
          icon={AlertCircle}
          variant="rose"
          trend={{ value: '-99.9%', isPositive: false }}
        />
      );

      const stressCard = stressContainer.firstElementChild as HTMLElement;
      expect(stressCard.className).toContain('h-[82px]');

      // Check truncation classes on all text containers
      const titleEl = screen.getByText(longTitle);
      expect(titleEl.className).toContain('truncate');

      const subtitleEl = screen.getByText(longSubtitle);
      expect(subtitleEl.className).toContain('truncate');
    });

    it('empirically verifies CompactCard has overflow protection and compact padding', () => {
      const { container } = render(
        <CompactCard>
          <div>Compact child content</div>
        </CompactCard>
      );

      const card = container.firstElementChild as HTMLElement;
      expect(card.className).toContain('overflow-hidden');
      expect(card.className).toContain('p-2.5');
      expect(card.className).toContain('sm:p-3');
      expect(card.className).toContain('rounded-lg');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Frameless Drag Regions & Caption Controls
  // -------------------------------------------------------------------------
  describe('3. TitleBar Frameless Drag Regions & Caption Controls', () => {
    let mockElectronAPI: any;

    beforeEach(() => {
      mockElectronAPI = {
        minimizeWindow: vi.fn().mockResolvedValue(undefined),
        maximizeWindow: vi.fn().mockResolvedValue(undefined),
        closeWindow: vi.fn().mockResolvedValue(undefined),
        isMaximized: vi.fn().mockResolvedValue(false),
        onWindowStateChanged: vi.fn().mockReturnValue(() => {})
      };
      window.electronAPI = mockElectronAPI;
    });

    it('empirically verifies -webkit-app-region: drag on header and no-drag on caption controls', async () => {
      render(
        <TitleBar title="Desktop App" subtitle="Dashboard">
          <div data-testid="custom-slot">Slot Item</div>
        </TitleBar>
      );

      await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

      // 1. Verify header has drag region
      const header = screen.getByTestId('app-titlebar');
      expect(header).toBeInTheDocument();
      expect((header.style as any).WebkitAppRegion).toBe('drag');
      expect(header.className).toContain('drag-region');

      // 2. Verify branding/title container has no-drag so text can be selected or clicked
      const brandContainer = header.querySelector('.no-drag') as HTMLElement | null;
      expect(brandContainer).not.toBeNull();
      expect((brandContainer!.style as any).WebkitAppRegion).toBe('no-drag');

      // 3. Verify middle slot has no-drag
      const slotItem = screen.getByTestId('custom-slot');
      const slotContainer = slotItem.parentElement as HTMLElement | null;
      expect((slotContainer!.style as any).WebkitAppRegion).toBe('no-drag');

      // 4. Verify caption buttons container has no-drag and LTR direction
      const minBtn = screen.getByTestId('window-control-minimize');
      const maxBtn = screen.getByTestId('window-control-maximize');
      const closeBtn = screen.getByTestId('window-control-close');

      const captionContainer = minBtn.parentElement as HTMLElement | null;
      expect(captionContainer).not.toBeNull();
      expect((captionContainer!.style as any).WebkitAppRegion).toBe('no-drag');
      expect(captionContainer?.getAttribute('dir')).toBe('ltr'); // Must stay LTR in Arabic mode

      // 5. Verify caption button click handlers trigger IPC
      fireEvent.click(minBtn);
      expect(mockElectronAPI.minimizeWindow).toHaveBeenCalledTimes(1);

      fireEvent.click(maxBtn);
      expect(mockElectronAPI.maximizeWindow).toHaveBeenCalledTimes(1);

      fireEvent.click(closeBtn);
      expect(mockElectronAPI.closeWindow).toHaveBeenCalledTimes(1);
    });

    it('empirically verifies TitleBar behaves gracefully in standard web browser (electronAPI undefined)', () => {
      delete (window as any).electronAPI;

      render(<TitleBar title="Web Mode App" />);

      // Title should render
      expect(screen.getByText('Web Mode App')).toBeInTheDocument();

      // Electron window controls should NOT render
      expect(screen.queryByTestId('window-control-minimize')).not.toBeInTheDocument();
      expect(screen.queryByTestId('window-control-maximize')).not.toBeInTheDocument();
      expect(screen.queryByTestId('window-control-close')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Mobile Viewport (375px) & Mobile Navigation Interactivity
  // -------------------------------------------------------------------------
  describe('4. Mobile Viewport (375px) & MobileNav Functional Verification', () => {
    it('empirically renders MobileNav with mobile header and fixed bottom navigation bar', () => {
      render(
        <ThemeProvider>
          <DirectionProvider>
            <MemoryRouter initialEntries={['/']}>
              <MobileNav />
            </MemoryRouter>
          </DirectionProvider>
        </ThemeProvider>
      );

      // Verify mobile header is present with lg:hidden
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
      expect(header.className).toContain('lg:hidden');
      expect(header.className).toContain('h-12');

      // Verify mobile bottom nav is present with lg:hidden and fixed bottom-0
      const nav = screen.getByRole('navigation', { name: /Mobile Navigation Bar/i });
      expect(nav).toBeInTheDocument();
      expect(nav.className).toContain('lg:hidden');
      expect(nav.className).toContain('fixed');
      expect(nav.className).toContain('bottom-0');
      expect(nav.className).toContain('h-14');

      // Verify primary navigation links in bottom bar
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Invoices')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Payments')).toBeInTheDocument();
      expect(screen.getByText('More')).toBeInTheDocument();
    });

    it('empirically verifies opening slide-over drawer, language toggle, and theme toggle on mobile', async () => {
      render(
        <ThemeProvider>
          <DirectionProvider>
            <MemoryRouter initialEntries={['/']}>
              <MobileNav />
            </MemoryRouter>
          </DirectionProvider>
        </ThemeProvider>
      );

      // Open mobile drawer via More button
      const moreButton = screen.getByRole('button', { name: /More/i });
      fireEvent.click(moreButton);

      // Drawer should now be visible with Statements and Settings
      expect(screen.getByText('Statements')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();

      // Test Language toggle inside drawer
      const langBtn = screen.getByText('العربية');
      expect(langBtn).toBeInTheDocument();
      fireEvent.click(langBtn);

      // Direction should flip to RTL and language to ar
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.lang).toBe('ar');

      // Re-open drawer (it closes on action)
      const moreButtonAr = screen.getByRole('button', { name: /المزيد/i });
      fireEvent.click(moreButtonAr);

      // Test Theme toggle inside drawer
      // Theme starts at 'system' (resolved light). First toggle -> 'light'. Second toggle -> 'dark'.
      const themeBtn = screen.getByText(/المظهر/i);
      expect(themeBtn).toBeInTheDocument();

      // Toggle 1: system -> light
      fireEvent.click(themeBtn);
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Re-open drawer
      fireEvent.click(screen.getByRole('button', { name: /المزيد/i }));
      // Toggle 2: light -> dark
      fireEvent.click(screen.getByText(/المظهر/i));
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Reset back to LTR and light
      act(() => {
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
        document.documentElement.classList.remove('dark');
        localStorage.clear();
      });
    });

    it('empirically verifies AppLayout containment and 375px mobile viewport layout without overflow blowouts', () => {
      const { container } = render(<App />);

      // App root container must prevent horizontal overflow
      const rootEl = container.firstElementChild as HTMLElement;
      expect(rootEl.className).toContain('overflow-hidden');

      // Main scrollable container must clip horizontal overflow
      const mainEl = container.querySelector('main#app-root') as HTMLElement;
      expect(mainEl).toBeInTheDocument();
      expect(mainEl.className).toContain('overflow-x-hidden');
      expect(mainEl.className).toContain('pb-20'); // Bottom padding to prevent bottom nav collision

      // Check all metric cards inside App render under 90px
      const cards = container.querySelectorAll('.h-\\[82px\\]');
      expect(cards.length).toBeGreaterThanOrEqual(4);
    });
  });
});
