/**
 * History Type Definitions
 *
 * Schema for analysis history entries stored in localStorage.
 * Supports automatic saving of analysis results with FIFO eviction.
 *
 * @module lib/types/history
 */

import type { AnalysisMode, DetectionResult, ClassificationAnalysis, OCRAnalysis } from './analysis';

// ============================================================================
// History Entry Schema
// ============================================================================

/**
 * A single history entry representing a completed analysis
 */
export interface HistoryEntry {
  /** Unique identifier (UUID) */
  id: string;
  /** ISO 8601 timestamp when analysis was completed */
  timestamp: string;
  /** Type of analysis performed */
  analysisType: AnalysisMode;
  /** Base64 encoded original image (compressed for storage) */
  imageDataURL: string;
  /** Analysis results */
  results: DetectionResult | ClassificationAnalysis | OCRAnalysis;
  /** Original image dimensions */
  imageDimensions: {
    width: number;
    height: number;
  };
}

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

  return (
    typeof e.id === 'string' &&
    typeof e.timestamp === 'string' &&
    (e.analysisType === 'detection' || e.analysisType === 'classification' || e.analysisType === 'ocr') &&
    typeof e.imageDataURL === 'string' &&
    e.results !== null &&
    typeof e.results === 'object' &&
    e.imageDimensions !== null &&
    typeof e.imageDimensions === 'object' &&
    typeof e.imageDimensions.width === 'number' &&
    typeof e.imageDimensions.height === 'number'
  );
}

/**
 * Filter and validate an array of history entries
 */
export function validateHistoryEntries(entries: unknown[]): HistoryEntry[] {
  return entries.filter(isValidHistoryEntry);
}
