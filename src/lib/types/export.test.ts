import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateExportFilename, DEFAULT_CLASSIFICATION_OVERLAY } from './export';

describe('export types', () => {
  describe('generateExportFilename', () => {
    beforeEach(() => {
      // Mock Date to ensure consistent test results
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:30:45.123Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('generates filename for detection mode', () => {
      const filename = generateExportFilename('detection', 'png');
      expect(filename).toBe('ursa-detection-2025-01-15-103045.png');
    });

    it('generates filename for classification mode', () => {
      const filename = generateExportFilename('classification', 'json');
      expect(filename).toBe('ursa-classification-2025-01-15-103045.json');
    });

    it('generates filename for OCR mode', () => {
      const filename = generateExportFilename('ocr', 'txt');
      expect(filename).toBe('ursa-ocr-2025-01-15-103045.txt');
    });

    it('handles different file extensions', () => {
      const pngFilename = generateExportFilename('detection', 'png');
      const jpgFilename = generateExportFilename('detection', 'jpg');
      const jsonFilename = generateExportFilename('detection', 'json');

      expect(pngFilename).toMatch(/\.png$/);
      expect(jpgFilename).toMatch(/\.jpg$/);
      expect(jsonFilename).toMatch(/\.json$/);
    });

    it('produces unique filenames at different times', () => {
      const filename1 = generateExportFilename('detection', 'png');

      vi.setSystemTime(new Date('2025-01-15T10:30:46.000Z'));
      const filename2 = generateExportFilename('detection', 'png');

      expect(filename1).not.toBe(filename2);
    });
  });

  describe('DEFAULT_CLASSIFICATION_OVERLAY', () => {
    it('has expected default values', () => {
      expect(DEFAULT_CLASSIFICATION_OVERLAY.barHeight).toBe(60);
      expect(DEFAULT_CLASSIFICATION_OVERLAY.backgroundColor).toBe('rgba(10, 14, 39, 0.95)');
      expect(DEFAULT_CLASSIFICATION_OVERLAY.textColor).toBe('#06b6d4');
      expect(DEFAULT_CLASSIFICATION_OVERLAY.fontSize).toBe(14);
      expect(DEFAULT_CLASSIFICATION_OVERLAY.topPredictions).toBe(3);
      expect(DEFAULT_CLASSIFICATION_OVERLAY.padding).toBe(20);
    });

    it('has valid font family', () => {
      expect(DEFAULT_CLASSIFICATION_OVERLAY.fontFamily).toContain('JetBrains Mono');
    });
  });
});
