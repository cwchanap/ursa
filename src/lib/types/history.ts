/**
 * History Type Definitions
 *
 * Schema for analysis history entries stored in localStorage.
 * Supports automatic saving of analysis results with FIFO eviction.
 *
 * @module lib/types/history
 */

import type {
  DetectionResult,
  ClassificationAnalysis,
  OCRAnalysis,
} from './analysis';

// ============================================================================
// History Entry Schema
// ============================================================================

/**
 * A single history entry representing a completed analysis
 * Discriminated union based on analysisType - prevents invalid type combinations at compile time
 */
export type HistoryEntry =
  | {
      id: string;
      timestamp: string;
      analysisType: 'detection';
      imageDataURL: string;
      results: DetectionResult;
      imageDimensions: {
        width: number;
        height: number;
      };
    }
  | {
      id: string;
      timestamp: string;
      analysisType: 'classification';
      imageDataURL: string;
      results: ClassificationAnalysis;
      imageDimensions: {
        width: number;
        height: number;
      };
    }
  | {
      id: string;
      timestamp: string;
      analysisType: 'ocr';
      imageDataURL: string;
      results: OCRAnalysis;
      imageDimensions: {
        width: number;
        height: number;
      };
    };

/**
 * Input for creating a new history entry (id and timestamp auto-generated)
 */
export type HistoryEntryInput = Omit<HistoryEntry, 'id' | 'timestamp'>;

/**
 * History state for the store
 */
export interface HistoryState {
  entries: HistoryEntry[];
  selectedEntryId: string | null;
}

// ============================================================================
// Constants
// ============================================================================

export const HISTORY_STORAGE_KEY = 'ursa-history';
export const HISTORY_MAX_ENTRIES = 10;

/** Maximum thumbnail width for storage optimization */
export const HISTORY_THUMBNAIL_MAX_WIDTH = 400;

/** JPEG quality for compressed thumbnails (0-1) */
export const HISTORY_THUMBNAIL_QUALITY = 0.7;

// ============================================================================
// Initial State
// ============================================================================

export const INITIAL_HISTORY_STATE: HistoryState = {
  entries: [],
  selectedEntryId: null,
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a result is a DetectionResult
 */
export function isDetectionResult(
  result: DetectionResult | ClassificationAnalysis | OCRAnalysis
): result is DetectionResult {
  return 'objects' in result && Array.isArray(result.objects);
}

/**
 * Check if a result is a ClassificationAnalysis
 */
export function isClassificationResult(
  result: DetectionResult | ClassificationAnalysis | OCRAnalysis
): result is ClassificationAnalysis {
  return 'predictions' in result && Array.isArray(result.predictions);
}

/**
 * Check if a result is an OCRAnalysis
 */
export function isOCRResult(
  result: DetectionResult | ClassificationAnalysis | OCRAnalysis
): result is OCRAnalysis {
  return 'textRegions' in result && 'fullText' in result;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a history entry structure
 */
export function isValidHistoryEntry(entry: unknown): entry is HistoryEntry {
  if (!entry || typeof entry !== 'object') return false;

  const e = entry as Partial<HistoryEntry>;

  // Basic field validation
  if (
    typeof e.id !== 'string' ||
    typeof e.timestamp !== 'string' ||
    (e.analysisType !== 'detection' &&
      e.analysisType !== 'classification' &&
      e.analysisType !== 'ocr') ||
    typeof e.imageDataURL !== 'string' ||
    !e.results ||
    typeof e.results !== 'object' ||
    !e.imageDimensions ||
    typeof e.imageDimensions !== 'object' ||
    typeof e.imageDimensions.width !== 'number' ||
    typeof e.imageDimensions.height !== 'number'
  ) {
    return false;
  }

  // Type-specific validation based on analysisType
  const results = e.results as DetectionResult | ClassificationAnalysis | OCRAnalysis;

  if (e.analysisType === 'detection') {
    // Must have objects array with proper structure
    return (
      'objects' in results &&
      Array.isArray(results.objects) &&
      results.objects.every(
        (obj) =>
          typeof obj === 'object' &&
          obj !== null &&
          'class' in obj &&
          'score' in obj &&
          'bbox' in obj &&
          Array.isArray(obj.bbox) &&
          obj.bbox.length === 4
      )
    );
  }

  if (e.analysisType === 'classification') {
    // Must have predictions array
    return (
      'predictions' in results &&
      Array.isArray(results.predictions) &&
      results.predictions.every(
        (pred) =>
          typeof pred === 'object' && pred !== null && 'label' in pred && 'confidence' in pred
      )
    );
  }

  if (e.analysisType === 'ocr') {
    // Must have textRegions and fullText
    return (
      'textRegions' in results && 'fullText' in results && typeof results.fullText === 'string'
    );
  }

  return false;
}

/**
 * Filter and validate an array of history entries
 */
export function validateHistoryEntries(entries: unknown): HistoryEntry[] {
  // Guard against non-array inputs
  if (!Array.isArray(entries)) {
    return [];
  }

  return (entries as unknown[]).filter(isValidHistoryEntry) as HistoryEntry[];
}
