import React from 'react';
import { Loader2, WifiOff, Check } from 'lucide-react';
import { useSyncStatus, SyncStatusState } from '@/hooks/useSyncStatus';
import { useDirection } from '@/context/DirectionContext';
import { BidiIsolate } from '@/components/common/BidiIsolate';

export interface SyncBadgeProps {
  /** Optional status override (for testing or controlled usage) */
  status?: SyncStatusState;
  /** Optional online status override */
  isOnline?: boolean;
  /** Optional pending sync count override */
  pendingSyncCount?: number;
  /** Optional custom CSS classes */
  className?: string;
  /** Compact mode: hides long text, shows dot/icon and pending count (mobile-friendly) */
  compact?: boolean;
  /** Show/hide label text */
  showLabel?: boolean;
}

export const SyncBadge: React.FC<SyncBadgeProps> = ({
  status: controlledStatus,
  isOnline: controlledIsOnline,
  pendingSyncCount: controlledPendingCount,
  className = '',
  compact = false,
  showLabel = true
}) => {
  const hookStatus = useSyncStatus();
  const { t, language } = useDirection();

  const isOnline = controlledIsOnline !== undefined ? controlledIsOnline : hookStatus.isOnline;
  const pendingSyncCount = controlledPendingCount !== undefined ? controlledPendingCount : hookStatus.pendingSyncCount;
  const status = controlledStatus !== undefined ? controlledStatus : hookStatus.status;

  // Bilingual tooltips
  const tooltipText = React.useMemo(() => {
    if (status === 'offline') {
      return language === 'ar'
        ? 'وضع عدم الاتصال — التغييرات محفوظة محلياً وسيتم مزامنتها تلقائياً عند استعادة الاتصال'
        : 'Offline Mode — Changes saved locally to IndexedDB and will sync automatically when reconnected';
    }
    if (status === 'syncing') {
      return language === 'ar'
        ? `جارٍ مزامنة ${pendingSyncCount} من التغييرات مع السحابة...`
        : `Synchronizing ${pendingSyncCount} pending change(s) with Cloud Firestore...`;
    }
    return language === 'ar'
      ? 'المزامنة نشطة — تم حفظ ومزامنة جميع التغييرات مع السحابة'
      : 'Cloud Synced — All local changes are committed to Cloud Firestore';
  }, [status, pendingSyncCount, language]);

  // Label text matching DirectionContext dictionary
  const labelText = React.useMemo(() => {
    if (status === 'offline') {
      return t('sync.offline', 'Offline (Saved locally)');
    }
    if (status === 'syncing') {
      return t('sync.syncing', 'Syncing...');
    }
    return t('sync.online', 'Online (Synced)');
  }, [status, t]);

  // State-specific styling
  const stateStyles = {
    synced: {
      container: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
      dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
      icon: <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
    },
    syncing: {
      container: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
      dot: 'bg-amber-500 animate-pulse',
      icon: <Loader2 className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-spin shrink-0" />
    },
    offline: {
      container: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
      dot: 'bg-rose-500',
      icon: <WifiOff className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
    }
  }[status];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={labelText}
      title={tooltipText}
      data-testid="sync-badge"
      data-status={status}
      data-online={isOnline}
      data-pending-count={pendingSyncCount}
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border
        select-none transition-all duration-150 shrink-0 cursor-default
        ${stateStyles.container}
        ${className}
      `}
    >
      {/* Visual Dot & Icon */}
      <span className="flex items-center gap-1 shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${stateStyles.dot}`} aria-hidden="true" />
        {stateStyles.icon}
      </span>

      {/* Label Text */}
      {showLabel && (
        <span className={`truncate max-w-[160px] ${compact ? 'hidden sm:inline' : 'inline'}`}>
          {labelText}
        </span>
      )}

      {/* Pending Sync Count Badge (Visible when syncing or offline with pending changes) */}
      {pendingSyncCount > 0 && (
        <span
          data-testid="sync-pending-count"
          className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 shrink-0"
        >
          <BidiIsolate>{pendingSyncCount}</BidiIsolate>
        </span>
      )}
    </div>
  );
};

export default SyncBadge;
