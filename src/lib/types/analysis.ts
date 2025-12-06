/**
 * Type definitions for Image Classification and OCR Support
 *
 * Based on contracts/analysis-api.ts
 * @module lib/types/analysis
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
// Classification Types
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

// ============================================================================
// OCR Types
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

// ============================================================================
// Detection Types (from existing objectDetection.ts)
// ============================================================================

/**
 * DetectedObject from existing objectDetection.ts
 */
export interface DetectedObject {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

/**
 * DetectionResult from existing objectDetection.ts
 */
export interface DetectionResult {
  objects: DetectedObject[];
  inferenceTime: number;
}

// ============================================================================
// State Management Types
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
    detection: DetectionResult | null;
    classification: ClassificationAnalysis | null;
    ocr: OCRAnalysis | null;
  };

  /** Currently loaded media element */
  mediaElement: HTMLImageElement | HTMLVideoElement | null;

  /** Video stream state (null for static images) */
  videoStream: {
    isActive: boolean;
    fps: number; // Target FPS for real-time analysis
    analysisInterval: ReturnType<typeof setInterval> | null; // setInterval ID
  } | null;
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * ImageClassification service interface
 */
export interface IImageClassificationService {
  initialize(): Promise<void>;
  classify(request: ClassifyImageRequest): Promise<ClassificationAnalysis>;
  getStatus(): ProcessingStatus;
  isReady(): boolean;
  dispose(): Promise<void>;
}

/**
 * OCRExtraction service interface
 */
export interface IOCRExtractionService {
  initialize(language?: string): Promise<void>;
  extractText(request: ExtractTextRequest): Promise<OCRAnalysis>;
  getStatus(): ProcessingStatus;
  isReady(): boolean;
  loadLanguage(language: string): Promise<void>;
  dispose(): Promise<void>;
}

// ============================================================================
// UI Component Props
// ============================================================================

/**
 * Props for AnalysisModeTabs component
 */
export interface AnalysisModeTabsProps {
  activeMode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
}

/**
 * Props for ClassificationResults component
 */
export interface ClassificationResultsProps {
  analysis: ClassificationAnalysis | null;
  processing: ProcessingState;
}

/**
 * Props for OCRResults component
 */
export interface OCRResultsProps {
  analysis: OCRAnalysis | null;
  processing: ProcessingState;
  onCopyText?: (text: string) => void;
}

/**
 * Props for OCROverlay component
 */
export interface OCROverlayProps {
  textRegions: OCRResult[];
  imageElement: HTMLImageElement | HTMLVideoElement;
  canvasElement: HTMLCanvasElement;
  visible: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Bounding box in normalized coordinates (0-1)
 */
export interface NormalizedBBox {
  x: number; // 0-1 (relative to image width)
  y: number; // 0-1 (relative to image height)
  width: number; // 0-1
  height: number; // 0-1
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Analysis mode constants
 */
export const ANALYSIS_MODES = {
  DETECTION: 'detection' as const,
  CLASSIFICATION: 'classification' as const,
  OCR: 'ocr' as const,
} as const;

/**
 * Default initial state for analysis
 */
export const INITIAL_ANALYSIS_STATE: AnalysisState = {
  activeMode: 'detection',
  processing: {
    detection: { status: 'idle' },
    classification: { status: 'idle' },
    ocr: { status: 'idle' },
  },
  results: {
    detection: null,
    classification: null,
    ocr: null,
  },
  mediaElement: null,
  videoStream: null,
};
