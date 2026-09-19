import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TrendingUp } from 'lucide-react';
import { CompactCard } from '@/components/common/CompactCard';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';

describe('Compact Card & Metric Card Components', () => {
  it('renders generic CompactCard with children and styling', () => {
    render(
      <CompactCard className="test-card">
        <span>Test Content</span>
      </CompactCard>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders CompactMetricCard with title, value, trend and icon under 90px height specification', () => {
    const { container } = render(
      <CompactMetricCard
        title="Total Revenue"
        value="$45,280.00"
        subtitle="+12.5% vs last month"
        icon={TrendingUp}
        trend={{ value: '+12.5%', isPositive: true }}
      />
    );

    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('$45,280.00')).toBeInTheDocument();
    expect(screen.getByText('+12.5% vs last month')).toBeInTheDocument();
    expect(screen.getByText('+12.5%')).toBeInTheDocument();

    // Verify compact height constraint class (h-[82px] is < 90px)
    const cardEl = container.firstChild as HTMLElement;
    expect(cardEl.className).toContain('h-[82px]');
  });

  it('renders BidiIsolate with dir="ltr" and isolate class', () => {
    render(<BidiIsolate data-testid="bidi-test">123-ABC</BidiIsolate>);

    const el = screen.getByTestId('bidi-test');
    expect(el).toHaveAttribute('dir', 'ltr');
    expect(el.className).toContain('unicode-isolate');
    expect(el).toHaveTextContent('123-ABC');
  });
});
