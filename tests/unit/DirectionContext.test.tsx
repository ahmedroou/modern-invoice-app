import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DirectionProvider, useDirection } from '@/context/DirectionContext';

const TestConsumer: React.FC = () => {
  const {
    direction,
    language,
    isRTL,
    setLanguage,
    toggleLanguage,
    t,
    formatCurrency,
    formatNumber
  } = useDirection();

  return (
    <div>
      <div data-testid="dir-val">{direction}</div>
      <div data-testid="lang-val">{language}</div>
      <div data-testid="is-rtl-val">{isRTL ? 'true' : 'false'}</div>
      <div data-testid="trans-dashboard">{t('nav.dashboard')}</div>
      <div data-testid="trans-fallback">{t('non.existent.key', 'Default Fallback')}</div>
      <div data-testid="formatted-currency">{formatCurrency(1250.5, 'SAR')}</div>
      <div data-testid="formatted-number">{formatNumber(9876543)}</div>
      <button data-testid="btn-toggle" onClick={toggleLanguage}>
        Toggle
      </button>
      <button data-testid="btn-set-ar" onClick={() => setLanguage('ar')}>
        Set Arabic
      </button>
      <button data-testid="btn-set-en" onClick={() => setLanguage('en')}>
        Set English
      </button>
    </div>
  );
};

describe('DirectionContext & Arabic RTL Support', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with default LTR and English language', () => {
    render(
      <DirectionProvider>
        <TestConsumer />
      </DirectionProvider>
    );

    expect(screen.getByTestId('dir-val')).toHaveTextContent('ltr');
    expect(screen.getByTestId('lang-val')).toHaveTextContent('en');
    expect(screen.getByTestId('is-rtl-val')).toHaveTextContent('false');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByTestId('trans-dashboard')).toHaveTextContent('Dashboard');
    expect(screen.getByTestId('formatted-currency')).toHaveTextContent('SAR 1,250.50');
  });

  it('atomically updates document attributes when switching to Arabic RTL', () => {
    render(
      <DirectionProvider>
        <TestConsumer />
      </DirectionProvider>
    );

    fireEvent.click(screen.getByTestId('btn-set-ar'));

    expect(screen.getByTestId('dir-val')).toHaveTextContent('rtl');
    expect(screen.getByTestId('lang-val')).toHaveTextContent('ar');
    expect(screen.getByTestId('is-rtl-val')).toHaveTextContent('true');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.getAttribute('data-direction')).toBe('rtl');
    expect(localStorage.getItem('app_language')).toBe('ar');

    // Text translations reflect Arabic
    expect(screen.getByTestId('trans-dashboard')).toHaveTextContent('لوحة التحكم');

    // Currency format reflects Arabic standard with SAR suffix
    expect(screen.getByTestId('formatted-currency')).toHaveTextContent('1,250.50 ر.س');
  });

  it('toggles back and forth between English and Arabic', () => {
    render(
      <DirectionProvider>
        <TestConsumer />
      </DirectionProvider>
    );

    // Initial is English
    expect(screen.getByTestId('lang-val')).toHaveTextContent('en');

    // First toggle -> Arabic
    fireEvent.click(screen.getByTestId('btn-toggle'));
    expect(screen.getByTestId('lang-val')).toHaveTextContent('ar');
    expect(document.documentElement.dir).toBe('rtl');

    // Second toggle -> English
    fireEvent.click(screen.getByTestId('btn-toggle'));
    expect(screen.getByTestId('lang-val')).toHaveTextContent('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('restores saved language preference from localStorage', () => {
    localStorage.setItem('app_language', 'ar');

    render(
      <DirectionProvider>
        <TestConsumer />
      </DirectionProvider>
    );

    expect(screen.getByTestId('lang-val')).toHaveTextContent('ar');
    expect(screen.getByTestId('dir-val')).toHaveTextContent('rtl');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('correctly handles fallbacks for unknown translation keys', () => {
    render(
      <DirectionProvider>
        <TestConsumer />
      </DirectionProvider>
    );

    expect(screen.getByTestId('trans-fallback')).toHaveTextContent('Default Fallback');
  });

  it('formats large numbers correctly with commas', () => {
    render(
      <DirectionProvider>
        <TestConsumer />
      </DirectionProvider>
    );

    expect(screen.getByTestId('formatted-number')).toHaveTextContent('9,876,543');
  });
});
