// Use global TensorFlow.js objects loaded via CDN
// import * as tf from '@tensorflow/tfjs';
// import '@tensorflow/tfjs-backend-webgl';
// import * as cocoSsd from '@tensorflow-models/coco-ssd';

// Declare global browser APIs and TensorFlow.js to avoid TypeScript errors
declare const console: Console;
declare const performance: Performance;
declare const document: Document;
declare const window: Window;
declare const setTimeout: (callback: () => void, ms: number) => number;

// Declare global TensorFlow.js objects (loaded via CDN)
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const tf: any;
declare const cocoSsd: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface DetectedObject {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

export interface DetectionResult {
  objects: DetectedObject[];
  inferenceTime: number;
}

export interface DetectionOptions {
  minScore?: number;
  maxDetections?: number;
  showLabels?: boolean;
  showScores?: boolean;
  lineWidth?: number;
  fontSize?: number;
}

export class ObjectDetection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any = null;
  private isLoading = false;
  private isInitialized = false;

  constructor(private options: DetectionOptions = {}) {
    this.options = {
      minScore: 0.5,
      maxDetections: 20,
      showLabels: true,
      showScores: true,
      lineWidth: 2,
      fontSize: 16,
      ...options,
    };
  }

  /**
   * Initialize TensorFlow.js and load the COCO-SSD model
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isLoading) {
      return;
    }

    this.isLoading = true;

    try {
      // Set TensorFlow.js backend
      await tf.setBackend('webgl');
      await tf.ready();

      // Load the COCO-SSD model
      this.model = await cocoSsd.load({
        modelUrl: undefined, // Uses default model
        base: 'lite_mobilenet_v2', // Fast and lightweight model
      });

      this.isInitialized = true;
      if (typeof console !== 'undefined') {
        console.log('Object detection model loaded successfully');
      }
    } catch (error) {
      console.error('Failed to initialize object detection:', error);
      throw new Error(`Failed to load object detection model: ${error}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Detect objects in an image or video element
   */
  async detect(
    imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  ): Promise<DetectionResult> {
    if (!this.isInitialized || !this.model) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const startTime = performance.now();

    try {
      const predictions = await this.model.detect(
        imageElement,
        this.options.maxDetections,
      );

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const objects: DetectedObject[] = predictions
        .filter((prediction: any) => prediction.score >= (this.options.minScore || 0.5))
        .map((prediction: any) => ({
          bbox: prediction.bbox,
          class: prediction.class,
          score: prediction.score,
        }));
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const inferenceTime = performance.now() - startTime;

      return {
        objects,
        inferenceTime,
      };
    } catch (error) {
      console.error('Object detection failed:', error);
      throw new Error(`Object detection failed: ${error}`);
    }
  }

  /**
   * Draw bounding boxes and labels on a canvas
   */
  drawDetections(
    canvas: HTMLCanvasElement,
    detections: DetectedObject[],
    imageWidth: number,
    imageHeight: number,
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scale factors
    const scaleX = canvas.width / imageWidth;
    const scaleY = canvas.height / imageHeight;

    ctx.font = `${this.options.fontSize}px Arial`;
    ctx.lineWidth = this.options.lineWidth || 2;

    // Generate colors for different classes
    const colorMap = new Map<string, string>();
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
    ];

    detections.forEach((detection) => {
      const [x, y, width, height] = detection.bbox;
      
      // Scale coordinates
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;

      // Get or assign color for this class
      if (!colorMap.has(detection.class)) {
        colorMap.set(detection.class, colors[colorMap.size % colors.length]);
      }
      const color = colorMap.get(detection.class)!;

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw filled rectangle for label background
      if (this.options.showLabels) {
        const label = this.options.showScores
          ? `${detection.class} ${(detection.score * 100).toFixed(0)}%`
          : detection.class;

        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const textHeight = this.options.fontSize || 16;

        // Background rectangle
        ctx.fillStyle = color;
        ctx.fillRect(
          scaledX,
          scaledY - textHeight - 4,
          textWidth + 8,
          textHeight + 4
        );

        // Text
        ctx.fillStyle = 'white';
        ctx.fillText(label, scaledX + 4, scaledY - 4);
      }
    });
  }

  /**
   * Create a canvas overlay for an image or video element
   */
  createOverlay(
    mediaElement: HTMLImageElement | HTMLVideoElement,
    container: HTMLElement,
  ): HTMLCanvasElement {
    // Remove existing overlay if present
    const existingOverlay = container.querySelector('.detection-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'detection-overlay';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '10';

    // Set canvas size to match media element
    const rect = mediaElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Make container relative if not already
    const containerStyle = window.getComputedStyle(container);
    if (containerStyle.position === 'static') {
      container.style.position = 'relative';
    }

    container.appendChild(canvas);
    return canvas;
  }

  /**
   * Process an image and draw detections
   */
  async processImage(
    imageElement: HTMLImageElement,
    container: HTMLElement,
  ): Promise<DetectionResult> {
    const result = await this.detect(imageElement);
    const canvas = this.createOverlay(imageElement, container);
    
    this.drawDetections(
      canvas,
      result.objects,
      imageElement.naturalWidth,
      imageElement.naturalHeight
    );

    return result;
  }

  /**
   * Process a video frame and draw detections
   */
  async processVideoFrame(
    videoElement: HTMLVideoElement,
    container: HTMLElement,
  ): Promise<DetectionResult> {
    const result = await this.detect(videoElement);
    const canvas = this.createOverlay(videoElement, container);
    
    this.drawDetections(
      canvas,
      result.objects,
      videoElement.videoWidth,
      videoElement.videoHeight
    );

    return result;
  }

  /**
   * Start continuous detection on a video stream
   */
  startVideoDetection(
    videoElement: HTMLVideoElement,
    container: HTMLElement,
    onDetection?: (result: DetectionResult) => void,
    fps = 10,
  ): () => void {
    let isRunning = true;
    const interval = 1000 / fps;

    const detectFrame = async () => {
      if (!isRunning) return;

      try {
        const result = await this.processVideoFrame(videoElement, container);
        onDetection?.(result);
      } catch (error) {
        console.error('Video detection error:', error);
      }

      setTimeout(detectFrame, interval);
    };

    detectFrame();

    // Return stop function
    return () => {
      isRunning = false;
    };
  }

  /**
   * Update detection options
   */
  updateOptions(newOptions: Partial<DetectionOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current initialization status
   */
  getStatus(): {
    isInitialized: boolean;
    isLoading: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      isLoading: this.isLoading,
    };
  }

  /**
   * Dispose of the model and free memory
   */
  dispose(): void {
    if (this.model) {
      this.model = null;
    }
    this.isInitialized = false;
    this.isLoading = false;
  }
}

// Create a singleton instance for global use
export const objectDetector = new ObjectDetection();