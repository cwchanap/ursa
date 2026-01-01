/**
 * Export Type Definitions
 *
 * Types for export functionality including annotated images,
 * JSON results, and text extraction.
 *
 * @module lib/types/export
 */

import type { AnalysisMode } from './analysis';

// ============================================================================
// Export Options
// ============================================================================

/**
 * Supported export formats
 */
export type ExportFormat = 'png' | 'jpg' | 'json' | 'txt';

/**
 * Options for image export
 */
export interface ImageExportOptions {
  /** Image format (default: 'png') */
  format?: 'png' | 'jpg';
  /** JPEG quality 0-1 (default: 0.92) */
  quality?: number;
  /** Custom filename (auto-generated if not provided) */
  filename?: string;
  /** Include analysis overlays on image (default: true) */
  includeOverlay?: boolean;
}

/**
 * Options for JSON export
 */
export interface JSONExportOptions {
  /** Custom filename (auto-generated if not provided) */
  filename?: string;
  /** Pretty print JSON (default: true) */
  prettyPrint?: boolean;
}

/**
 * Options for text export (OCR only)
 */
export interface TextExportOptions {
  /** Custom filename (auto-generated if not provided) */
  filename?: string;
}

// ============================================================================
// Export Results
// ============================================================================

/**
 * Result of an export operation
 */
export interface ExportResult {
  /** Whether export succeeded */
  success: boolean;
  /** Generated or provided filename */
  filename: string;
  /** Error message if failed */
  error?: string;
  /** File size in bytes (if available) */
  fileSize?: number;
}

// ============================================================================
// Annotated Image Data
// ============================================================================

/**
 * Data for rendering annotated images
 */
export interface AnnotatedImageData {
  /** Base64 data URL of the annotated image */
  imageDataURL: string;
  /** Analysis type used for annotation */
  analysisType: AnalysisMode;
  /** Timestamp of the analysis */
  timestamp: string;
  /** Dimensions of the exported image */
  dimensions: {
    width: number;
    height: number;
  };
}

// ============================================================================
// Classification Overlay Settings
// ============================================================================

/**
 * Settings for the classification results overlay bar
 */
export interface ClassificationOverlaySettings {
  /** Height of the overlay bar in pixels (default: 60) */
  barHeight: number;
  /** Background color with alpha (default: 'rgba(10, 14, 39, 0.95)') */
  backgroundColor: string;
  /** Text color (default: '#06b6d4') */
  textColor: string;
  /** Font family (default: 'JetBrains Mono, monospace') */
  fontFamily: string;
  /** Font size in pixels (default: 14) */
  fontSize: number;
  /** Number of top predictions to show (default: 3) */
  topPredictions: number;
  /** Padding from edges in pixels (default: 20) */
  padding: number;
}

export const DEFAULT_CLASSIFICATION_OVERLAY: ClassificationOverlaySettings = {
  barHeight: 60,
  backgroundColor: 'rgba(10, 14, 39, 0.95)',
  textColor: '#06b6d4',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 14,
  topPredictions: 3,
  padding: 20,
};

// ============================================================================
// Filename Generation
// ============================================================================

/**
 * Generate a timestamped filename for exports
 * Format: ursa-{mode}-{YYYY-MM-DD-HHmmss}.{ext}
 */
export function generateExportFilename(mode: AnalysisMode, extension: string): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/:/g, '')
    .replace(/\..+/, '')
    .replace('T', '-');
  return `ursa-${mode}-${timestamp}.${extension}`;
}
