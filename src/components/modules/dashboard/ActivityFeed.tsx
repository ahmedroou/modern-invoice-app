import React from 'react';
import {
  Activity,
  UserPlus,
  UserCheck,
  FileText,
  CreditCard,
  AlertCircle,
  Clock
} from 'lucide-react';
import { CompactCard } from '@/components/common/CompactCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { useDirection } from '@/context/DirectionContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import type { ActivityLog } from '@/types/domain';

export function formatRelativeTime(isoString: string, language: 'en' | 'ar' = 'en'): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) {
      return language === 'ar' ? 'الآن' : 'just now';
    }
    if (diffMin < 60) {
      return language === 'ar' ? `منذ ${diffMin} د` : `${diffMin}m ago`;
    }
    if (diffHours < 24) {
      return language === 'ar' ? `منذ ${diffHours} س` : `${diffHours}h ago`;
    }
    if (diffDays === 1) {
      return language === 'ar' ? 'أمس' : 'yesterday';
    }
    if (diffDays < 7) {
      return language === 'ar' ? `منذ ${diffDays} أ` : `${diffDays}d ago`;
    }
    return date.toISOString().split('T')[0];
  } catch {
    return isoString;
  }
}

interface EventBadgeConfig {
  icon: React.ElementType;
  style: string;
  badgeLabelEn: string;
  badgeLabelAr: string;
}

const EVENT_CONFIGS: Record<ActivityLog['eventType'], EventBadgeConfig> = {
  CUSTOMER_CREATED: {
    icon: UserPlus,
    style: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30',
    badgeLabelEn: 'Customer',
    badgeLabelAr: 'عميل'
  },
  CUSTOMER_UPDATED: {
    icon: UserCheck,
    style: 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/30',
    badgeLabelEn: 'Customer',
    badgeLabelAr: 'عميل'
  },
  INVOICE_CREATED: {
    icon: FileText,
    style: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/30',
    badgeLabelEn: 'Invoice',
    badgeLabelAr: 'فاتورة'
  },
  INVOICE_UPDATED: {
    icon: FileText,
    style: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/30',
    badgeLabelEn: 'Invoice',
    badgeLabelAr: 'فاتورة'
  },
  INVOICE_STATUS_CHANGED: {
    icon: AlertCircle,
    style: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30',
    badgeLabelEn: 'Status',
    badgeLabelAr: 'حالة'
  },
  PAYMENT_RECORDED: {
    icon: CreditCard,
    style: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30',
    badgeLabelEn: 'Payment',
    badgeLabelAr: 'دفعة'
  }
};

export const ActivityFeed: React.FC<{ maxItems?: number }> = ({ maxItems = 15 }) => {
  const { language } = useDirection();
  const { logs, isLoading } = useActivityLog(maxItems);

  return (
    <CompactCard data-testid="activity-feed">
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {language === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}
          </h3>
        </div>
        {logs.length > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {logs.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 py-2" data-testid="activity-feed-loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-11 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div
          data-testid="activity-feed-empty"
          className="py-6 text-center text-slate-400 dark:text-slate-500 space-y-1"
        >
          <Clock className="w-5 h-5 mx-auto opacity-60" />
          <p className="text-xs font-medium">
            {language === 'ar' ? 'لا يوجد نشاط مسجل حتى الآن' : 'No activity recorded yet'}
          </p>
          <p className="text-[10px]">
            {language === 'ar' ? 'ستظهر العمليات المنفذة هنا في الوقت الفعلي' : 'Actions will stream here in real time'}
          </p>
        </div>
      ) : (
        <div
          data-testid="activity-feed-list"
          className="max-h-[380px] overflow-y-auto space-y-2 pr-0.5 divide-y divide-slate-100 dark:divide-slate-800/60"
        >
          {logs.map((log) => {
            const config = EVENT_CONFIGS[log.eventType] || EVENT_CONFIGS.INVOICE_CREATED;
            const Icon = config.icon;
            const badgeLabel = language === 'ar' ? config.badgeLabelAr : config.badgeLabelEn;
            const relativeTime = formatRelativeTime(log.timestamp, language);

            return (
              <div
                key={log.id}
                data-testid={`activity-item-${log.id}`}
                className="pt-2 first:pt-0 flex items-start gap-2.5 text-xs select-none"
              >
                <div
                  className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center border mt-0.5 ${config.style}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-semibold px-1 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {badgeLabel}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-mono">
                      {relativeTime}
                    </span>
                  </div>

                  <p className="text-slate-700 dark:text-slate-200 text-xs mt-0.5 leading-snug line-clamp-2">
                    <BidiIsolate>{log.description}</BidiIsolate>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CompactCard>
  );
};
