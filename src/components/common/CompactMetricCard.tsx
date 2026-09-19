import React from 'react';
import { LucideIcon } from 'lucide-react';
import { BidiIsolate } from './BidiIsolate';

export interface CompactMetricCardProps {
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
    <div
      data-testid="compact-metric-card"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 shadow-2xs flex items-center justify-between gap-3 min-w-0 h-[82px] select-none"
    >
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
              className={`text-[10px] font-semibold px-1 py-0.5 rounded shrink-0 ${
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
