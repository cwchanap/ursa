/**
 * OCR Extraction Service
 *
 * Wraps Tesseract.js for optical character recognition.
 * Returns recognized text with bounding boxes and confidence scores.
 *
 * @module lib/ocrExtraction
 */

import { createWorker, type Worker } from 'tesseract.js';
import type {
  OCRAnalysis,
  OCRResult,
  ExtractTextRequest,
  ProcessingStatus,
  IOCRExtractionService,
} from './types/analysis';
import { ModelLoadError, InferenceError, WorkerError, WebAssemblyError, LanguagePackError } from './errors/analysisErrors';
import { sortByReadingOrder } from './utils/bboxUtils';

export interface OCROptions {
  /** Default language for OCR (default: 'eng') */
  defaultLanguage?: string;
  /** Minimum confidence threshold 0-100 (default: 50) */
  minConfidence?: number;
  /** Show performance timing in console (default: false in production) */
  debug?: boolean;
}

export class OCRExtraction implements IOCRExtractionService {
  private worker: Worker | null = null;
  private status: ProcessingStatus = 'idle';
  private currentLanguage: string;
  private options: Required<OCROptions>;

  constructor(options: OCROptions = {}) {
    this.options = {
      defaultLanguage: options.defaultLanguage ?? 'eng',
      minConfidence: options.minConfidence ?? 50,
      debug: options.debug ?? false,
    };
    this.currentLanguage = this.options.defaultLanguage;
  }

  /**
   * Check if WebAssembly is supported
   */
  private checkWebAssemblySupport(): boolean {
    try {
      if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
        const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
        if (module instanceof WebAssembly.Module) {
          return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
        }
      }
    } catch {
      return false;
    }
    return false;
  }

  /**
   * Initialize Tesseract.js worker with specified language
   */
  async initialize(language?: string): Promise<void> {
    if (this.status === 'loading' || this.status === 'processing') {
      return;
    }

    if (this.worker) {
      return; // Already initialized
    }

    // Check WebAssembly support
    if (!this.checkWebAssemblySupport()) {
      throw new WebAssemblyError();
    }

    this.status = 'loading';
    const lang = language ?? this.options.defaultLanguage;

    try {
      // Performance mark for worker initialization
      performance.mark('tesseract-init-start');

      // Create Tesseract worker with language
      this.worker = await createWorker(lang, 1, {
        logger: this.options.debug
          ? (m) => {
              if (m.status === 'loading tesseract core' || m.status === 'loading language traineddata') {
                console.log(`Tesseract: ${m.status} (${Math.round((m.progress ?? 0) * 100)}%)`);
              }
            }
          : undefined,
      });

      this.currentLanguage = lang;
      this.status = 'idle';

      // Performance measurement
      performance.mark('tesseract-init-end');
      performance.measure('tesseract-init', 'tesseract-init-start', 'tesseract-init-end');

      if (this.options.debug) {
        const measure = performance.getEntriesByName('tesseract-init')[0];
        console.log(`Tesseract.js worker initialized in ${measure.duration.toFixed(0)}ms`);
      }
    } catch (error) {
      this.status = 'error';
      const message = error instanceof Error ? error.message : String(error);
      throw new ModelLoadError('ocr', message);
    }
  }

  /**
   * Extract text from an image
   */
  async extractText(request: ExtractTextRequest): Promise<OCRAnalysis> {
    const { imageElement, language, minConfidence = this.options.minConfidence } = request;

    // Auto-initialize if not already done
    if (!this.worker) {
      await this.initialize(language);
    }

    // Load different language if requested
    if (language && language !== this.currentLanguage) {
      await this.loadLanguage(language);
    }

    if (!this.worker) {
      throw new WorkerError('Worker failed to initialize');
    }

    this.status = 'processing';

    try {
      // Performance mark for OCR processing
      const startTime = performance.now();
      performance.mark('ocr-process-start');

      // Run OCR recognition
      const result = await this.worker.recognize(imageElement);

      const processingTime = performance.now() - startTime;

      // Performance measurement
      performance.mark('ocr-process-end');
      performance.measure('ocr-process', 'ocr-process-start', 'ocr-process-end');

      if (this.options.debug) {
        const color = processingTime < 2000 ? '\x1b[32m' : processingTime < 3000 ? '\x1b[33m' : '\x1b[31m';
        console.log(`${color}OCR processing: ${processingTime.toFixed(0)}ms\x1b[0m`);
      }

      // Transform Tesseract results to our format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = result.data as any;
      const words = data.words || [];
      
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const textRegions: OCRResult[] = words
        .filter((word: any) => word.confidence >= minConfidence)
        .map((word: any) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox
            ? {
                x: word.bbox.x0,
                y: word.bbox.y0,
                width: word.bbox.x1 - word.bbox.x0,
                height: word.bbox.y1 - word.bbox.y0,
              }
            : undefined,
          lang: this.currentLanguage,
        }));
      /* eslint-enable @typescript-eslint/no-explicit-any */

      // Sort by reading order (top-to-bottom, left-to-right)
      const sortedRegions = sortByReadingOrder(textRegions);

      // Get image dimensions
      const width =
        imageElement instanceof HTMLVideoElement
          ? imageElement.videoWidth
          : imageElement.naturalWidth || imageElement.width;
      const height =
        imageElement instanceof HTMLVideoElement
          ? imageElement.videoHeight
          : imageElement.naturalHeight || imageElement.height;

      // Build full text from sorted regions
      const fullText = this.buildFullText(sortedRegions);

      this.status = 'complete';

      return {
        textRegions: sortedRegions,
        fullText,
        processingTime,
        timestamp: new Date().toISOString(),
        imageDimensions: { width, height },
        language: this.currentLanguage,
      };
    } catch (error) {
      this.status = 'error';
      const message = error instanceof Error ? error.message : String(error);
      throw new InferenceError('ocr', message);
    }
  }

  /**
   * Build full text from sorted regions with proper line breaks
   */
  private buildFullText(regions: OCRResult[]): string {
    if (regions.length === 0) return '';

    const lines: string[][] = [];
    let currentLine: string[] = [];
    let lastY = -Infinity;
    const lineThreshold = 20; // pixels threshold for same line

    for (const region of regions) {
      const y = region.bbox?.y ?? 0;

      // Check if this is a new line
      if (y - lastY > lineThreshold && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [];
      }

      currentLine.push(region.text);
      lastY = y;
    }

    // Don't forget the last line
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines.map((line) => line.join(' ')).join('\n');
  }

  /**
   * Start continuous OCR on a video stream
   *
   * **Important:** The caller MUST invoke the returned stop function to prevent memory leaks.
   * The RAF loop continues indefinitely until explicitly stopped.
   *
   * @param videoElement - Video element to process
   * @param onResult - Callback for each OCR result
   * @param fps - Target frames per second (default: 5)
   * @returns Stop function to end continuous OCR
   *
   * @example
   * // Svelte onDestroy cleanup pattern
   * onDestroy(() => {
   *   const stop = ocrExtractor.startVideoOCR(videoElement, handleResult);
   *   return stop;
   * });
   * 
   * // Or with explicit stop function storage
   * let stopOCR: (() => void) | null = null;
   * onMount(() => {
   *   stopOCR = ocrExtractor.startVideoOCR(videoElement, handleResult);
   * });
   * onDestroy(() => {
   *   stopOCR?.();
   * });
   */
  startVideoOCR(
    videoElement: HTMLVideoElement,
    onResult: (result: OCRAnalysis) => void,
    fps = 5
  ): () => void {
    let isRunning = true;
    let rafId: number | null = null;
    let lastFrameTime = 0;
    const frameInterval = 1000 / fps;

    const processFrame = async (timestamp: number) => {
      if (!isRunning) return;

      // Throttle to target FPS
      if (timestamp - lastFrameTime >= frameInterval) {
        lastFrameTime = timestamp;

        // Only process if not currently processing
        if (this.status !== 'processing') {
          try {
            const result = await this.extractText({ imageElement: videoElement });
            onResult(result);
          } catch (error) {
            console.error('Video OCR error:', error);
          }
        }
      }

      rafId = requestAnimationFrame(processFrame);
    };

    rafId = requestAnimationFrame(processFrame);

    // Return stop function
    return () => {
      isRunning = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }

  /**
   * Get current processing status
   */
  getStatus(): ProcessingStatus {
    return this.status;
  }

  /**
   * Check if worker is ready for OCR
   */
  isReady(): boolean {
    return this.worker !== null && this.status !== 'loading' && this.status !== 'error';
  }

  /**
   * Load additional language pack
   */
  async loadLanguage(language: string): Promise<void> {
    if (!this.worker) {
      throw new WorkerError('Worker not initialized');
    }

    try {
      // Tesseract.js v5+ - need to reinitialize with new language
      // Terminate current worker and create new one
      await this.worker.terminate();
      this.worker = null;
      
      await this.initialize(language);
      
      if (this.options.debug) {
        console.log(`Language pack loaded: ${language}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new LanguagePackError(language, message);
    }
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  /**
   * Update OCR options
   *
   * Note: `defaultLanguage` cannot be changed after the worker is initialized.
   * Use `loadLanguage()` to switch languages at runtime instead.
   *
   * @param newOptions - Partial options to merge
   * @throws Error if attempting to change defaultLanguage after initialization
   */
  updateOptions(newOptions: Partial<OCROptions>): void {
    // defaultLanguage cannot be changed after worker initialization
    if (newOptions.defaultLanguage !== undefined && this.worker !== null) {
      console.warn(
        'OCRExtraction: defaultLanguage cannot be changed after initialization. ' +
        'Use loadLanguage() to switch languages at runtime.'
      );
      // Remove defaultLanguage from the update to prevent ambiguous state
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { defaultLanguage: _ignored, ...safeOptions } = newOptions;
      this.options = { ...this.options, ...safeOptions };
      return;
    }

    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Terminate worker and free memory
   */
  async dispose(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.status = 'idle';

    if (this.options.debug) {
      console.log('OCRExtraction worker disposed');
    }
  }
}

// Create a singleton instance for global use
export const ocrExtractor = new OCRExtraction({
  debug: typeof window !== 'undefined' && window.location.hostname === 'localhost',
});
