import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEntries,
  deleteEntry,
  clearHistory,
  isAvailable,
  getStorageUsage,
  historyRepository,
} from './historyRepository';
import { HISTORY_STORAGE_KEY } from '../types/history';
import type { HistoryEntry } from '../types/history';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Sample valid history entry
const createValidEntry = (id: string): HistoryEntry => ({
  id,
  timestamp: new Date().toISOString(),
  analysisType: 'detection',
  imageDataURL: 'data:image/png;base64,abc123',
  results: { objects: [], inferenceTime: 100 },
  imageDimensions: { width: 800, height: 600 },
});

describe('historyRepository', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('returns true when localStorage is available', () => {
      expect(isAvailable()).toBe(true);
    });

    it('returns false when localStorage throws', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      expect(isAvailable()).toBe(false);
    });
  });

  describe('getEntries', () => {
    it('returns empty array when nothing is stored', () => {
      const entries = getEntries();
      expect(entries).toEqual([]);
    });

    it('returns stored entries', () => {
      const storedEntries = [createValidEntry('1'), createValidEntry('2')];
      localStorageMock.setItem(HISTORY_STORAGE_KEY, JSON.stringify(storedEntries));

      const entries = getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].id).toBe('1');
    });

    it('returns empty array on parse error', () => {
      localStorageMock.setItem(HISTORY_STORAGE_KEY, 'invalid json');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const entries = getEntries();

      expect(entries).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('filters out invalid entries', () => {
      const mixedEntries = [
        createValidEntry('valid-1'),
        { invalid: 'entry' },
        createValidEntry('valid-2'),
      ];
      localStorageMock.setItem(HISTORY_STORAGE_KEY, JSON.stringify(mixedEntries));

      const entries = getEntries();
      expect(entries).toHaveLength(2);
    });

    it('returns empty array for non-array data', () => {
      localStorageMock.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ not: 'array' }));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const entries = getEntries();

      expect(entries).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('deleteEntry', () => {
    it('deletes an existing entry', () => {
      const entries = [createValidEntry('1'), createValidEntry('2')];
      localStorageMock.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));

      const result = deleteEntry('1');

      expect(result).toBe(true);
      const saved = JSON.parse(localStorageMock.getItem(HISTORY_STORAGE_KEY)!);
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('2');
    });

    it('returns false when entry not found', () => {
      const entries = [createValidEntry('1')];
      localStorageMock.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));

      const result = deleteEntry('nonexistent');

      expect(result).toBe(false);
    });

    it('returns false when localStorage unavailable', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = deleteEntry('1');

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('clearHistory', () => {
    it('removes history from localStorage', () => {
      const entries = [createValidEntry('1')];
      localStorageMock.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));

      clearHistory();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(HISTORY_STORAGE_KEY);
    });

    it('handles errors gracefully', () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => clearHistory()).not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('getStorageUsage', () => {
    it('returns usage statistics', () => {
      const entries = [createValidEntry('1')];
      localStorageMock.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));

      const usage = getStorageUsage();

      expect(usage).not.toBeNull();
      expect(usage?.used).toBeGreaterThan(0);
      expect(usage?.available).toBe(5 * 1024 * 1024); // 5MB
    });

    it('returns usage for empty storage', () => {
      const usage = getStorageUsage();

      expect(usage).not.toBeNull();
      expect(usage?.used).toBe(0);
    });

    it('returns null when localStorage unavailable', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const usage = getStorageUsage();
      expect(usage).toBeNull();
    });
  });

  describe('historyRepository singleton', () => {
    it('has all expected methods', () => {
      expect(typeof historyRepository.getEntries).toBe('function');
      expect(typeof historyRepository.addEntry).toBe('function');
      expect(typeof historyRepository.deleteEntry).toBe('function');
      expect(typeof historyRepository.clearHistory).toBe('function');
      expect(typeof historyRepository.isAvailable).toBe('function');
      expect(typeof historyRepository.getStorageUsage).toBe('function');
    });

    it('getEntries works through singleton', () => {
      const entries = historyRepository.getEntries();
      expect(entries).toEqual([]);
    });
  });
});
