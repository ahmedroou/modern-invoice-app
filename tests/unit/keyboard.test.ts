import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { handleGridCellKeyDown, useGlobalShortcuts } from '@/lib/keyboard';

describe('Keyboard Navigation & Global Shortcuts (src/lib/keyboard.ts)', () => {
  describe('1. handleGridCellKeyDown', () => {
    let mockAddNewRow: ReturnType<typeof vi.fn>;
    let mockDeleteRow: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockAddNewRow = vi.fn();
      mockDeleteRow = vi.fn();
    });

    it('creates new row when Enter is pressed on the taxRate column', () => {
      const mockEvent = {
        key: 'Enter',
        preventDefault: vi.fn()
      } as unknown as React.KeyboardEvent<HTMLInputElement>;

      handleGridCellKeyDown(mockEvent, 0, 'taxRate', {
        itemsCount: 1,
        onAddNewRow: mockAddNewRow,
        onDeleteRow: mockDeleteRow
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockAddNewRow).toHaveBeenCalledTimes(1);
    });

    it('does not create a new row when Enter is pressed on non-taxRate columns', () => {
      const mockEvent = {
        key: 'Enter',
        preventDefault: vi.fn()
      } as unknown as React.KeyboardEvent<HTMLInputElement>;

      handleGridCellKeyDown(mockEvent, 0, 'description', {
        itemsCount: 1,
        onAddNewRow: mockAddNewRow,
        onDeleteRow: mockDeleteRow
      });

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockAddNewRow).not.toHaveBeenCalled();
    });

    it('deletes the active row on Alt+Delete when more than 1 item exists', () => {
      const mockEvent = {
        key: 'Delete',
        altKey: true,
        preventDefault: vi.fn()
      } as unknown as React.KeyboardEvent<HTMLInputElement>;

      handleGridCellKeyDown(mockEvent, 1, 'quantity', {
        itemsCount: 3,
        onAddNewRow: mockAddNewRow,
        onDeleteRow: mockDeleteRow
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockDeleteRow).toHaveBeenCalledWith(1);
    });

    it('prevents deletion of the only remaining row when itemsCount is 1', () => {
      const mockEvent = {
        key: 'Delete',
        altKey: true,
        preventDefault: vi.fn()
      } as unknown as React.KeyboardEvent<HTMLInputElement>;

      handleGridCellKeyDown(mockEvent, 0, 'quantity', {
        itemsCount: 1,
        onAddNewRow: mockAddNewRow,
        onDeleteRow: mockDeleteRow
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockDeleteRow).not.toHaveBeenCalled();
    });
  });

  describe('2. useGlobalShortcuts', () => {
    it('triggers onNewInvoice on Ctrl+N', () => {
      const onNewInvoice = vi.fn();
      renderHook(() => useGlobalShortcuts({ onNewInvoice, enabled: true }));

      const event = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
        bubbles: true
      });
      window.dispatchEvent(event);

      expect(onNewInvoice).toHaveBeenCalledTimes(1);
    });

    it('triggers onSave on Ctrl+S', () => {
      const onSave = vi.fn();
      renderHook(() => useGlobalShortcuts({ onSave, enabled: true }));

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });
      window.dispatchEvent(event);

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('triggers onCloseModal on Escape', () => {
      const onCloseModal = vi.fn();
      renderHook(() => useGlobalShortcuts({ onCloseModal, enabled: true }));

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });
      window.dispatchEvent(event);

      expect(onCloseModal).toHaveBeenCalledTimes(1);
    });

    it('triggers onSearch on Ctrl+K', () => {
      const onSearch = vi.fn();
      renderHook(() => useGlobalShortcuts({ onSearch, enabled: true }));

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true
      });
      window.dispatchEvent(event);

      expect(onSearch).toHaveBeenCalledTimes(1);
    });
  });
});
