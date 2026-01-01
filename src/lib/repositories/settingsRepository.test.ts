import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadSettings,
  saveSettings,
  resetToDefaults,
  isAvailable,
  settingsRepository,
} from './settingsRepository';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../types/settings';

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

describe('settingsRepository', () => {
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

  describe('loadSettings', () => {
    it('returns default settings when nothing is stored', () => {
      const settings = loadSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('returns stored settings when available', () => {
      const customSettings = {
        ...DEFAULT_SETTINGS,
        detection: {
          ...DEFAULT_SETTINGS.detection,
          confidenceThreshold: 75,
        },
      };
      localStorageMock.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(customSettings));

      const settings = loadSettings();
      expect(settings.detection.confidenceThreshold).toBe(75);
    });

    it('returns default settings on parse error', () => {
      localStorageMock.setItem(SETTINGS_STORAGE_KEY, 'invalid json');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const settings = loadSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      consoleSpy.mockRestore();
    });

    it('fills in missing properties with defaults', () => {
      const partialSettings = {
        detection: { confidenceThreshold: 80 },
        version: 1,
      };
      localStorageMock.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(partialSettings));

      const settings = loadSettings();
      expect(settings.detection.confidenceThreshold).toBe(80);
      expect(settings.detection.maxDetections).toBe(DEFAULT_SETTINGS.detection.maxDetections);
      expect(settings.ocr).toEqual(DEFAULT_SETTINGS.ocr);
    });

    it('handles version migration info logging', () => {
      const oldVersionSettings = {
        ...DEFAULT_SETTINGS,
        version: 0,
      };
      localStorageMock.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(oldVersionSettings));

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      loadSettings();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Migrating settings'));
      consoleSpy.mockRestore();
    });
  });

  describe('saveSettings', () => {
    it('saves settings to localStorage', () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        detection: {
          ...DEFAULT_SETTINGS.detection,
          confidenceThreshold: 65,
        },
      };

      const result = saveSettings(settings);

      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        SETTINGS_STORAGE_KEY,
        expect.any(String)
      );

      const saved = JSON.parse(localStorageMock.getItem(SETTINGS_STORAGE_KEY)!);
      expect(saved.detection.confidenceThreshold).toBe(65);
    });

    it('validates settings before saving', () => {
      const invalidSettings = {
        ...DEFAULT_SETTINGS,
        detection: {
          ...DEFAULT_SETTINGS.detection,
          confidenceThreshold: 150, // Out of range
        },
      };

      saveSettings(invalidSettings);

      const saved = JSON.parse(localStorageMock.getItem(SETTINGS_STORAGE_KEY)!);
      expect(saved.detection.confidenceThreshold).toBe(100); // Clamped
    });

    it('returns false on storage error', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = saveSettings(DEFAULT_SETTINGS);

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('resetToDefaults', () => {
    it('removes settings from localStorage', () => {
      localStorageMock.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));

      resetToDefaults();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(SETTINGS_STORAGE_KEY);
    });

    it('handles removal errors gracefully', () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      expect(() => resetToDefaults()).not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('settingsRepository singleton', () => {
    it('has all expected methods', () => {
      expect(typeof settingsRepository.loadSettings).toBe('function');
      expect(typeof settingsRepository.saveSettings).toBe('function');
      expect(typeof settingsRepository.resetToDefaults).toBe('function');
      expect(typeof settingsRepository.isAvailable).toBe('function');
    });

    it('loadSettings works through singleton', () => {
      const settings = settingsRepository.loadSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });
});
