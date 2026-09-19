import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';

const ThemeTestConsumer: React.FC = () => {
  const { theme, resolvedTheme, isDark, setTheme, toggleTheme } = useTheme();

  return (
    <div>
      <div data-testid="theme-val">{theme}</div>
      <div data-testid="resolved-theme-val">{resolvedTheme}</div>
      <div data-testid="is-dark-val">{isDark ? 'true' : 'false'}</div>
      <button data-testid="btn-toggle-theme" onClick={toggleTheme}>
        Toggle Theme
      </button>
      <button data-testid="btn-set-dark" onClick={() => setTheme('dark')}>
        Set Dark
      </button>
      <button data-testid="btn-set-light" onClick={() => setTheme('light')}>
        Set Light
      </button>
      <button data-testid="btn-set-system" onClick={() => setTheme('system')}>
        Set System
      </button>
    </div>
  );
};

describe('ThemeContext & Dark/Light Mode Management', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with system theme and resolves to light by default in test DOM', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-val')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved-theme-val')).toHaveTextContent('light');
    expect(screen.getByTestId('is-dark-val')).toHaveTextContent('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('switches to dark mode and applies dark class to document root', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('btn-set-dark'));

    expect(screen.getByTestId('theme-val')).toHaveTextContent('dark');
    expect(screen.getByTestId('resolved-theme-val')).toHaveTextContent('dark');
    expect(screen.getByTestId('is-dark-val')).toHaveTextContent('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('app_theme')).toBe('dark');
  });

  it('switches to light mode and removes dark class from document root', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('btn-set-dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(screen.getByTestId('btn-set-light'));
    expect(screen.getByTestId('theme-val')).toHaveTextContent('light');
    expect(screen.getByTestId('resolved-theme-val')).toHaveTextContent('light');
    expect(screen.getByTestId('is-dark-val')).toHaveTextContent('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('app_theme')).toBe('light');
  });

  it('cycles theme through light -> dark -> system via toggleTheme', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    // Initial is system. Click set light first
    fireEvent.click(screen.getByTestId('btn-set-light'));
    expect(screen.getByTestId('theme-val')).toHaveTextContent('light');

    // Toggle 1: light -> dark
    fireEvent.click(screen.getByTestId('btn-toggle-theme'));
    expect(screen.getByTestId('theme-val')).toHaveTextContent('dark');

    // Toggle 2: dark -> system
    fireEvent.click(screen.getByTestId('btn-toggle-theme'));
    expect(screen.getByTestId('theme-val')).toHaveTextContent('system');

    // Toggle 3: system -> light
    fireEvent.click(screen.getByTestId('btn-toggle-theme'));
    expect(screen.getByTestId('theme-val')).toHaveTextContent('light');
  });

  it('retains theme preference from localStorage on mount', () => {
    localStorage.setItem('app_theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-val')).toHaveTextContent('dark');
    expect(screen.getByTestId('is-dark-val')).toHaveTextContent('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('integrates with electronAPI.onThemeChanged event', () => {
    let electronThemeCallback: ((theme: 'light' | 'dark') => void) | null = null;
    window.electronAPI = {
      ...window.electronAPI,
      onThemeChanged: vi.fn().mockImplementation((cb) => {
        electronThemeCallback = cb;
        return () => {};
      })
    } as any;

    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    // When theme is 'system', electron theme changes trigger resolution update
    expect(screen.getByTestId('theme-val')).toHaveTextContent('system');

    act(() => {
      if (electronThemeCallback) {
        electronThemeCallback('dark');
      }
    });

    expect(screen.getByTestId('resolved-theme-val')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
