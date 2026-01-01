/**
 * Settings Type Definitions
 *
 * Schema and defaults for user-configurable settings.
 * Settings are persisted to localStorage and loaded on app init.
 *
 * @module lib/types/settings
 */

// ============================================================================
// Settings Schema
// ============================================================================

/**
 * Detection-related settings
 */
export interface DetectionSettings {
  /** Confidence threshold 0-100 (default: 50) */
  confidenceThreshold: number;
  /** Maximum objects to detect 1-50 (default: 20) */
  maxDetections: number;
  /** Show labels on bounding boxes */
  showLabels: boolean;
  /** Show confidence scores on labels */
  showScores: boolean;
}

/**
 * OCR-related settings
 */
export interface OCRSettings {
  /** Language code for text extraction (default: 'eng') */
  language: string;
  /** Minimum confidence threshold 0-100 (default: 50) */
  minConfidence: number;
}

/**
 * Performance-related settings
 */
export interface PerformanceSettings {
  /** Video analysis FPS 1-15 (default: 5) */
  videoFPS: number;
}

/**
 * Complete application settings
 */
export interface AppSettings {
  detection: DetectionSettings;
  ocr: OCRSettings;
  performance: PerformanceSettings;
  /** Schema version for migrations */
  version: number;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_DETECTION_SETTINGS: DetectionSettings = {
  confidenceThreshold: 50,
  maxDetections: 20,
  showLabels: true,
  showScores: true,
};

export const DEFAULT_OCR_SETTINGS: OCRSettings = {
  language: 'eng',
  minConfidence: 50,
};

export const DEFAULT_PERFORMANCE_SETTINGS: PerformanceSettings = {
  videoFPS: 5,
};

export const DEFAULT_SETTINGS: AppSettings = {
  detection: DEFAULT_DETECTION_SETTINGS,
  ocr: DEFAULT_OCR_SETTINGS,
  performance: DEFAULT_PERFORMANCE_SETTINGS,
  version: 1,
};

// ============================================================================
// Constants
// ============================================================================

export const SETTINGS_STORAGE_KEY = 'ursa-settings';

export const SETTINGS_CONSTRAINTS = {
  confidenceThreshold: { min: 0, max: 100 },
  maxDetections: { min: 1, max: 50 },
  minConfidence: { min: 0, max: 100 },
  videoFPS: { min: 1, max: 15 },
} as const;

// ============================================================================
// Validation
// ============================================================================

/**
 * Clamp a value to the valid range for a setting
 */
export function clampSetting(
  value: number,
  setting: keyof typeof SETTINGS_CONSTRAINTS
): number {
  const { min, max } = SETTINGS_CONSTRAINTS[setting];
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate and sanitize settings, filling in defaults for missing values
 */
export function validateSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    detection: {
      confidenceThreshold: clampSetting(
        settings.detection?.confidenceThreshold ?? DEFAULT_DETECTION_SETTINGS.confidenceThreshold,
        'confidenceThreshold'
      ),
      maxDetections: clampSetting(
        settings.detection?.maxDetections ?? DEFAULT_DETECTION_SETTINGS.maxDetections,
        'maxDetections'
      ),
      showLabels: settings.detection?.showLabels ?? DEFAULT_DETECTION_SETTINGS.showLabels,
      showScores: settings.detection?.showScores ?? DEFAULT_DETECTION_SETTINGS.showScores,
    },
    ocr: {
      language: settings.ocr?.language ?? DEFAULT_OCR_SETTINGS.language,
      minConfidence: clampSetting(
        settings.ocr?.minConfidence ?? DEFAULT_OCR_SETTINGS.minConfidence,
        'minConfidence'
      ),
    },
    performance: {
      videoFPS: clampSetting(
        settings.performance?.videoFPS ?? DEFAULT_PERFORMANCE_SETTINGS.videoFPS,
        'videoFPS'
      ),
    },
    version: settings.version ?? DEFAULT_SETTINGS.version,
  };
}
