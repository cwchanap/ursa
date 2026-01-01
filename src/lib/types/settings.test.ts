import { describe, it, expect } from 'vitest';
import {
  clampSetting,
  validateSettings,
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
