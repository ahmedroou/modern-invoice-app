import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TitleBar } from '@/components/layout/TitleBar';

describe('Empirical Challenger: TitleBar & Desktop Shell Stress Testing', () => {
  let mockElectronAPI: any;
  let originalElectronAPI: any;

  beforeEach(() => {
    originalElectronAPI = window.electronAPI;
    mockElectronAPI = {
      minimizeWindow: vi.fn().mockResolvedValue(undefined),
      maximizeWindow: vi.fn().mockResolvedValue(undefined),
      closeWindow: vi.fn().mockResolvedValue(undefined),
      isMaximized: vi.fn().mockResolvedValue(false),
      onWindowStateChanged: vi.fn().mockImplementation((_cb: (state: { isMaximized: boolean }) => void) => {
        return () => {};
      }),
      printInvoicePDF: vi.fn().mockResolvedValue({ success: true }),
      exportFile: vi.fn().mockResolvedValue({ success: true }),
      getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
      getSystemTheme: vi.fn().mockResolvedValue('dark'),
      onThemeChanged: vi.fn().mockReturnValue(() => {})
    };
    window.electronAPI = mockElectronAPI;
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  describe('1. Electron Shell vs Web Fallback (isElectron detection)', () => {
    it('renders caption controls when window.electronAPI is defined (isElectron = true)', async () => {
      render(<TitleBar title="Desktop Mode" />);
      await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

      expect(screen.getByTestId('window-control-minimize')).toBeInTheDocument();
      expect(screen.getByTestId('window-control-maximize')).toBeInTheDocument();
      expect(screen.getByTestId('window-control-close')).toBeInTheDocument();
    });

    it('does NOT render caption controls when window.electronAPI is undefined (Web mode)', () => {
      delete (window as any).electronAPI;
      render(<TitleBar title="Web Mode" />);

      expect(screen.queryByTestId('window-control-minimize')).not.toBeInTheDocument();
      expect(screen.queryByTestId('window-control-maximize')).not.toBeInTheDocument();
      expect(screen.queryByTestId('window-control-close')).not.toBeInTheDocument();
    });

    it('does NOT render caption controls when showControls=false even if isElectron=true', async () => {
      render(<TitleBar title="Desktop Mode Hidden Controls" showControls={false} />);
      await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

      expect(screen.queryByTestId('window-control-minimize')).not.toBeInTheDocument();
      expect(screen.queryByTestId('window-control-maximize')).not.toBeInTheDocument();
      expect(screen.queryByTestId('window-control-close')).not.toBeInTheDocument();
    });
  });

  describe('2. Drag & No-Drag Region Architecture', () => {
    it('applies WebkitAppRegion: drag to root header and WebkitAppRegion: no-drag to interactive descendants', async () => {
      render(
        <TitleBar title="Drag Test" subtitle="Verification">
          <button data-testid="inner-action-btn">Action</button>
        </TitleBar>
      );
      await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

      const header = screen.getByTestId('app-titlebar');
      expect((header.style as any).WebkitAppRegion).toBe('drag');
      expect(header).toHaveClass('drag-region');

      // Brand/Title area must be no-drag
      const brandContainer = header.querySelector('.no-drag') as HTMLElement;
      expect(brandContainer).not.toBeNull();
      expect((brandContainer.style as any).WebkitAppRegion).toBe('no-drag');

      // Slot/children area must be no-drag
      const actionBtn = screen.getByTestId('inner-action-btn');
      const actionWrapper = actionBtn.parentElement as HTMLElement;
      expect((actionWrapper.style as any).WebkitAppRegion).toBe('no-drag');

      // Caption controls container must be no-drag and strictly LTR
      const minBtn = screen.getByTestId('window-control-minimize');
      const captionContainer = minBtn.parentElement as HTMLElement;
      expect((captionContainer.style as any).WebkitAppRegion).toBe('no-drag');
      expect(captionContainer.getAttribute('dir')).toBe('ltr');
    });
  });

  describe('3. Window Controls IPC & State Transitions', () => {
    it('dispatches minimize, maximize, and close IPC invocations on click', async () => {
      render(<TitleBar />);
      await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

      fireEvent.click(screen.getByTestId('window-control-minimize'));
      expect(mockElectronAPI.minimizeWindow).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('window-control-maximize'));
      expect(mockElectronAPI.maximizeWindow).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('window-control-close'));
      expect(mockElectronAPI.closeWindow).toHaveBeenCalledTimes(1);
    });

    it('toggles maximize on header double-click', async () => {
      render(<TitleBar />);
      await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

      fireEvent.doubleClick(screen.getByTestId('app-titlebar'));
      expect(mockElectronAPI.maximizeWindow).toHaveBeenCalledTimes(1);
    });

    it('reacts dynamically to window state change events (maximize/restore tooltip update)', async () => {
      let stateListener: ((state: { isMaximized: boolean }) => void) | null = null;
      mockElectronAPI.onWindowStateChanged = vi.fn().mockImplementation((cb) => {
        stateListener = cb;
        return () => {};
      });

      render(<TitleBar />);
      await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

      const maxBtn = screen.getByTestId('window-control-maximize');
      expect(maxBtn).toHaveAttribute('title', 'Maximize');

      // Simulate window:state-changed event with isMaximized = true
      act(() => {
        stateListener?.({ isMaximized: true });
      });

      await waitFor(() => {
        expect(screen.getByTestId('window-control-maximize')).toHaveAttribute('title', 'Restore');
      });

      // Simulate window:state-changed event with isMaximized = false
      act(() => {
        stateListener?.({ isMaximized: false });
      });

      await waitFor(() => {
        expect(screen.getByTestId('window-control-maximize')).toHaveAttribute('title', 'Maximize');
      });
    });

    it('re-queries isMaximized on window resize events', async () => {
      render(<TitleBar />);
      await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalledTimes(1));

      // Trigger window resize event
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(mockElectronAPI.isMaximized).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('4. Adversarial Edge Cases & Fault Tolerance', () => {
    it('survives IPC promise rejections without crashing the component', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockElectronAPI.minimizeWindow.mockRejectedValueOnce(new Error('IPC minimize timeout'));
      mockElectronAPI.maximizeWindow.mockRejectedValueOnce(new Error('IPC maximize failed'));
      mockElectronAPI.closeWindow.mockRejectedValueOnce(new Error('IPC close denied'));
      mockElectronAPI.isMaximized.mockRejectedValueOnce(new Error('IPC isMaximized error'));

      render(<TitleBar />);
      await act(async () => {
        // Allow initial rejected isMaximized promise to settle
        await new Promise((r) => setTimeout(r, 10));
      });

      // Clicking controls with rejecting IPC must not throw unhandled exceptions
      fireEvent.click(screen.getByTestId('window-control-minimize'));
      fireEvent.click(screen.getByTestId('window-control-maximize'));
      fireEvent.click(screen.getByTestId('window-control-close'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('safely handles missing optional onWindowStateChanged in electronAPI', async () => {
      delete mockElectronAPI.onWindowStateChanged;
      const { unmount } = render(<TitleBar />);
      await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

      // Should mount without error and unmount cleanly
      expect(() => unmount()).not.toThrow();
    });

    it('cleans up event listeners and unsubscribe hooks upon unmount', async () => {
      const unsubscribeMock = vi.fn();
      mockElectronAPI.onWindowStateChanged = vi.fn().mockReturnValue(unsubscribeMock);
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(<TitleBar />);
      await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

      unmount();

      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});
