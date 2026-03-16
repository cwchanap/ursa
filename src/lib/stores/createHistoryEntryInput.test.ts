import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHistoryEntryInput } from './historyStore';

// Helper: create a mock image element with given dimensions
function createLoadedImage(width = 320, height = 240): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  return img;
}

// Helper: create a mock video element with given dimensions
function createLoadedVideo(width = 640, height = 480): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'videoWidth', { value: width, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: height, configurable: true });
  return video;
}

// Mock canvas context
function mockCanvas() {
  const mockCtx = { drawImage: vi.fn() };
  const mockGetContext = vi.fn().mockReturnValue(mockCtx);
  const mockToDataURL = vi.fn().mockReturnValue('data:image/png;base64,mockeddata');

  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      const canvas = originalCreateElement('canvas') as HTMLCanvasElement;
      canvas.getContext = mockGetContext as unknown as typeof canvas.getContext;
      canvas.toDataURL = mockToDataURL;
      return canvas;
    }
    return originalCreateElement(tag);
  });

  return { mockCtx, mockGetContext, mockToDataURL };
}

describe('createHistoryEntryInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('already-loaded image element', () => {
    it('resolves immediately when image has non-zero dimensions', async () => {
      const { mockToDataURL } = mockCanvas();
      mockToDataURL.mockReturnValue('data:image/png;base64,abc');

      const img = createLoadedImage(320, 240);
      const results = { objects: [], inferenceTime: 50 };

      const result = await createHistoryEntryInput(img, 'detection', results);

      expect(result.analysisType).toBe('detection');
      expect(result.imageDimensions).toEqual({ width: 320, height: 240 });
      expect(result.imageDataURL).toBe('data:image/png;base64,abc');
      expect(result.results).toBe(results);
    });

    it('resolves with correct dimensions for classification results', async () => {
      mockCanvas();
      const img = createLoadedImage(800, 600);
      const results = { predictions: [], inferenceTime: 60, timestamp: '', imageDimensions: { width: 800, height: 600 } };

      const result = await createHistoryEntryInput(img, 'classification', results);
      expect(result.imageDimensions).toEqual({ width: 800, height: 600 });
      expect(result.analysisType).toBe('classification');
    });

    it('resolves correctly for OCR results', async () => {
      mockCanvas();
      const img = createLoadedImage(1024, 768);
      const results = { textRegions: [], fullText: '', processingTime: 500, timestamp: '', imageDimensions: { width: 1024, height: 768 }, language: 'eng' };

      const result = await createHistoryEntryInput(img, 'ocr', results);
      expect(result.imageDimensions).toEqual({ width: 1024, height: 768 });
      expect(result.analysisType).toBe('ocr');
    });
  });

  describe('already-loaded video element', () => {
    it('resolves immediately for a loaded video element', async () => {
      const { mockToDataURL } = mockCanvas();
      mockToDataURL.mockReturnValue('data:image/png;base64,videodata');

      const video = createLoadedVideo(640, 480);
      const results = { objects: [], inferenceTime: 30 };

      const result = await createHistoryEntryInput(video, 'detection', results);
      expect(result.imageDimensions).toEqual({ width: 640, height: 480 });
      expect(result.imageDataURL).toBe('data:image/png;base64,videodata');
    });
  });

  describe('unloaded image element', () => {
    it('waits for load event when image dimensions are zero', async () => {
      mockCanvas();
      const img = document.createElement('img');
      // naturalWidth/naturalHeight default to 0 on unloaded img

      const results = { objects: [], inferenceTime: 50 };
      const promise = createHistoryEntryInput(img, 'detection', results);

      // Simulate load event - first set dimensions then fire load
      Object.defineProperty(img, 'naturalWidth', { value: 320, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: 240, configurable: true });
      img.dispatchEvent(new Event('load'));

      const result = await promise;
      expect(result.imageDimensions).toEqual({ width: 320, height: 240 });
    });

    it('waits for loadedmetadata event for unloaded video', async () => {
      mockCanvas();
      const video = document.createElement('video');
      // videoWidth/videoHeight default to 0

      const results = { objects: [], inferenceTime: 30 };
      const promise = createHistoryEntryInput(video, 'detection', results);

      // Simulate loadedmetadata with dimensions
      Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
      Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });
      video.dispatchEvent(new Event('loadedmetadata'));

      const result = await promise;
      expect(result.imageDimensions).toEqual({ width: 640, height: 480 });
    });

    it('rejects with timeout error when image never loads', async () => {
      const img = document.createElement('img');
      const results = { objects: [], inferenceTime: 50 };

      const promise = createHistoryEntryInput(img, 'detection', results);

      // Advance 5 seconds to trigger timeout
      vi.advanceTimersByTime(5001);

      await expect(promise).rejects.toThrow('Timeout waiting for image/video to load');
    });
  });

  describe('error cases', () => {
    it('rejects when canvas context returns null', async () => {
      const img = createLoadedImage(100, 100);
      const originalCreateElement = document.createElement.bind(document);

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          const canvas = originalCreateElement('canvas') as HTMLCanvasElement;
          canvas.getContext = vi.fn().mockReturnValue(null) as unknown as typeof canvas.getContext;
          return canvas;
        }
        return originalCreateElement(tag);
      });

      const results = { objects: [], inferenceTime: 50 };
      await expect(createHistoryEntryInput(img, 'detection', results)).rejects.toThrow(
        'Failed to get canvas context'
      );
    });

    it('rejects when image dimensions are zero after load event fires', async () => {
      const img = document.createElement('img');
      // dimensions remain 0

      const results = { objects: [], inferenceTime: 50 };
      const promise = createHistoryEntryInput(img, 'detection', results);

      // Fire load event without updating dimensions
      img.dispatchEvent(new Event('load'));

      await expect(promise).rejects.toThrow('dimensions are zero');
    });
  });
});
