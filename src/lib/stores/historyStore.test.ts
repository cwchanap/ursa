import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  historyStore,
  historyEntries,
  selectedEntry,
  hasHistory,
  historyCount,
  hasSelectedEntry,
  addToHistory,
  selectEntry,
  clearSelection,
  deleteHistoryEntry,
  clearAllHistory,
  getHistorySnapshot,
  getEntryById,
} from './historyStore';
import type { HistoryEntry, HistoryEntryInput } from '../types/history';
import { INITIAL_HISTORY_STATE } from '../types/history';

// Sample entries for testing
const createMockEntry = (
  id: string,
  type: 'detection' | 'classification' | 'ocr' = 'detection'
): HistoryEntry => ({
  id,
  timestamp: new Date().toISOString(),
  analysisType: type,
  imageDataURL: 'data:image/png;base64,abc123',
  results:
    type === 'detection'
      ? { objects: [], inferenceTime: 100 }
      : type === 'classification'
        ? {
            predictions: [{ label: 'cat', confidence: 0.9 }],
            inferenceTime: 50,
            timestamp: new Date().toISOString(),
            imageDimensions: { width: 800, height: 600 },
          }
        : {
            textRegions: [],
            fullText: 'test',
            processingTime: 200,
            timestamp: new Date().toISOString(),
            imageDimensions: { width: 800, height: 600 },
            language: 'eng',
          },
  imageDimensions: { width: 800, height: 600 },
});

// Mock the repository
vi.mock('../repositories/historyRepository', () => ({
  getEntries: vi.fn(() => []),
  deleteEntry: vi.fn(() => true),
  clearHistory: vi.fn(),
  historyRepository: {
    addEntry: vi.fn(async (input: HistoryEntryInput) => {
      const entry: HistoryEntry = {
        ...input,
        id: 'new-entry-id',
        timestamp: new Date().toISOString(),
      };
      return entry;
    }),
    getEntries: vi.fn(() => []),
    deleteEntry: vi.fn(() => true),
    clearHistory: vi.fn(),
    isAvailable: vi.fn(() => true),
    getStorageUsage: vi.fn(() => ({ used: 0, available: 5 * 1024 * 1024 })),
  },
}));

import {
  getEntries,
  deleteEntry,
  clearHistory,
  historyRepository,
} from '../repositories/historyRepository';

describe('historyStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    historyStore.set(INITIAL_HISTORY_STATE);
  });

  describe('historyStore', () => {
    it('initializes with empty state', () => {
      const state = get(historyStore);
      expect(state.entries).toEqual([]);
      expect(state.selectedEntryId).toBeNull();
    });

    it('can set entries directly', () => {
      const entries = [createMockEntry('1'), createMockEntry('2')];
      historyStore.set({ entries, selectedEntryId: null });

      expect(get(historyStore).entries).toHaveLength(2);
    });

    it('reload fetches from repository', () => {
      const entries = [createMockEntry('1')];
      vi.mocked(getEntries).mockReturnValueOnce(entries);

      historyStore.reload();

      expect(getEntries).toHaveBeenCalled();
      expect(get(historyStore).entries).toHaveLength(1);
    });

    it('reload clears selectedEntryId if selected entry no longer exists', () => {
      const entries = [createMockEntry('1'), createMockEntry('2')];
      historyStore.set({ entries, selectedEntryId: '2' });

      // Reload with entries that don't include '2'
      const newEntries = [createMockEntry('1')];
      vi.mocked(getEntries).mockReturnValueOnce(newEntries);

      historyStore.reload();

      expect(get(historyStore).selectedEntryId).toBeNull();
      expect(get(hasSelectedEntry)).toBe(false);
    });

    it('reload preserves selectedEntryId if selected entry still exists', () => {
      const entries = [createMockEntry('1'), createMockEntry('2')];
      historyStore.set({ entries, selectedEntryId: '1' });

      // Reload with entries that still include '1'
      const newEntries = [createMockEntry('1'), createMockEntry('3')];
      vi.mocked(getEntries).mockReturnValueOnce(newEntries);

      historyStore.reload();

      expect(get(historyStore).selectedEntryId).toBe('1');
      expect(get(hasSelectedEntry)).toBe(true);
    });
  });

  describe('derived stores', () => {
    const entries = [createMockEntry('1'), createMockEntry('2')];

    beforeEach(() => {
      historyStore.set({ entries, selectedEntryId: null });
    });

    it('historyEntries returns all entries', () => {
      expect(get(historyEntries)).toHaveLength(2);
    });

    it('hasHistory returns true when entries exist', () => {
      expect(get(hasHistory)).toBe(true);
    });

    it('hasHistory returns false when empty', () => {
      historyStore.set(INITIAL_HISTORY_STATE);
      expect(get(hasHistory)).toBe(false);
    });

    it('historyCount returns correct count', () => {
      expect(get(historyCount)).toBe(2);
    });

    it('selectedEntry returns null when no selection', () => {
      expect(get(selectedEntry)).toBeNull();
    });

    it('selectedEntry returns entry when selected', () => {
      historyStore.set({ entries, selectedEntryId: '1' });
      expect(get(selectedEntry)?.id).toBe('1');
    });

    it('selectedEntry returns null for invalid selection', () => {
      historyStore.set({ entries, selectedEntryId: 'nonexistent' });
      expect(get(selectedEntry)).toBeNull();
    });

    it('hasSelectedEntry returns true when selected', () => {
      historyStore.set({ entries, selectedEntryId: '1' });
      expect(get(hasSelectedEntry)).toBe(true);
    });

    it('hasSelectedEntry returns false when not selected', () => {
      expect(get(hasSelectedEntry)).toBe(false);
    });

    it('hasSelectedEntry returns false when selectedEntryId points to non-existent entry', () => {
      historyStore.set({ entries, selectedEntryId: 'nonexistent' });
      expect(get(hasSelectedEntry)).toBe(false);
    });
  });

  describe('selectEntry', () => {
    it('selects an entry by ID', () => {
      const entries = [createMockEntry('1')];
      historyStore.set({ entries, selectedEntryId: null });

      selectEntry('1');

      expect(get(historyStore).selectedEntryId).toBe('1');
    });

    it('changes selection', () => {
      const entries = [createMockEntry('1'), createMockEntry('2')];
      historyStore.set({ entries, selectedEntryId: '1' });

      selectEntry('2');

      expect(get(historyStore).selectedEntryId).toBe('2');
    });
  });

  describe('clearSelection', () => {
    it('clears the selection', () => {
      const entries = [createMockEntry('1')];
      historyStore.set({ entries, selectedEntryId: '1' });

      clearSelection();

      expect(get(historyStore).selectedEntryId).toBeNull();
    });
  });

  describe('deleteHistoryEntry', () => {
    it('deletes an entry from store', () => {
      const entries = [createMockEntry('1'), createMockEntry('2')];
      historyStore.set({ entries, selectedEntryId: null });

      const result = deleteHistoryEntry('1');

      expect(result).toBe(true);
      expect(get(historyEntries)).toHaveLength(1);
      expect(get(historyEntries)[0].id).toBe('2');
    });

    it('calls repository deleteEntry', () => {
      const entries = [createMockEntry('1')];
      historyStore.set({ entries, selectedEntryId: null });

      deleteHistoryEntry('1');

      expect(deleteEntry).toHaveBeenCalledWith('1');
    });

    it('clears selection if deleted entry was selected', () => {
      const entries = [createMockEntry('1'), createMockEntry('2')];
      historyStore.set({ entries, selectedEntryId: '1' });

      deleteHistoryEntry('1');

      expect(get(historyStore).selectedEntryId).toBeNull();
    });

    it('preserves selection if other entry deleted', () => {
      const entries = [createMockEntry('1'), createMockEntry('2')];
      historyStore.set({ entries, selectedEntryId: '1' });

      deleteHistoryEntry('2');

      expect(get(historyStore).selectedEntryId).toBe('1');
    });

    it('returns false if repository delete fails', () => {
      vi.mocked(deleteEntry).mockReturnValueOnce(false);
      const entries = [createMockEntry('1')];
      historyStore.set({ entries, selectedEntryId: null });

      const result = deleteHistoryEntry('1');

      expect(result).toBe(false);
      // Store should not be modified
      expect(get(historyEntries)).toHaveLength(1);
    });
  });

  describe('clearAllHistory', () => {
    it('clears all entries', () => {
      const entries = [createMockEntry('1'), createMockEntry('2')];
      historyStore.set({ entries, selectedEntryId: '1' });

      clearAllHistory();

      expect(get(historyStore)).toEqual(INITIAL_HISTORY_STATE);
    });

    it('calls repository clearHistory', () => {
      clearAllHistory();
      expect(clearHistory).toHaveBeenCalled();
    });
  });

  describe('addToHistory', () => {
    it('adds entry through repository', async () => {
      const input: HistoryEntryInput = {
        analysisType: 'detection',
        imageDataURL: 'data:image/png;base64,test',
        results: { objects: [], inferenceTime: 100 },
        imageDimensions: { width: 640, height: 480 },
      };

      // Mock reload to add the new entry
      const newEntry = createMockEntry('new-entry-id');
      vi.mocked(getEntries).mockReturnValueOnce([newEntry]);

      const result = await addToHistory(input);

      expect(historyRepository.addEntry).toHaveBeenCalledWith(input);
      expect(result).not.toBeNull();
    });

    it('returns null on error', async () => {
      (historyRepository.addEntry as any).mockRejectedValueOnce(new Error('Failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const input: HistoryEntryInput = {
        analysisType: 'detection',
        imageDataURL: 'data:image/png;base64,test',
        results: { objects: [], inferenceTime: 100 },
        imageDimensions: { width: 640, height: 480 },
      };

      const result = await addToHistory(input);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('getHistorySnapshot', () => {
    it('returns current state', () => {
      const entries = [createMockEntry('1')];
      historyStore.set({ entries, selectedEntryId: '1' });

      const snapshot = getHistorySnapshot();

      expect(snapshot.entries).toHaveLength(1);
      expect(snapshot.selectedEntryId).toBe('1');
    });
  });

  describe('getEntryById', () => {
    it('returns entry when found', () => {
      const entries = [createMockEntry('1'), createMockEntry('2')];
      historyStore.set({ entries, selectedEntryId: null });

      const entry = getEntryById('1');

      expect(entry).not.toBeNull();
      expect(entry?.id).toBe('1');
    });

    it('returns null when not found', () => {
      const entries = [createMockEntry('1')];
      historyStore.set({ entries, selectedEntryId: null });

      const entry = getEntryById('nonexistent');

      expect(entry).toBeNull();
    });
  });

  // Note: createHistoryEntryInput tests are complex due to DOM manipulation
  // The implementation now validates dimensions and waits for load events
  // Integration tests would require full DOM environment setup
});
