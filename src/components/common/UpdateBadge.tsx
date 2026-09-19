/**
 * ============================================================================
 * MODULE: In-App Cloud Auto-Updater (<UpdateBadge />)
 * ============================================================================
 * 
 * 💡 PURPOSE & CONTEXT (لأي وكيل أو مبرمج مستقبلي):
 * The user explicitly requested an internal, non-store update mechanism:
 * - Since the app is not published on Microsoft Store or App Stores, updates
 *   are hosted in the cloud (e.g., GitHub Releases, S3, or Firebase Storage).
 * - This component renders an elegant, animated badge in the top TitleBar / MobileNav
 *   whenever a new release is detected.
 * - The entire update lifecycle is executed INSIDE the application:
 *     1. IDLE: Hidden when up-to-date (maintains clean, minimal SaaS aesthetic).
 *     2. CHECKING: Rotating refresh icon when checking for releases.
 *     3. AVAILABLE: Soft blue badge with version number + prominent "تحميل / Download" button.
 *     4. DOWNLOADING: Live progress bar showing percentage & transferred bytes.
 *     5. DOWNLOADED: Emerald green badge with "تثبيت الآن / Install Now" button.
 *        Clicking restarts the app and applies the new update in-place seamlessly.
 *     6. ERROR: Soft red badge with a "إعادة المحاولة / Retry" button.
 * 
 * 🔗 BACKEND INTEGRATION:
 * - Backed by electron-updater in `electron/main.ts` (`setupAutoUpdater`).
 * - Bridges to React via IPC channels exposed in `electron/preload.ts`:
 *     - window.electronAPI.checkForUpdates()
 *     - window.electronAPI.downloadUpdate()
 *     - window.electronAPI.installUpdate()
 *     - window.electronAPI.onUpdateState(cb)
 *     - window.electronAPI.onUpdateProgress(cb)
 * - Cloud provider configured in `package.json` -> "build.publish".
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, CheckCircle2, ArrowUpCircle, X } from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
}

// ─── Hook: useAppUpdater ───────────────────────────────────────────────────────

function useAppUpdater() {
  const [state, setState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const checkForUpdates = useCallback(() => {
    setState('checking');
    setErrorMessage(null);
    const api = (window as any).electronAPI;
    api?.checkForUpdates?.()?.catch((err: any) => {
      setState('error');
      setErrorMessage(err?.message || 'Update check failed');
    });
  }, []);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    // 1. Immediately query the current update state from the Electron main process
    api.getUpdateState?.().then((res: any) => {
      if (res?.state && res.state !== 'idle') {
        setState(res.state as UpdateState);
        if (res.info) setUpdateInfo(res.info);
        if (res.error) setErrorMessage(res.error);
        if (res.state === 'available') setIsDismissed(false);
      } else {
        // Automatic check upon mounting
        checkForUpdates();
      }
    }).catch(() => {
      checkForUpdates();
    });

    // 2. Subscribe to live update state events
    const unsubscribeState = api.onUpdateState?.((event: { state: UpdateState; info?: UpdateInfo; error?: string }) => {
      setState(event.state);
      if (event.info) setUpdateInfo(event.info);
      if (event.error) setErrorMessage(event.error);
      if (event.state === 'available') setIsDismissed(false);
      if (event.state === 'not-available') {
        setTimeout(() => {
          setState('idle');
        }, 5000);
      }
    });

    const unsubscribeProgress = api.onUpdateProgress?.((p: DownloadProgress) => {
      setProgress(p);
    });

    return () => {
      unsubscribeState?.();
      unsubscribeProgress?.();
    };
  }, [checkForUpdates]);

  const downloadUpdate = useCallback(() => {
    setState('downloading');
    setProgress({ percent: 0, transferred: 0, total: 0 });
    (window as any).electronAPI?.downloadUpdate?.();
  }, []);

  const installUpdate = useCallback(() => {
    (window as any).electronAPI?.installUpdate?.();
  }, []);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  return {
    state,
    updateInfo,
    progress,
    errorMessage,
    isDismissed,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismiss,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const UpdateBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language } = useDirection();
  const {
    state,
    updateInfo,
    progress,
    errorMessage,
    isDismissed,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismiss,
  } = useAppUpdater();

  const isAr = language === 'ar';

  // ── Render subtle check trigger if idle or dismissed ──
  if (state === 'idle' || (isDismissed && state !== 'downloaded')) {
    return (
      <button
        onClick={checkForUpdates}
        title={isAr ? 'فحص التحديثات السحابية الآن' : 'Check for cloud updates now'}
        className={`
          inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
          text-[11px] font-medium text-slate-400 hover:text-slate-200
          hover:bg-slate-800/80 border border-slate-700/40 hover:border-slate-600/70
          transition-all duration-150 select-none cursor-pointer
          ${className}
        `}
      >
        <RefreshCw className="w-3 h-3 shrink-0 text-slate-400" />
        <span className="text-[10px]">{isAr ? 'فحص التحديثات' : 'Check updates'}</span>
      </button>
    );
  }

  // ── Labels ──
  const labels = {
    idle: '',
    checking: isAr ? 'جارٍ فحص التحديثات...' : 'Checking for updates...',
    available: isAr ? `تحديث ${updateInfo?.version || 'جديد'} متاح` : `Update ${updateInfo?.version || 'new'} available`,
    'not-available': isAr ? 'النسخة محدثة ✓' : 'App is up to date ✓',
    downloading: isAr
      ? `جارٍ التحميل ${Math.round(progress?.percent ?? 0)}%`
      : `Downloading ${Math.round(progress?.percent ?? 0)}%`,
    downloaded: isAr ? 'التحديث جاهز للتثبيت' : 'Update ready to install',
    error: isAr ? 'تعذّر فحص التحديثات' : 'Update check failed',
  };

  const label = labels[state as keyof typeof labels] ?? '';

  // ── Colors per state ──
  const stateStyle: Record<UpdateState, string> = {
    idle: '',
    checking:
      'bg-slate-800/80 text-slate-300 border-slate-700',
    available:
      'bg-blue-950/80 text-blue-200 border-blue-700 animate-pulse-slow shadow-sm shadow-blue-500/20',
    'not-available':
      'bg-slate-800/70 text-slate-300 border-slate-700/60',
    downloading:
      'bg-amber-950/80 text-amber-200 border-amber-700',
    downloaded:
      'bg-emerald-950/80 text-emerald-200 border-emerald-700 shadow-sm shadow-emerald-500/20',
    error:
      'bg-rose-950/80 text-rose-200 border-rose-800',
  };

  // ── Icon per state ──
  const Icon = {
    idle: null,
    checking: <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-sky-400" />,
    available: <ArrowUpCircle className="w-3.5 h-3.5 shrink-0 text-blue-400" />,
    'not-available': <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />,
    downloading: <Download className="w-3.5 h-3.5 animate-bounce shrink-0 text-amber-400" />,
    downloaded: <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />,
    error: <RefreshCw className="w-3.5 h-3.5 shrink-0 text-rose-400" />,
  }[state];

  // ── Action button ──
  const actionButton = (() => {
    if (state === 'available') {
      return (
        <button
          onClick={downloadUpdate}
          title={isAr ? 'تحميل التحديث' : 'Download update'}
          className="
            ms-1 px-2 py-0.5 rounded text-[10px] font-semibold
            bg-blue-600 hover:bg-blue-700 text-white
            dark:bg-blue-500 dark:hover:bg-blue-400
            transition-colors duration-150 shrink-0
          "
        >
          {isAr ? 'تحميل' : 'Download'}
        </button>
      );
    }
    if (state === 'downloaded') {
      return (
        <button
          onClick={installUpdate}
          title={isAr ? 'تثبيت وإعادة التشغيل' : 'Install & restart'}
          className="
            ms-1 px-2 py-0.5 rounded text-[10px] font-semibold
            bg-emerald-600 hover:bg-emerald-700 text-white
            dark:bg-emerald-500 dark:hover:bg-emerald-400
            transition-colors duration-150 shrink-0
          "
        >
          {isAr ? 'تثبيت الآن' : 'Install now'}
        </button>
      );
    }
    if (state === 'error') {
      return (
        <button
          onClick={checkForUpdates}
          className="
            ms-1 px-2 py-0.5 rounded text-[10px] font-semibold
            bg-rose-600 hover:bg-rose-700 text-white
            transition-colors duration-150 shrink-0
          "
        >
          {isAr ? 'إعادة المحاولة' : 'Retry'}
        </button>
      );
    }
    return null;
  })();

  // ── Download progress bar ──
  const progressBar = state === 'downloading' && progress && progress.total > 0 && (
    <span className="w-16 h-1 rounded-full bg-amber-200 dark:bg-amber-900 overflow-hidden shrink-0">
      <span
        className="block h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-300"
        style={{ width: `${Math.min(progress.percent, 100)}%` }}
      />
    </span>
  );

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="update-badge"
      data-update-state={state}
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
        text-[11px] font-medium border select-none
        transition-all duration-200 shrink-0
        ${stateStyle[state]}
        ${className}
      `}
    >
      {Icon}

      <span className="truncate max-w-[180px]">{label}</span>

      {/* Error tooltip */}
      {state === 'error' && errorMessage && (
        <span title={errorMessage} className="cursor-help opacity-60">⚠</span>
      )}

      {progressBar}
      {actionButton}

      {/* Dismiss button (only for available/error) */}
      {(state === 'available' || state === 'error') && (
        <button
          onClick={dismiss}
          aria-label={isAr ? 'إغلاق' : 'Dismiss'}
          className="
            ms-0.5 rounded-full p-0.5
            hover:bg-black/10 dark:hover:bg-white/10
            transition-colors duration-150 shrink-0
          "
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default UpdateBadge;
