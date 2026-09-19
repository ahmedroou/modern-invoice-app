import React from 'react';

interface BidiIsolateProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  as?: 'span' | 'div';
}

/**
 * Isolates numeric values, currency codes, dates, and phone numbers to prevent
 * Unicode Bidirectional Algorithm (UBA) inversion in Arabic RTL mode.
 */
export const BidiIsolate: React.FC<BidiIsolateProps> = ({
  children,
  as: Component = 'span',
  className = '',
  ...props
}) => {
  return (
    <Component
      dir="ltr"
      data-testid="bidi-isolate"
      className={`inline-block tabular-nums unicode-isolate ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};
