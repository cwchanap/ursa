import { describe, it, expect } from 'vitest';
import {
  isDetectionResult,
  isClassificationResult,
  isOCRResult,
  isValidHistoryEntry,
  validateHistoryEntries,
  HISTORY_STORAGE_KEY,
  HISTORY_MAX_ENTRIES,
  HISTORY_THUMBNAIL_MAX_WIDTH,
  HISTORY_THUMBNAIL_QUALITY,
  INITIAL_HISTORY_STATE,
} from './history';
import type { HistoryEntry } from './history';
import type { DetectionResult, ClassificationAnalysis, OCRAnalysis } from './analysis';

describe('history types', () => {
  describe('constants', () => {
    it('has expected storage key', () => {
      expect(HISTORY_STORAGE_KEY).toBe('ursa-history');
    });

    it('has max entries of 10', () => {
      expect(HISTORY_MAX_ENTRIES).toBe(10);
    });

    it('has thumbnail max width of 400', () => {
      expect(HISTORY_THUMBNAIL_MAX_WIDTH).toBe(400);
    });

    it('has thumbnail quality of 0.7', () => {
      expect(HISTORY_THUMBNAIL_QUALITY).toBe(0.7);
    });

    it('has correct initial state', () => {
      expect(INITIAL_HISTORY_STATE).toEqual({
        entries: [],
        selectedEntryId: null,
      });
    });
  });

  describe('isDetectionResult', () => {
    it('returns true for detection results', () => {
      const result: DetectionResult = {
        objects: [{ class: 'person', score: 0.9, bbox: [0, 0, 100, 100] }],
        inferenceTime: 100,
      };
      expect(isDetectionResult(result)).toBe(true);
    });

    it('returns false for classification results', () => {
      const result: ClassificationAnalysis = {
        predictions: [{ label: 'cat', confidence: 0.9 }],
        inferenceTime: 50,
        timestamp: '2025-01-15T10:00:00.000Z',
        imageDimensions: { width: 800, height: 600 },
      };
      expect(isDetectionResult(result)).toBe(false);
    });

    it('returns false for OCR results', () => {
      const result: OCRAnalysis = {
        textRegions: [],
        fullText: 'test',
        processingTime: 100,
        timestamp: '2025-01-15T10:00:00.000Z',
        imageDimensions: { width: 800, height: 600 },
        language: 'eng',
      };
      expect(isDetectionResult(result)).toBe(false);
    });
  });

  describe('isClassificationResult', () => {
    it('returns true for classification results', () => {
      const result: ClassificationAnalysis = {
        predictions: [{ label: 'cat', confidence: 0.9 }],
        inferenceTime: 50,
        timestamp: '2025-01-15T10:00:00.000Z',
        imageDimensions: { width: 800, height: 600 },
      };
      expect(isClassificationResult(result)).toBe(true);
    });

    it('returns false for detection results', () => {
      const result: DetectionResult = {
        objects: [],
        inferenceTime: 100,
      };
      expect(isClassificationResult(result)).toBe(false);
    });

    it('returns false for OCR results', () => {
      const result: OCRAnalysis = {
        textRegions: [],
        fullText: 'test',
        processingTime: 100,
        timestamp: '2025-01-15T10:00:00.000Z',
        imageDimensions: { width: 800, height: 600 },
        language: 'eng',
      };
      expect(isClassificationResult(result)).toBe(false);
    });
  });

  describe('isOCRResult', () => {
    it('returns true for OCR results', () => {
      const result: OCRAnalysis = {
        textRegions: [{ text: 'hello', confidence: 0.95 }],
        fullText: 'hello',
        processingTime: 200,
        timestamp: '2025-01-15T10:00:00.000Z',
        imageDimensions: { width: 800, height: 600 },
        language: 'eng',
      };
      expect(isOCRResult(result)).toBe(true);
    });

    it('returns false for detection results', () => {
      const result: DetectionResult = {
        objects: [],
        inferenceTime: 100,
      };
      expect(isOCRResult(result)).toBe(false);
    });

    it('returns false for classification results', () => {
      const result: ClassificationAnalysis = {
        predictions: [],
        inferenceTime: 50,
        timestamp: '2025-01-15T10:00:00.000Z',
        imageDimensions: { width: 800, height: 600 },
      };
      expect(isOCRResult(result)).toBe(false);
    });
  });

  describe('isValidHistoryEntry', () => {
    const validEntry: HistoryEntry = {
      id: 'abc-123',
      timestamp: '2025-01-15T10:00:00.000Z',
      analysisType: 'detection',
      imageDataURL: 'data:image/png;base64,abc123',
      results: { objects: [], inferenceTime: 100 },
      imageDimensions: { width: 800, height: 600 },
    };

    it('returns true for valid detection entry', () => {
      expect(isValidHistoryEntry(validEntry)).toBe(true);
    });

    it('returns true for valid classification entry', () => {
      const entry = { ...validEntry, analysisType: 'classification' as const };
      expect(isValidHistoryEntry(entry)).toBe(true);
    });

    it('returns true for valid OCR entry', () => {
      const entry = { ...validEntry, analysisType: 'ocr' as const };
      expect(isValidHistoryEntry(entry)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isValidHistoryEntry(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isValidHistoryEntry(undefined)).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(isValidHistoryEntry('string')).toBe(false);
      expect(isValidHistoryEntry(123)).toBe(false);
    });

    it('returns false for missing id', () => {
      const { id, ...rest } = validEntry;
      void id;
      expect(isValidHistoryEntry(rest)).toBe(false);
    });

    it('returns false for missing timestamp', () => {
      const { timestamp, ...rest } = validEntry;
      void timestamp;
      expect(isValidHistoryEntry(rest)).toBe(false);
    });

    it('returns false for invalid analysisType', () => {
      const entry = { ...validEntry, analysisType: 'invalid' };
      expect(isValidHistoryEntry(entry)).toBe(false);
    });

    it('returns false for missing imageDataURL', () => {
      const { imageDataURL, ...rest } = validEntry;
      void imageDataURL;
      expect(isValidHistoryEntry(rest)).toBe(false);
    });

    it('returns false for missing results', () => {
      const { results, ...rest } = validEntry;
      void results;
      expect(isValidHistoryEntry(rest)).toBe(false);
    });

    it('returns false for missing imageDimensions', () => {
      const { imageDimensions, ...rest } = validEntry;
      void imageDimensions;
      expect(isValidHistoryEntry(rest)).toBe(false);
    });

    it('returns false for invalid dimension types', () => {
      const entry = {
        ...validEntry,
        imageDimensions: { width: '800', height: 600 },
      };
      expect(isValidHistoryEntry(entry)).toBe(false);
    });
  });

  describe('validateHistoryEntries', () => {
    const validEntry: HistoryEntry = {
      id: 'abc-123',
      timestamp: '2025-01-15T10:00:00.000Z',
      analysisType: 'detection',
      imageDataURL: 'data:image/png;base64,abc123',
      results: { objects: [], inferenceTime: 100 },
      imageDimensions: { width: 800, height: 600 },
    };

    it('returns empty array for empty input', () => {
      expect(validateHistoryEntries([])).toEqual([]);
    });

    it('keeps valid entries', () => {
      const entries = [validEntry, { ...validEntry, id: 'def-456' }];
      const result = validateHistoryEntries(entries);
      expect(result).toHaveLength(2);
    });

    it('filters out invalid entries', () => {
      const entries = [validEntry, { invalid: 'entry' }, null, { ...validEntry, id: 'valid-2' }];
      const result = validateHistoryEntries(entries);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('abc-123');
      expect(result[1].id).toBe('valid-2');
    });

    it('filters out entries with wrong types', () => {
      const entries = [validEntry, 'string', 123, undefined];
      const result = validateHistoryEntries(entries);
      expect(result).toHaveLength(1);
    });

    it('returns empty array for non-array input', () => {
      expect(validateHistoryEntries(null)).toEqual([]);
      expect(validateHistoryEntries(undefined)).toEqual([]);
      expect(validateHistoryEntries('string')).toEqual([]);
      expect(validateHistoryEntries(123)).toEqual([]);
      expect(validateHistoryEntries({})).toEqual([]);
    });
  });
});
