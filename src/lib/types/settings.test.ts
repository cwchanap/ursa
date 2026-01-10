import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  clampSetting,
  validateSettings,
  validateLanguage,
  validateFPSThresholds,
  DEFAULT_SETTINGS,
  DEFAULT_DETECTION_SETTINGS,
  DEFAULT_OCR_SETTINGS,
  DEFAULT_PERFORMANCE_SETTINGS,
  SETTINGS_CONSTRAINTS,
  SETTINGS_STORAGE_KEY,
} from './settings';

describe('settings types', () => {
  describe('SETTINGS_STORAGE_KEY', () => {
    it('has expected value', () => {
      expect(SETTINGS_STORAGE_KEY).toBe('ursa-settings');
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('has version 1', () => {
      expect(DEFAULT_SETTINGS.version).toBe(1);
    });

    it('has detection settings with expected defaults', () => {
      expect(DEFAULT_SETTINGS.detection.confidenceThreshold).toBe(50);
      expect(DEFAULT_SETTINGS.detection.maxDetections).toBe(20);
      expect(DEFAULT_SETTINGS.detection.showLabels).toBe(true);
      expect(DEFAULT_SETTINGS.detection.showScores).toBe(true);
    });

    it('has OCR settings with expected defaults', () => {
      expect(DEFAULT_SETTINGS.ocr.language).toBe('eng');
      expect(DEFAULT_SETTINGS.ocr.minConfidence).toBe(50);
    });

    it('has performance settings with expected defaults', () => {
      expect(DEFAULT_SETTINGS.performance.videoFPS).toBe(5);
    });
  });

  describe('SETTINGS_CONSTRAINTS', () => {
    it('has valid confidence threshold range', () => {
      expect(SETTINGS_CONSTRAINTS.confidenceThreshold.min).toBe(0);
      expect(SETTINGS_CONSTRAINTS.confidenceThreshold.max).toBe(100);
    });

    it('has valid max detections range', () => {
      expect(SETTINGS_CONSTRAINTS.maxDetections.min).toBe(1);
      expect(SETTINGS_CONSTRAINTS.maxDetections.max).toBe(50);
    });

    it('has valid FPS range', () => {
      expect(SETTINGS_CONSTRAINTS.videoFPS.min).toBe(1);
      expect(SETTINGS_CONSTRAINTS.videoFPS.max).toBe(15);
    });

    it('has valid FPS quality thresholds', () => {
      expect(SETTINGS_CONSTRAINTS.videoFPS.qualityThresholds.low).toBe(3);
      expect(SETTINGS_CONSTRAINTS.videoFPS.qualityThresholds.medium).toBe(7);
      expect(SETTINGS_CONSTRAINTS.videoFPS.qualityThresholds.high).toBe(10);
    });
  });

  describe('validateFPSThresholds', () => {
    let originalConstraints: typeof SETTINGS_CONSTRAINTS;

    beforeEach(() => {
      // Clone the original constraints to avoid mutating global state
      originalConstraints = structuredClone(SETTINGS_CONSTRAINTS);
    });

    afterEach(() => {
      // Restore original constraints after each test
      Object.assign(SETTINGS_CONSTRAINTS, originalConstraints);
    });

    it('does not throw for valid thresholds', () => {
      expect(() => validateFPSThresholds()).not.toThrow();
    });

    it('throws if low threshold is below min', () => {
      (SETTINGS_CONSTRAINTS.videoFPS.qualityThresholds as any).low = 0;

      expect(() => validateFPSThresholds()).toThrow(
        /FPS quality thresholds.*must be within min-max range/
      );
    });

    it('throws if high threshold is above max', () => {
      (SETTINGS_CONSTRAINTS.videoFPS.qualityThresholds as any).high = 20;

      expect(() => validateFPSThresholds()).toThrow(
        /FPS quality thresholds.*must be within min-max range/
      );
    });

    it('throws if thresholds are not in ascending order', () => {
      (SETTINGS_CONSTRAINTS.videoFPS.qualityThresholds as any).medium = 10;
      (SETTINGS_CONSTRAINTS.videoFPS.qualityThresholds as any).high = 7;

      expect(() => validateFPSThresholds()).toThrow(
        /FPS quality thresholds must be in ascending order/
      );
    });
  });

  describe('clampSetting', () => {
    it('clamps confidenceThreshold to valid range', () => {
      expect(clampSetting(-10, 'confidenceThreshold')).toBe(0);
      expect(clampSetting(50, 'confidenceThreshold')).toBe(50);
      expect(clampSetting(150, 'confidenceThreshold')).toBe(100);
    });

    it('clamps maxDetections to valid range', () => {
      expect(clampSetting(0, 'maxDetections')).toBe(1);
      expect(clampSetting(25, 'maxDetections')).toBe(25);
      expect(clampSetting(100, 'maxDetections')).toBe(50);
    });

    it('clamps videoFPS to valid range', () => {
      expect(clampSetting(0, 'videoFPS')).toBe(1);
      expect(clampSetting(10, 'videoFPS')).toBe(10);
      expect(clampSetting(30, 'videoFPS')).toBe(15);
    });

    it('clamps minConfidence to valid range', () => {
      expect(clampSetting(-5, 'minConfidence')).toBe(0);
      expect(clampSetting(75, 'minConfidence')).toBe(75);
      expect(clampSetting(200, 'minConfidence')).toBe(100);
    });
  });

  describe('validateLanguage', () => {
    it('returns valid language code', () => {
      expect(validateLanguage('eng')).toBe('eng');
      expect(validateLanguage('spa')).toBe('spa');
      expect(validateLanguage('fra')).toBe('fra');
      expect(validateLanguage('deu')).toBe('deu');
      expect(validateLanguage('chi_sim')).toBe('chi_sim');
      expect(validateLanguage('jpn')).toBe('jpn');
    });

    it('returns default for null/undefined', () => {
      expect(validateLanguage(null)).toBe(DEFAULT_OCR_SETTINGS.language);
      expect(validateLanguage(undefined)).toBe(DEFAULT_OCR_SETTINGS.language);
    });

    it('returns default for non-string values', () => {
      expect(validateLanguage(123)).toBe(DEFAULT_OCR_SETTINGS.language);
      expect(validateLanguage({})).toBe(DEFAULT_OCR_SETTINGS.language);
      expect(validateLanguage([])).toBe(DEFAULT_OCR_SETTINGS.language);
    });

    it('returns default for invalid language codes', () => {
      expect(validateLanguage('invalid')).toBe(DEFAULT_OCR_SETTINGS.language);
      expect(validateLanguage('xyz')).toBe(DEFAULT_OCR_SETTINGS.language);
      expect(validateLanguage('')).toBe(DEFAULT_OCR_SETTINGS.language);
    });

    it('normalizes case and whitespace', () => {
      expect(validateLanguage('ENG')).toBe('eng');
      expect(validateLanguage('  spa  ')).toBe('spa');
      expect(validateLanguage('FRA')).toBe('fra');
    });
  });

  describe('validateSettings', () => {
    it('returns defaults for empty object', () => {
      const result = validateSettings({});
      expect(result).toEqual(DEFAULT_SETTINGS);
    });

    it('preserves valid settings', () => {
      const input = {
        detection: {
          confidenceThreshold: 75,
          maxDetections: 30,
          showLabels: false,
          showScores: true,
        },
        ocr: {
          language: 'deu',
          minConfidence: 60,
        },
        performance: {
          videoFPS: 10,
        },
        version: 1,
      };

      const result = validateSettings(input);
      expect(result.detection.confidenceThreshold).toBe(75);
      expect(result.detection.maxDetections).toBe(30);
      expect(result.detection.showLabels).toBe(false);
      expect(result.ocr.language).toBe('deu');
      expect(result.performance.videoFPS).toBe(10);
    });

    it('clamps out-of-range values', () => {
      const input = {
        detection: {
          confidenceThreshold: 150,
          maxDetections: 100,
          showLabels: true,
          showScores: true,
        },
        performance: {
          videoFPS: 30,
        },
      };

      const result = validateSettings(input);
      expect(result.detection.confidenceThreshold).toBe(100);
      expect(result.detection.maxDetections).toBe(50);
      expect(result.performance.videoFPS).toBe(15);
    });

    it('validates OCR language code', () => {
      const input = {
        ocr: {
          language: 'invalid_lang',
          minConfidence: 60,
        },
      };

      const result = validateSettings(input);
      expect(result.ocr.language).toBe(DEFAULT_OCR_SETTINGS.language);
      expect(result.ocr.minConfidence).toBe(60);
    });

    it('normalizes valid language codes', () => {
      const input = {
        ocr: {
          language: '  SPA  ',
          minConfidence: 60,
        },
      };

      const result = validateSettings(input);
      expect(result.ocr.language).toBe('spa');
    });

    it('fills in missing nested properties with defaults', () => {
      const input = {
        detection: {
          confidenceThreshold: 80,
        },
      };

      const result = validateSettings(input as any);
      expect(result.detection.confidenceThreshold).toBe(80);
      expect(result.detection.maxDetections).toBe(DEFAULT_DETECTION_SETTINGS.maxDetections);
      expect(result.detection.showLabels).toBe(DEFAULT_DETECTION_SETTINGS.showLabels);
      expect(result.ocr).toEqual(DEFAULT_OCR_SETTINGS);
      expect(result.performance).toEqual(DEFAULT_PERFORMANCE_SETTINGS);
    });

    it('uses default version if not provided', () => {
      const result = validateSettings({});
      expect(result.version).toBe(DEFAULT_SETTINGS.version);
    });
  });
});
