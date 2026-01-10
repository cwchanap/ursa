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
  /**
   * Language code for text extraction (default: 'eng')
   *
   * Supported Tesseract.js language codes:
   * - 'eng': English
   * - 'spa': Spanish
   * - 'fra': French
   * - 'deu': German
   * - 'chi_sim': Simplified Chinese
   * - 'jpn': Japanese
   *
   * @see https://github.com/naptha/tesseract.js/blob/master/docs/tesseract.js#languages
   */
  language: SupportedLanguage;
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

/**
 * Supported Tesseract.js language codes for OCR
 * @see https://github.com/naptha/tesseract.js/blob/master/docs/tesseract.js#languages
 */
export const SUPPORTED_LANGUAGES = [
  'eng', // English
  'spa', // Spanish
  'fra', // French
  'deu', // German
  'chi_sim', // Simplified Chinese
  'jpn', // Japanese
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const SETTINGS_CONSTRAINTS = {
  confidenceThreshold: { min: 0, max: 100 },
  maxDetections: { min: 1, max: 50 },
  minConfidence: { min: 0, max: 100 },
  videoFPS: {
    min: 1,
    max: 15,
    // Quality tier thresholds for FPS slider labels/colors
    // Must be within min-max range and in ascending order
    qualityThresholds: {
      low: 3, // ≤ 3: Battery Saver
      medium: 7, // ≤ 7: Balanced
      high: 10, // ≤ 10: Smooth
      // > high: High Performance
    } as const,
  },
} as const;

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate and sanitize OCR language code
 * Returns language if valid, otherwise returns default
 */
export function validateLanguage(language: unknown): SupportedLanguage {
  // Handle null/undefined
  if (language === null || language === undefined) {
    return DEFAULT_OCR_SETTINGS.language;
  }

  // Handle non-string values
  if (typeof language !== 'string') {
    return DEFAULT_OCR_SETTINGS.language;
  }

  // Check if language is in supported list
  const normalizedLanguage = language.trim().toLowerCase();
  if (SUPPORTED_LANGUAGES.includes(normalizedLanguage as SupportedLanguage)) {
    return normalizedLanguage as SupportedLanguage;
  }

  // Return default for invalid language codes
  return DEFAULT_OCR_SETTINGS.language;
}

/**
 * Validate FPS quality thresholds are within min-max range and in ascending order
 * @throws Error if thresholds are invalid
 */
export function validateFPSThresholds(): void {
  const { min, max, qualityThresholds } = SETTINGS_CONSTRAINTS.videoFPS;
  const { low, medium, high } = qualityThresholds;

  // Check thresholds are within min-max range
  if (low < min || high > max) {
    throw new Error(
      `FPS quality thresholds [${low}, ${medium}, ${high}] must be within min-max range [${min}, ${max}]`
    );
  }

  // Check thresholds are in ascending order
  if (low >= medium || medium >= high) {
    throw new Error(
      `FPS quality thresholds must be in ascending order: low (${low}) < medium (${medium}) < high (${high})`
    );
  }
}

/**
 * Clamp a value to a valid range for a setting
 */
export function clampSetting(value: number, setting: keyof typeof SETTINGS_CONSTRAINTS): number {
  const { min, max } = SETTINGS_CONSTRAINTS[setting];
  return Math.max(min, Math.min(max, value));
}

/**
 * Parse and clamp a numeric setting, returning default for invalid values
 */
function parseAndClampSetting(
  value: unknown,
  setting: keyof typeof SETTINGS_CONSTRAINTS,
  defaultValue: number
): number {
  // Coerce to number
  const numValue = typeof value === 'number' ? value : Number(value);

  // Return default if NaN
  if (isNaN(numValue)) {
    return defaultValue;
  }

  // Clamp to valid range
  return clampSetting(numValue, setting);
}

/**
 * Validate and sanitize settings, filling in defaults for missing values
 */
export function validateSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    detection: {
      confidenceThreshold: parseAndClampSetting(
        settings.detection?.confidenceThreshold,
        'confidenceThreshold',
        DEFAULT_DETECTION_SETTINGS.confidenceThreshold
      ),
      maxDetections: parseAndClampSetting(
        settings.detection?.maxDetections,
        'maxDetections',
        DEFAULT_DETECTION_SETTINGS.maxDetections
      ),
      showLabels: settings.detection?.showLabels ?? DEFAULT_DETECTION_SETTINGS.showLabels,
      showScores: settings.detection?.showScores ?? DEFAULT_DETECTION_SETTINGS.showScores,
    },
    ocr: {
      language: validateLanguage(settings.ocr?.language),
      minConfidence: parseAndClampSetting(
        settings.ocr?.minConfidence,
        'minConfidence',
        DEFAULT_OCR_SETTINGS.minConfidence
      ),
    },
    performance: {
      videoFPS: parseAndClampSetting(
        settings.performance?.videoFPS,
        'videoFPS',
        DEFAULT_PERFORMANCE_SETTINGS.videoFPS
      ),
    },
    version: settings.version ?? DEFAULT_SETTINGS.version,
  };
}
