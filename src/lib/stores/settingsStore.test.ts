import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { DEFAULT_SETTINGS } from '../types/settings';

// Mock the repository - must be before store import
vi.mock('../repositories/settingsRepository', () => ({
  loadSettings: vi.fn(() => ({
    detection: {
      confidenceThreshold: 50,
      maxDetections: 20,
      showLabels: true,
      showScores: true,
    },
    ocr: {
      language: 'eng',
      minConfidence: 50,
    },
    performance: {
      videoFPS: 5,
    },
    version: 1,
  })),
  saveSettings: vi.fn(() => true),
  resetToDefaults: vi.fn(),
}));

import { saveSettings, resetToDefaults } from '../repositories/settingsRepository';
import {
  settingsStore,
  detectionSettings,
  ocrSettings,
  performanceSettings,
  videoFPS,
  confidenceThreshold,
  updateDetectionSettings,
  updateOCRSettings,
  updateOCRLanguage,
  updatePerformanceSettings,
  updateVideoFPS,
  resetSettings,
  getSettingsSnapshot,
} from './settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset store to defaults
    settingsStore.reset();
    vi.runAllTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('settingsStore', () => {
    it('initializes with default settings', () => {
      const settings = get(settingsStore);
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('set updates settings and triggers save', () => {
      const newSettings = {
        ...DEFAULT_SETTINGS,
        detection: { ...DEFAULT_SETTINGS.detection, confidenceThreshold: 75 },
      };

      settingsStore.set(newSettings);
      vi.advanceTimersByTime(500);

      expect(get(settingsStore).detection.confidenceThreshold).toBe(75);
      expect(saveSettings).toHaveBeenCalled();
    });

    it('update modifies settings with function', () => {
      settingsStore.update((s) => ({
        ...s,
        performance: { ...s.performance, videoFPS: 10 },
      }));
      vi.advanceTimersByTime(500);

      expect(get(settingsStore).performance.videoFPS).toBe(10);
    });

    it('reset clears to defaults', () => {
      // First modify settings
      updateVideoFPS(12);
      vi.advanceTimersByTime(500);

      // Then reset
      settingsStore.reset();

      expect(get(settingsStore)).toEqual(DEFAULT_SETTINGS);
      expect(resetToDefaults).toHaveBeenCalled();
    });

    it('saveNow bypasses debounce', () => {
      settingsStore.set({
        ...DEFAULT_SETTINGS,
        detection: { ...DEFAULT_SETTINGS.detection, confidenceThreshold: 80 },
      });

      // Don't advance timers, call saveNow directly
      settingsStore.saveNow();

      expect(saveSettings).toHaveBeenCalled();
    });

    it('debounces multiple rapid updates', () => {
      updateVideoFPS(5);
      updateVideoFPS(6);
      updateVideoFPS(7);
      updateVideoFPS(8);

      // Should not have saved yet
      expect(saveSettings).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      // Should only save once with final value
      expect(saveSettings).toHaveBeenCalledTimes(1);
      expect(get(settingsStore).performance.videoFPS).toBe(8);
    });
  });

  describe('derived stores', () => {
    it('detectionSettings derives correctly', () => {
      const detection = get(detectionSettings);
      expect(detection).toEqual(DEFAULT_SETTINGS.detection);
    });

    it('ocrSettings derives correctly', () => {
      const ocr = get(ocrSettings);
      expect(ocr).toEqual(DEFAULT_SETTINGS.ocr);
    });

    it('performanceSettings derives correctly', () => {
      const performance = get(performanceSettings);
      expect(performance).toEqual(DEFAULT_SETTINGS.performance);
    });

    it('videoFPS derives correctly', () => {
      const fps = get(videoFPS);
      expect(fps).toBe(DEFAULT_SETTINGS.performance.videoFPS);
    });

    it('confidenceThreshold derives correctly', () => {
      const threshold = get(confidenceThreshold);
      expect(threshold).toBe(DEFAULT_SETTINGS.detection.confidenceThreshold);
    });

    it('derived stores update when main store changes', () => {
      updateVideoFPS(12);

      expect(get(videoFPS)).toBe(12);
      expect(get(performanceSettings).videoFPS).toBe(12);
    });
  });

  describe('updateDetectionSettings', () => {
    it('updates confidence threshold', () => {
      updateDetectionSettings({ confidenceThreshold: 80 });
      expect(get(detectionSettings).confidenceThreshold).toBe(80);
    });

    it('updates max detections', () => {
      updateDetectionSettings({ maxDetections: 30 });
      expect(get(detectionSettings).maxDetections).toBe(30);
    });

    it('clamps out-of-range confidence', () => {
      updateDetectionSettings({ confidenceThreshold: 150 });
      expect(get(detectionSettings).confidenceThreshold).toBe(100);
    });

    it('clamps out-of-range maxDetections', () => {
      updateDetectionSettings({ maxDetections: 100 });
      expect(get(detectionSettings).maxDetections).toBe(50);
    });

    it('preserves other detection settings', () => {
      updateDetectionSettings({ confidenceThreshold: 75 });
      expect(get(detectionSettings).showLabels).toBe(true);
      expect(get(detectionSettings).showScores).toBe(true);
    });
  });

  describe('updateOCRSettings', () => {
    it('updates min confidence', () => {
      updateOCRSettings({ minConfidence: 70 });
      expect(get(ocrSettings).minConfidence).toBe(70);
    });

    it('clamps out-of-range minConfidence', () => {
      updateOCRSettings({ minConfidence: 120 });
      expect(get(ocrSettings).minConfidence).toBe(100);
    });

    it('preserves language when updating confidence', () => {
      updateOCRSettings({ minConfidence: 60 });
      expect(get(ocrSettings).language).toBe('eng');
    });
  });

  describe('updateOCRLanguage', () => {
    it('updates language', () => {
      updateOCRLanguage('deu');
      expect(get(ocrSettings).language).toBe('deu');
    });

    it('preserves minConfidence when updating language', () => {
      updateOCRSettings({ minConfidence: 75 });
      updateOCRLanguage('fra');

      expect(get(ocrSettings).language).toBe('fra');
      expect(get(ocrSettings).minConfidence).toBe(75);
    });
  });

  describe('updatePerformanceSettings', () => {
    it('updates videoFPS', () => {
      updatePerformanceSettings({ videoFPS: 12 });
      expect(get(performanceSettings).videoFPS).toBe(12);
    });

    it('clamps out-of-range FPS', () => {
      updatePerformanceSettings({ videoFPS: 30 });
      expect(get(performanceSettings).videoFPS).toBe(15);
    });
  });

  describe('updateVideoFPS', () => {
    it('updates FPS directly', () => {
      updateVideoFPS(8);
      expect(get(videoFPS)).toBe(8);
    });

    it('clamps low FPS to minimum', () => {
      updateVideoFPS(0);
      expect(get(videoFPS)).toBe(1);
    });

    it('clamps high FPS to maximum', () => {
      updateVideoFPS(25);
      expect(get(videoFPS)).toBe(15);
    });
  });

  describe('resetSettings', () => {
    it('resets all settings to defaults', () => {
      updateVideoFPS(12);
      updateDetectionSettings({ confidenceThreshold: 90 });
      updateOCRLanguage('deu');

      resetSettings();

      expect(get(settingsStore)).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('getSettingsSnapshot', () => {
    it('returns current settings', () => {
      updateVideoFPS(10);
      const snapshot = getSettingsSnapshot();

      expect(snapshot.performance.videoFPS).toBe(10);
    });

    it('returns a copy of settings', () => {
      const snapshot = getSettingsSnapshot();
      snapshot.performance.videoFPS = 999;

      expect(get(videoFPS)).toBe(DEFAULT_SETTINGS.performance.videoFPS);
    });
  });
});
