/**
 * Image Classification Service
 *
 * Wraps TensorFlow.js MobileNetV2 model for image classification.
 * Returns top-5 predictions with confidence scores.
 *
 * @module lib/imageClassification
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as mobilenet from '@tensorflow-models/mobilenet';
import type {
  ClassificationAnalysis,
  ClassificationResult,
  ClassifyImageRequest,
  ProcessingStatus,
  IImageClassificationService,
} from '@/lib/types/analysis';
import { ModelLoadError, InferenceError, WebGLError } from '@/lib/errors/analysisErrors';

export interface ClassificationOptions {
  /** Number of top predictions to return (default: 5) */
  topK?: number;
  /** Minimum confidence threshold 0-1 (default: 0.01) */
  minConfidence?: number;
  /** Show performance timing in console (default: false in production) */
  debug?: boolean;
}

export class ImageClassification implements IImageClassificationService {
  private model: mobilenet.MobileNet | null = null;
  private status: ProcessingStatus = 'idle';
  private options: Required<ClassificationOptions>;
  private initializingPromise: Promise<void> | null = null;

  constructor(options: ClassificationOptions = {}) {
    this.options = {
      topK: options.topK ?? 5,
      minConfidence: options.minConfidence ?? 0.01,
      debug: options.debug ?? false,
    };
  }

  /**
   * Initialize TensorFlow.js and load the MobileNetV2 model
   */
  async initialize(): Promise<void> {
    // If already initializing, wait for the existing promise
    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    // Already initialized
    if (this.model) {
      return;
    }

    // Create and store the initialization promise
    this.initializingPromise = (async () => {
      this.status = 'loading';

      try {
        // Clear any previous performance marks/measures to prevent accumulation
        performance.clearMarks('mobilenet-load-start');
        performance.clearMarks('mobilenet-load-end');
        performance.clearMeasures('mobilenet-load');

        // Performance mark for model loading
        performance.mark('mobilenet-load-start');

        // Set TensorFlow.js backend
        await tf.setBackend('webgl');
        await tf.ready();

        // Verify WebGL is available
        const backend = tf.getBackend();
        if (backend !== 'webgl') {
          throw new WebGLError('classification');
        }

        // Load MobileNetV2 model (version 2, alpha 1.0 for best accuracy)
        this.model = await mobilenet.load({
          version: 2,
          alpha: 1.0,
        });

        this.status = 'idle';

        // Performance measurement
        performance.mark('mobilenet-load-end');
        performance.measure('mobilenet-load', 'mobilenet-load-start', 'mobilenet-load-end');

        if (this.options.debug) {
          const entries = performance.getEntriesByName('mobilenet-load');
          const measure = entries[entries.length - 1]; // Use latest entry
          if (measure) {
            console.log(`MobileNetV2 loaded in ${measure.duration.toFixed(0)}ms`);
          }
        }
      } catch (error) {
        this.status = 'error';

        if (error instanceof WebGLError) {
          throw error;
        }

        const message = error instanceof Error ? error.message : String(error);
        throw new ModelLoadError('classification', message);
      } finally {
        // Clear the promise so future calls can retry if needed
        this.initializingPromise = null;
      }
    })();

    return this.initializingPromise;
  }

  /**
   * Classify an image and return top-K predictions
   */
  async classify(request: ClassifyImageRequest): Promise<ClassificationAnalysis> {
    const { imageElement, topK = this.options.topK } = request;

    if (!this.model) {
      // Auto-initialize if not already done
      await this.initialize();
    }

    if (!this.model) {
      throw new ModelLoadError('classification', 'Model failed to initialize');
    }

    this.status = 'processing';

    try {
      // Performance mark for inference
      const startTime = performance.now();
      performance.mark('classification-inference-start');

      // Run classification
      const predictions: Array<{ className: string; probability: number }> = await this.model.classify(
        imageElement,
        topK
      );

      const inferenceTime = performance.now() - startTime;

      // Performance measurement
      performance.mark('classification-inference-end');
      performance.measure(
        'classification-inference',
        'classification-inference-start',
        'classification-inference-end'
      );

      if (this.options.debug) {
        const timeStr = `Classification inference: ${inferenceTime.toFixed(0)}ms`;
        const isBrowser = typeof window !== 'undefined';

        if (isBrowser) {
          // Browser-friendly CSS styling
          const cssColor = inferenceTime < 60 ? 'green' : inferenceTime < 100 ? 'orange' : 'red';
          console.log(`%c${timeStr}`, `color: ${cssColor}`);
        } else {
          // Terminal ANSI escape sequences for Node/CLI
          const ansiColor =
            inferenceTime < 60 ? '\x1b[32m' : inferenceTime < 100 ? '\x1b[33m' : '\x1b[31m';
          console.log(`${ansiColor}${timeStr}\x1b[0m`);
        }
      }

      // Transform predictions to our format
      const results: ClassificationResult[] = predictions
        .filter((p) => p.probability >= this.options.minConfidence)
        .map((p) => ({
          label: p.className,
          confidence: p.probability,
          classId: undefined, // MobileNet doesn't expose class IDs directly
        }));

      // Get image dimensions
      const width =
        imageElement instanceof HTMLVideoElement
          ? imageElement.videoWidth
          : imageElement.naturalWidth || imageElement.width;
      const height =
        imageElement instanceof HTMLVideoElement
          ? imageElement.videoHeight
          : imageElement.naturalHeight || imageElement.height;

      this.status = 'complete';

      return {
        predictions: results,
        inferenceTime,
        timestamp: new Date().toISOString(),
        imageDimensions: { width, height },
      };
    } catch (error) {
      this.status = 'error';
      const message = error instanceof Error ? error.message : String(error);
      throw new InferenceError('classification', message);
    }
  }

  /**
   * Start continuous classification on a video stream
   *
   * @param videoElement - Video element to classify
   * @param onResult - Callback for each classification result
   * @param fps - Target frames per second (default: 5)
   * @returns Stop function to end continuous classification
   */
  startVideoClassification(
    videoElement: HTMLVideoElement,
    onResult: (result: ClassificationAnalysis) => void,
    fps = 5
  ): () => void {
    let isRunning = true;
    let rafId: number | null = null;
    let lastFrameTime = 0;
    const frameInterval = 1000 / fps;

    const classifyFrame = async (timestamp: number) => {
      if (!isRunning) return;

      // Throttle to target FPS
      if (timestamp - lastFrameTime >= frameInterval) {
        lastFrameTime = timestamp;

        // Only classify if not currently processing
        if (this.status !== 'processing') {
          try {
            const result = await this.classify({ imageElement: videoElement });
            onResult(result);
          } catch (error) {
            console.error('Video classification error:', error);
          }
        }
      }

      rafId = requestAnimationFrame(classifyFrame);
    };

    rafId = requestAnimationFrame(classifyFrame);

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
   * Check if model is ready for inference
   */
  isReady(): boolean {
    return this.model !== null && this.status !== 'loading' && this.status !== 'error';
  }

  /**
   * Update classification options
   */
  updateOptions(newOptions: Partial<ClassificationOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Dispose of the model and free memory
   */
  async dispose(): Promise<void> {
    if (this.model) {
      // MobileNet model cleanup - dispose method exists but isn't in types
      const model = this.model as unknown as { dispose?: () => void };
      if (model.dispose) {
        model.dispose();
      }
      this.model = null;
    }
    this.status = 'idle';

    if (this.options.debug) {
      console.log('ImageClassification model disposed');
    }
  }
}

// Create a singleton instance for global use
export const imageClassifier = new ImageClassification({
  debug: typeof window !== 'undefined' && window.location.hostname === 'localhost',
});
