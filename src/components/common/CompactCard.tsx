import React from 'react';

export interface CompactCardProps extends React.HTMLAttributes<HTMLDivElement> {
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
        surface-card bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-800
        rounded-2xl p-3 sm:p-5
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
