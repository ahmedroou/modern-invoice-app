/**
 * Keyboard Navigation & Global Shortcut Utilities
 * 
 * Target: src/lib/keyboard.ts
 * Provides keyboard handlers for spreadsheet-like grid navigation in invoice line items
 * and global hotkeys (Ctrl+N, Ctrl+S, Esc, Ctrl+K) for power users.
 */

import React, { useEffect } from 'react';

export type GridColumnField = 'description' | 'quantity' | 'unitPrice' | 'discount' | 'taxRate';
export const GRID_COLUMNS: GridColumnField[] = ['description', 'quantity', 'unitPrice', 'discount', 'taxRate'];

export interface GridNavigationOptions {
  itemsCount: number;
  onAddNewRow: () => void;
  onDeleteRow: (rowIndex: number) => void;
}

/**
 * Handles keyboard events on line item grid inputs.
 * 
 * Flow:
 * - Enter on last cell (taxRate): creates a new row and moves focus to its Description input.
 * - ArrowDown: moves focus to the same field in the next row below.
 * - ArrowUp: moves focus to the same field in the previous row above.
 * - Alt + Delete / Alt + Backspace: deletes the active row (if more than 1 item exists).
 */
export function handleGridCellKeyDown(
  e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  rowIndex: number,
  field: GridColumnField,
  options: GridNavigationOptions
): void {
  const { itemsCount, onAddNewRow, onDeleteRow } = options;

  // 1. Enter in the last column (taxRate) creates a new line item row and focuses its description
  if (e.key === 'Enter' && field === 'taxRate') {
    e.preventDefault();
    onAddNewRow();
    setTimeout(() => {
      const nextInput = document.querySelector<HTMLInputElement>(
        `[data-grid-cell="${rowIndex + 1}-description"]`
      );
      nextInput?.focus();
      nextInput?.select();
    }, 20);
    return;
  }

  // 2. Vertical Arrow Navigation
  if (e.key === 'ArrowDown') {
    if (rowIndex < itemsCount - 1) {
      e.preventDefault();
      const nextInput = document.querySelector<HTMLInputElement>(
        `[data-grid-cell="${rowIndex + 1}-${field}"]`
      );
      nextInput?.focus();
      nextInput?.select();
    }
    return;
  }

  if (e.key === 'ArrowUp') {
    if (rowIndex > 0) {
      e.preventDefault();
      const prevInput = document.querySelector<HTMLInputElement>(
        `[data-grid-cell="${rowIndex - 1}-${field}"]`
      );
      prevInput?.focus();
      prevInput?.select();
    }
    return;
  }

  // 3. Alt + Delete or Alt + Backspace: Delete active row
  if ((e.altKey && e.key === 'Delete') || (e.altKey && e.key === 'Backspace')) {
    e.preventDefault();
    if (itemsCount > 1) {
      onDeleteRow(rowIndex);
      const targetRow = Math.min(rowIndex, itemsCount - 2);
      setTimeout(() => {
        const targetInput = document.querySelector<HTMLInputElement>(
          `[data-grid-cell="${targetRow}-${field}"]`
        );
        targetInput?.focus();
        targetInput?.select();
      }, 20);
    }
    return;
  }
}

export interface GlobalShortcutHandlers {
  onNewInvoice?: () => void;
  onSave?: () => void;
  onCloseModal?: () => void;
  onSearch?: () => void;
  enabled?: boolean;
}

/**
 * React hook for global application shortcuts.
 * Supports Ctrl+N (New Invoice), Ctrl+S (Save), Escape (Close Modal),
 * and Ctrl+K or / (Focus Search).
 */
export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  const { onNewInvoice, onSave, onCloseModal, onSearch, enabled = true } = handlers;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement | null;
      const isInputField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      // 1. Ctrl+N / Cmd+N -> New Invoice
      if (isCtrlOrMeta && e.key.toLowerCase() === 'n' && !e.shiftKey && !e.altKey) {
        if (onNewInvoice) {
          e.preventDefault();
          onNewInvoice();
        }
        return;
      }

      // 2. Ctrl+S / Cmd+S -> Save
      if (isCtrlOrMeta && e.key.toLowerCase() === 's' && !e.shiftKey && !e.altKey) {
        if (onSave) {
          e.preventDefault();
          onSave();
        }
        return;
      }

      // 3. Escape -> Close Modal
      if (e.key === 'Escape') {
        if (onCloseModal) {
          e.preventDefault();
          onCloseModal();
        }
        return;
      }

      // 4. Ctrl+K / Cmd+K or / (when not focused in an input) -> Search
      if (
        (isCtrlOrMeta && e.key.toLowerCase() === 'k') ||
        (e.key === '/' && !isInputField && !isCtrlOrMeta && !e.altKey)
      ) {
        if (onSearch) {
          e.preventDefault();
          onSearch();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onNewInvoice, onSave, onCloseModal, onSearch, enabled]);
}
