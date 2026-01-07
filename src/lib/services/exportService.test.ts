import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportDetectionImage,
  exportClassificationImage,
  exportOCRImage,
  exportOCRText,
  exportResultsAsJSON,
  copyResultsAsJSON,
  exportService,
} from './exportService';
import type { DetectionResult, ClassificationAnalysis, OCRAnalysis } from '../types/analysis';

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockObjectURL = 'blob:mock-url';
global.URL.createObjectURL = vi.fn(() => mockObjectURL);
global.URL.revokeObjectURL = vi.fn();

// Mock document methods
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

const mockAnchor = {
  href: '',
  download: '',
  click: mockClick,
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(),
  toBlob: vi.fn(),
};

const mockContext = {
  drawImage: vi.fn(),
  strokeRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 50 })),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  font: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  textAlign: 'left' as CanvasTextAlign,
};

vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'a') return mockAnchor as unknown as HTMLAnchorElement;
  if (tagName === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
  if (tagName === 'textarea') {
    return {
      value: '',
      style: {},
      focus: vi.fn(),
      select: vi.fn(),
    } as unknown as HTMLTextAreaElement;
  }
  return document.createElement(tagName);
});

vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild as any);
vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild as any);

// Mock image element
const createMockImageElement = () => ({
  naturalWidth: 800,
  naturalHeight: 600,
} as HTMLImageElement);

// Sample results
const detectionResults: DetectionResult = {
  objects: [
    { class: 'person', score: 0.95, bbox: [100, 100, 200, 300] },
    { class: 'dog', score: 0.88, bbox: [300, 200, 150, 150] },
  ],
  inferenceTime: 150,
};

const classificationResults: ClassificationAnalysis = {
  predictions: [
    { label: 'golden retriever', confidence: 0.92 },
    { label: 'labrador', confidence: 0.05 },
  ],
  inferenceTime: 80,
  timestamp: '2025-01-15T10:30:45.000Z',
  imageDimensions: { width: 800, height: 600 },
};

const ocrResults: OCRAnalysis = {
  textRegions: [
    { text: 'Hello', bbox: { x: 10, y: 10, width: 50, height: 20 }, confidence: 95 },
    { text: 'World', bbox: { x: 10, y: 40, width: 50, height: 20 }, confidence: 90 },
  ],
  fullText: 'Hello World',
  processingTime: 500,
  timestamp: '2025-01-15T10:30:45.000Z',
  imageDimensions: { width: 800, height: 600 },
  language: 'eng',
};

describe('exportService', () => {
  // Store original global values for clipboard tests
  let originalClipboard: Clipboard | undefined;
  let originalIsSecureContextDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.getContext.mockReturnValue(mockContext);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:30:45.000Z'));

    // Capture original clipboard and isSecureContext values
    originalClipboard = (navigator as any).clipboard;
    originalIsSecureContextDescriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
  });

  afterEach(() => {
    vi.useRealTimers();

    // Restore original clipboard using Object.defineProperty
    if (originalClipboard !== undefined) {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    } else {
      Object.defineProperty(navigator, 'clipboard', {
        get: () => undefined,
        configurable: true,
      });
    }

    // Restore original isSecureContext descriptor
    if (originalIsSecureContextDescriptor) {
      Object.defineProperty(window, 'isSecureContext', originalIsSecureContextDescriptor);
    } else {
      delete (window as any).isSecureContext;
    }
  });

  describe('exportDetectionImage', () => {
    it('creates canvas with correct dimensions', async () => {
      mockCanvas.toBlob.mockImplementation((callback) => {
        callback(new Blob(['test'], { type: 'image/png' }));
      });

      const imageElement = createMockImageElement();
      await exportDetectionImage(imageElement, detectionResults);

      expect(mockCanvas.width).toBe(800);
      expect(mockCanvas.height).toBe(600);
    });

    it('draws image and detections', async () => {
      mockCanvas.toBlob.mockImplementation((callback) => {
        callback(new Blob(['test'], { type: 'image/png' }));
      });

      const imageElement = createMockImageElement();
      await exportDetectionImage(imageElement, detectionResults);

      expect(mockContext.drawImage).toHaveBeenCalled();
      expect(mockContext.strokeRect).toHaveBeenCalled();
    });

    it('returns success with filename', async () => {
      mockCanvas.toBlob.mockImplementation((callback) => {
        callback(new Blob(['test'], { type: 'image/png' }));
      });

      const imageElement = createMockImageElement();
      const result = await exportDetectionImage(imageElement, detectionResults);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/ursa-detection-.*\.png/);
    });

    it('uses custom filename when provided', async () => {
      mockCanvas.toBlob.mockImplementation((callback) => {
        callback(new Blob(['test'], { type: 'image/png' }));
      });

      const imageElement = createMockImageElement();
      const result = await exportDetectionImage(imageElement, detectionResults, {}, { filename: 'custom.png' });

      expect(result.filename).toBe('custom.png');
    });

    it('returns error when canvas context unavailable', async () => {
      mockCanvas.getContext.mockReturnValueOnce(null);

      const imageElement = createMockImageElement();
      const result = await exportDetectionImage(imageElement, detectionResults);

      expect(result.success).toBe(false);
      expect(result.error).toContain('canvas context');
    });

    it('returns error when blob creation fails', async () => {
      mockCanvas.toBlob.mockImplementation((callback) => {
        callback(null);
      });

      const imageElement = createMockImageElement();
      const result = await exportDetectionImage(imageElement, detectionResults);

      expect(result.success).toBe(false);
      expect(result.error).toContain('blob');
    });

    it('skips overlay when includeOverlay is false', async () => {
      mockCanvas.toBlob.mockImplementation((callback) => {
        callback(new Blob(['test'], { type: 'image/png' }));
      });

      const imageElement = createMockImageElement();
      await exportDetectionImage(imageElement, detectionResults, {}, { includeOverlay: false });

      // drawImage should be called but strokeRect should not (for detections)
      expect(mockContext.drawImage).toHaveBeenCalled();
      // Reset count before we checked strokeRect
      const strokeRectCallsForDetections = mockContext.strokeRect.mock.calls.filter(call => call.length === 4);
      expect(strokeRectCallsForDetections.length).toBe(0);
    });
  });

  describe('exportClassificationImage', () => {
    it('creates canvas with extra space for overlay', async () => {
      mockCanvas.toBlob.mockImplementation((callback) => {
        callback(new Blob(['test'], { type: 'image/png' }));
      });

      const imageElement = createMockImageElement();
      const result = await exportClassificationImage(imageElement, classificationResults);

      expect(mockCanvas.width).toBe(800);
      expect(mockCanvas.height).toBe(660); // 600 (image height) + 60 (overlay bar height)
      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/ursa-classification-.*\.png/);
    });

    it('draws image and overlay', async () => {
      mockCanvas.toBlob.mockImplementation((callback) => {
        callback(new Blob(['test'], { type: 'image/png' }));
      });

      const imageElement = createMockImageElement();
      const result = await exportClassificationImage(imageElement, classificationResults);

      expect(mockContext.drawImage).toHaveBeenCalled();
      expect(mockContext.fillRect).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('exportOCRImage', () => {
    it('creates canvas and draws text regions', async () => {
      mockCanvas.toBlob.mockImplementation((callback) => {
        callback(new Blob(['test'], { type: 'image/png' }));
      });

      const imageElement = createMockImageElement();
      const result = await exportOCRImage(imageElement, ocrResults);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/ursa-ocr-.*\.png/);
    });
  });

  describe('exportOCRText', () => {
    it('exports full text as txt file', async () => {
      const result = await exportOCRText(ocrResults);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/ursa-ocr-.*\.txt/);
      expect(mockClick).toHaveBeenCalled();
    });

    it('uses custom filename when provided', async () => {
      const result = await exportOCRText(ocrResults, { filename: 'my-text.txt' });

      expect(result.filename).toBe('my-text.txt');
    });
  });

  describe('exportResultsAsJSON', () => {
    it('exports detection results as JSON', async () => {
      const result = await exportResultsAsJSON('detection', detectionResults);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/ursa-detection-.*\.json/);
    });

    it('exports classification results as JSON', async () => {
      const result = await exportResultsAsJSON('classification', classificationResults);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/ursa-classification-.*\.json/);
    });

    it('exports OCR results as JSON', async () => {
      const result = await exportResultsAsJSON('ocr', ocrResults);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/ursa-ocr-.*\.json/);
    });

    it('uses custom filename when provided', async () => {
      const result = await exportResultsAsJSON('detection', detectionResults, { filename: 'results.json' });

      expect(result.filename).toBe('results.json');
    });
  });

  describe('copyResultsAsJSON', () => {
    it('copies to clipboard using navigator.clipboard', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
        configurable: true,
      });

      const result = await copyResultsAsJSON(detectionResults);

      expect(result.success).toBe(true);
      expect(mockWriteText).toHaveBeenCalled();
    });

    it('returns error on clipboard failure', async () => {
      const mockWriteText = vi.fn().mockRejectedValue(new Error('Clipboard error'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
        configurable: true,
      });

      const result = await copyResultsAsJSON(detectionResults);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clipboard error');
    });
  });

  describe('exportService singleton', () => {
    it('has all expected methods', () => {
      expect(typeof exportService.exportDetectionImage).toBe('function');
      expect(typeof exportService.exportClassificationImage).toBe('function');
      expect(typeof exportService.exportOCRResults).toBe('function');
      expect(typeof exportService.exportOCRImage).toBe('function');
      expect(typeof exportService.exportOCRText).toBe('function');
      expect(typeof exportService.exportResultsAsJSON).toBe('function');
      expect(typeof exportService.copyResultsAsJSON).toBe('function');
    });
  });
});
