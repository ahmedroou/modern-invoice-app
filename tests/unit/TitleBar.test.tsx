import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TitleBar } from '@/components/layout/TitleBar';

describe('TitleBar Component & Electron IPC Integration', () => {
  let mockElectronAPI: any;

  beforeEach(() => {
    mockElectronAPI = {
      minimizeWindow: vi.fn().mockResolvedValue(undefined),
      maximizeWindow: vi.fn().mockResolvedValue(undefined),
      closeWindow: vi.fn().mockResolvedValue(undefined),
      isMaximized: vi.fn().mockResolvedValue(false),
      onWindowStateChanged: vi.fn().mockImplementation((_callback) => {
        // Return unsubscribe function
        return () => {};
      }),
      printInvoicePDF: vi.fn(),
      exportFile: vi.fn(),
      getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
      getSystemTheme: vi.fn().mockResolvedValue('dark'),
      onThemeChanged: vi.fn().mockReturnValue(() => {})
    };

    window.electronAPI = mockElectronAPI;
  });

  it('renders titlebar with draggable region, brand logo, and title', async () => {
    render(<TitleBar title="Modern Invoice Desktop" subtitle="Overview" />);
    await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

    const titlebar = screen.getByTestId('app-titlebar');
    expect(titlebar).toBeInTheDocument();
    expect(titlebar).toHaveClass('drag-region');
    expect(screen.getByText('Modern Invoice Desktop')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('triggers minimizeWindow IPC when minimize button is clicked', async () => {
    render(<TitleBar />);
    await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

    const minBtn = screen.getByTestId('window-control-minimize');
    fireEvent.click(minBtn);

    expect(mockElectronAPI.minimizeWindow).toHaveBeenCalledTimes(1);
  });

  it('triggers maximizeWindow IPC when maximize button is clicked', async () => {
    render(<TitleBar />);
    await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

    const maxBtn = screen.getByTestId('window-control-maximize');
    fireEvent.click(maxBtn);

    expect(mockElectronAPI.maximizeWindow).toHaveBeenCalledTimes(1);
  });

  it('triggers closeWindow IPC when close button is clicked', async () => {
    render(<TitleBar />);
    await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

    const closeBtn = screen.getByTestId('window-control-close');
    fireEvent.click(closeBtn);

    expect(mockElectronAPI.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('toggles maximize/restore on double-clicking draggable titlebar', async () => {
    render(<TitleBar />);
    await waitFor(() => expect(mockElectronAPI.isMaximized).toHaveBeenCalled());

    const titlebar = screen.getByTestId('app-titlebar');
    fireEvent.doubleClick(titlebar);

    expect(mockElectronAPI.maximizeWindow).toHaveBeenCalledTimes(1);
  });

  it('subscribes to window state changes and updates maximize button title', async () => {
    let stateCallback: ((state: { isMaximized: boolean }) => void) | null = null;
    mockElectronAPI.onWindowStateChanged = vi.fn().mockImplementation((cb) => {
      stateCallback = cb;
      return () => {};
    });

    render(<TitleBar />);

    await waitFor(() => {
      expect(mockElectronAPI.isMaximized).toHaveBeenCalled();
    });

    const maxBtn = screen.getByTestId('window-control-maximize');
    expect(maxBtn).toHaveAttribute('title', 'Maximize');

    // Simulate maximize event from Electron main process
    act(() => {
      if (stateCallback) {
        stateCallback({ isMaximized: true });
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId('window-control-maximize')).toHaveAttribute('title', 'Restore');
    });
  });

  it('gracefully renders without window controls when window.electronAPI is undefined (Web Browser Fallback)', () => {
    // Delete electronAPI to simulate web browser
    delete (window as any).electronAPI;

    render(<TitleBar title="Web Mode Invoice" />);

    expect(screen.getByText('Web Mode Invoice')).toBeInTheDocument();
    expect(screen.queryByTestId('window-control-minimize')).not.toBeInTheDocument();
    expect(screen.queryByTestId('window-control-maximize')).not.toBeInTheDocument();
    expect(screen.queryByTestId('window-control-close')).not.toBeInTheDocument();
  });
});
