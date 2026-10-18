import React, { useEffect, useState, useCallback } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { AppLogo } from '@/components/common/AppLogo';

export interface TitleBarProps {
  /** Optional window title */
  title?: string;
  /** Optional subtitle or breadcrumb */
  subtitle?: string;
  /** Children element slot in center/trailing area (e.g. SyncBadge, LangToggle) */
  children?: React.ReactNode;
  /** Whether to show window control buttons (default: true) */
  showControls?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title = 'Meezan',
  subtitle,
  children,
  showControls = true
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    // Detect whether running in Electron desktop shell
    const hasElectron = typeof window !== 'undefined' && !!window.electronAPI;
    setIsElectron(hasElectron);

    if (!hasElectron || !window.electronAPI) return;

    // Fetch dynamic app version
    window.electronAPI.getAppVersion?.().then(v => {
      if (v) setAppVersion(v);
    }).catch(() => {});

    // Check initial window state
    window.electronAPI.isMaximized().then(setIsMaximized).catch(() => {});

    // Listen for window state changes (maximize/restore)
    const unsubscribe = window.electronAPI.onWindowStateChanged?.((state) => {
      setIsMaximized(state.isMaximized);
    });

    const handleResize = () => {
      window.electronAPI?.isMaximized().then(setIsMaximized).catch(() => {});
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleMinimize = useCallback(() => {
    window.electronAPI?.minimizeWindow().catch(console.error);
  }, []);

  const handleMaximizeToggle = useCallback(() => {
    window.electronAPI?.maximizeWindow().catch(console.error);
  }, []);

  const handleClose = useCallback(() => {
    window.electronAPI?.closeWindow().catch(console.error);
  }, []);

  return (
    <header
      data-testid="app-titlebar"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleMaximizeToggle}
      className="drag-region h-9 w-full select-none flex items-center justify-between border-b bg-slate-900 border-slate-800 text-slate-200 dark:bg-slate-950 dark:border-slate-800 transition-colors duration-150 shrink-0 z-50 text-xs"
    >
      {/* Start Area: Brand, App Icon, Title & Subtitle */}
      <div className="flex items-center gap-2 ps-3 min-w-0 pointer-events-auto">
        <div
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="no-drag flex items-center gap-2"
        >
          <div className="w-5 h-5 rounded overflow-hidden flex items-center justify-center shrink-0 border border-emerald-500/40 shadow-sm">
            <AppLogo className="w-full h-full" />
          </div>
          <span className="font-semibold tracking-tight text-slate-100 truncate">
            {title}
          </span>
          {appVersion && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700/50">
            v{appVersion}
          </span>}
          {subtitle && (
            <>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400 font-normal truncate max-w-[200px]">
                {subtitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Middle/Trailing Area: Slot for SaaS sync indicator, language/theme toggles */}
      <div className="flex items-center gap-2 pe-1 min-w-0">
        {children && (
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex items-center gap-2"
          >
            {children}
          </div>
        )}

        {/* Windows-style Frameless Caption Controls (Minimize, Maximize, Close) */}
        {showControls && isElectron && (
          <div
            dir="ltr"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex items-center h-9 ms-1"
          >
            {/* Minimize Button */}
            <button
              type="button"
              data-testid="window-control-minimize"
              title="Minimize"
              onClick={handleMinimize}
              className="h-9 w-10 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:bg-slate-700 transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {/* Maximize / Restore Button */}
            <button
              type="button"
              data-testid="window-control-maximize"
              title={isMaximized ? 'Restore' : 'Maximize'}
              onClick={handleMaximizeToggle}
              className="h-9 w-10 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:bg-slate-700 transition-colors"
            >
              {isMaximized ? (
                <Copy className="w-3 h-3 rotate-180" />
              ) : (
                <Square className="w-3 h-3" />
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              data-testid="window-control-close"
              title="Close"
              onClick={handleClose}
              className="h-9 w-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 active:bg-red-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
