/**
 * API Contract: Image Classification and OCR Analysis
 *
 * This file defines the TypeScript interfaces for client-side analysis APIs.
 * Since Ursa is a browser-only application with no backend, these are
 * internal module contracts between UI components and ML service classes.
 *
 * @module contracts/analysis-api
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Analysis mode enum - determines which ML model is active
 */
export type AnalysisMode = 'detection' | 'classification' | 'ocr';

/**
 * Processing status for async operations
 */
export type ProcessingStatus = 'idle' | 'loading' | 'processing' | 'complete' | 'error';

/**
 * Processing state with optional progress tracking
 */
export interface ProcessingState {
  status: ProcessingStatus;
  message?: string; // User-friendly status or error message
  progress?: number; // 0-100 for model loading
}

// ============================================================================
// Classification Contracts
// ============================================================================

/**
 * Input: Image element to classify
 */
export interface ClassifyImageRequest {
  /** HTML image or video element containing the image to classify */
  imageElement: HTMLImageElement | HTMLVideoElement;

  /** Optional: Override default top-K results (default: 5) */
  topK?: number;
}

/**
 * Output: Single classification prediction
 */
export interface ClassificationResult {
  /** Human-readable label (e.g., "golden retriever", "beach") */
  label: string;

  /** Confidence score 0.0-1.0 */
  confidence: number;

  /** Optional: ImageNet class ID for debugging */
  classId?: string;
}

/**
 * Output: Complete classification analysis
 */
export interface ClassificationAnalysis {
  /** Top K predictions (default: 5), sorted by confidence descending */
  predictions: ClassificationResult[];

  /** Inference time in milliseconds */
  inferenceTime: number;

  /** Analysis completion timestamp (ISO 8601) */
  timestamp: string;

  /** Source image dimensions */
  imageDimensions: {
    width: number;
    height: number;
  };
}

/**
 * ImageClassification service interface
 * Implemented by: src/lib/imageClassification.ts
 */
export interface IImageClassificationService {
  /**
   * Initialize MobileNetV2 model
   * @throws Error if model fails to load
   */
  initialize(): Promise<void>;

  /**
   * Classify an image and return top-K predictions
   * @param request - Image element and optional parameters
   * @returns Classification analysis with top-K results
   * @throws Error if model not initialized or inference fails
   */
  classify(request: ClassifyImageRequest): Promise<ClassificationAnalysis>;

  /**
   * Get current model loading/initialization status
   */
  getStatus(): ProcessingStatus;

  /**
   * Check if model is ready for inference
   */
  isReady(): boolean;

  /**
   * Dispose of model and free memory
   */
  dispose(): Promise<void>;
}

// ============================================================================
// OCR Contracts
// ============================================================================

/**
 * Input: Image element for OCR processing
 */
export interface ExtractTextRequest {
  /** HTML image or video element containing text to extract */
  imageElement: HTMLImageElement | HTMLVideoElement;

  /** Language code(s) for OCR (e.g., "eng", "eng+spa") */
  language?: string;

  /** Minimum confidence threshold 0-100 (default: 50) */
  minConfidence?: number;
}

/**
 * Output: Single recognized text region
 */
export interface OCRResult {
  /** Extracted text content */
  text: string;

  /** Tesseract.js confidence 0-100 */
  confidence: number;

  /** Bounding box coordinates in pixels (relative to source image) */
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Text language code (ISO 639-2) */
  lang?: string;
}

/**
 * Output: Complete OCR analysis
 */
export interface OCRAnalysis {
  /** Recognized text regions (sorted by reading order) */
  textRegions: OCRResult[];

  /** Full text concatenated with newlines */
  fullText: string;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Analysis completion timestamp (ISO 8601) */
  timestamp: string;

  /** Source image dimensions (for bounding box scaling) */
  imageDimensions: {
    width: number;
    height: number;
  };

  /** Language pack used */
  language: string;
}

/**
 * OCRExtraction service interface
 * Implemented by: src/lib/ocrExtraction.ts
 */
export interface IOCRExtractionService {
  /**
   * Initialize Tesseract.js worker with default language pack
   * @param language - Language code (default: "eng")
   * @throws Error if worker fails to initialize
   */
  initialize(language?: string): Promise<void>;

  /**
   * Extract text from an image
   * @param request - Image element and optional parameters
   * @returns OCR analysis with recognized text regions
   * @throws Error if worker not initialized or recognition fails
   */
  extractText(request: ExtractTextRequest): Promise<OCRAnalysis>;

  /**
   * Get current worker initialization status
   */
  getStatus(): ProcessingStatus;

  /**
   * Check if worker is ready for OCR
   */
  isReady(): boolean;

  /**
   * Load additional language pack
   * @param language - Language code to load
   */
  loadLanguage(language: string): Promise<void>;

  /**
   * Terminate worker and free memory
   */
  dispose(): Promise<void>;
}

// ============================================================================
// State Management Contracts
// ============================================================================

/**
 * Global analysis state (Svelte store)
 */
export interface AnalysisState {
  /** Currently active analysis mode */
  activeMode: AnalysisMode;

  /** Processing states for each mode */
  processing: {
    detection: ProcessingState;
    classification: ProcessingState;
    ocr: ProcessingState;
  };

  /** Analysis results (null when no analysis run) */
  results: {
    detection: DetectionResult | null; // From existing objectDetection.ts
    classification: ClassificationAnalysis | null;
    ocr: OCRAnalysis | null;
  };

  /** Currently loaded media element */
  mediaElement: HTMLImageElement | HTMLVideoElement | null;

  /** Video stream state (null for static images) */
  videoStream: {
    isActive: boolean;
    fps: number; // Target FPS for real-time analysis
    analysisInterval: number | null; // setInterval ID
  } | null;
}

/**
 * DetectionResult from existing objectDetection.ts
 * Included for completeness
 */
export interface DetectedObject {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

export interface DetectionResult {
  objects: DetectedObject[];
  inferenceTime: number;
}

/**
 * State management actions
 * Implemented by: src/lib/analysisState.ts
 */
export interface IAnalysisStateActions {
  /** Switch active analysis mode */
  setActiveMode(mode: AnalysisMode): void;

  /** Update processing status for a mode */
  setProcessingStatus(mode: AnalysisMode, state: ProcessingState): void;

  /** Store analysis results for a mode */
  setResults(
    mode: 'detection',
    results: DetectionResult
  ): void;
  setResults(
    mode: 'classification',
    results: ClassificationAnalysis
  ): void;
  setResults(
    mode: 'ocr',
    results: OCRAnalysis
  ): void;

  /** Clear results for a specific mode */
  clearResults(mode: AnalysisMode): void;

  /** Clear results for all modes */
  clearAllResults(): void;

  /** Set the current media element */
  setMediaElement(element: HTMLImageElement | HTMLVideoElement): void;

  /** Start real-time video analysis */
  startVideoStream(fps: number): void;

  /** Stop real-time video analysis */
  stopVideoStream(): void;
}

// ============================================================================
// UI Component Contracts
// ============================================================================

/**
 * Props for AnalysisModeTabs component
 */
export interface AnalysisModeTabsProps {
  /** Current active mode (controlled component) */
  activeMode: AnalysisMode;

  /** Callback when user switches tabs */
  onModeChange: (mode: AnalysisMode) => void;
}

/**
 * Props for ClassificationResults component
 */
export interface ClassificationResultsProps {
  /** Classification analysis to display (null = no results) */
  analysis: ClassificationAnalysis | null;

  /** Processing state for loading/error UI */
  processing: ProcessingState;
}

/**
 * Props for OCRResults component
 */
export interface OCRResultsProps {
  /** OCR analysis to display (null = no results) */
  analysis: OCRAnalysis | null;

  /** Processing state for loading/error UI */
  processing: ProcessingState;

  /** Callback when user copies text to clipboard */
  onCopyText?: (text: string) => void;
}

/**
 * Props for OCROverlay component (canvas overlay for bounding boxes)
 */
export interface OCROverlayProps {
  /** OCR results with bounding boxes */
  textRegions: OCRResult[];

  /** Source image element (for coordinate scaling) */
  imageElement: HTMLImageElement | HTMLVideoElement;

  /** Canvas element to draw on */
  canvasElement: HTMLCanvasElement;

  /** Show/hide overlay */
  visible: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Bounding box in normalized coordinates (0-1)
 * Used for coordinate-independent bounding box calculations
 */
export interface NormalizedBBox {
  x: number; // 0-1 (relative to image width)
  y: number; // 0-1 (relative to image height)
  width: number; // 0-1
  height: number; // 0-1
}

/**
 * Convert pixel bbox to normalized bbox
 */
export function normalizeBBox(
  bbox: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
): NormalizedBBox {
  return {
    x: bbox.x / imageWidth,
    y: bbox.y / imageHeight,
    width: bbox.width / imageWidth,
    height: bbox.height / imageHeight,
  };
}

/**
 * Convert normalized bbox to pixel bbox
 */
export function denormalizeBBox(
  bbox: NormalizedBBox,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: bbox.x * imageWidth,
    y: bbox.y * imageHeight,
    width: bbox.width * imageWidth,
    height: bbox.height * imageHeight,
  };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error for analysis failures
 */
export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly mode: AnalysisMode
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

/**
 * Error thrown when model fails to load
 */
export class ModelLoadError extends AnalysisError {
  constructor(mode: AnalysisMode, reason: string) {
    super(
      `Failed to load ${mode} model: ${reason}`,
      'MODEL_LOAD_FAILED',
      mode
    );
    this.name = 'ModelLoadError';
  }
}

/**
 * Error thrown when inference fails
 */
export class InferenceError extends AnalysisError {
  constructor(mode: AnalysisMode, reason: string) {
    super(
      `${mode} inference failed: ${reason}`,
      'INFERENCE_FAILED',
      mode
    );
    this.name = 'InferenceError';
  }
}

/**
 * Error thrown when worker fails (Tesseract.js)
 */
export class WorkerError extends AnalysisError {
  constructor(reason: string) {
    super(
      `OCR worker error: ${reason}`,
      'WORKER_FAILED',
      'ocr'
    );
    this.name = 'WorkerError';
  }
}
