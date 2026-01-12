/**
 * History Repository
 *
 * Abstracts localStorage operations for analysis history.
 * Implements FIFO queue with configurable max entries.
 * Handles image compression for storage optimization.
 *
 * @module lib/repositories/historyRepository
 */

import {
  type HistoryEntry,
  type HistoryEntryInput,
  HISTORY_STORAGE_KEY,
  HISTORY_MAX_ENTRIES,
  HISTORY_THUMBNAIL_MAX_WIDTH,
  HISTORY_THUMBNAIL_QUALITY,
  validateHistoryEntries,
} from '../types/history';
import type {
  DetectionResult,
  ClassificationAnalysis,
  OCRAnalysis,
  DetectedObject,
  OCRResult,
} from '../types/analysis';

// ============================================================================
// Repository Interface
// ============================================================================

export interface IHistoryRepository {
  getEntries(): HistoryEntry[];
  addEntry(entry: HistoryEntryInput): Promise<HistoryEntry | null>;
  deleteEntry(id: string): boolean;
  clearHistory(): void;
  isAvailable(): boolean;
  getStorageUsage(): { used: number; available: number } | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__ursa_history_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a UUID for history entries
 */
function generateId(): string {
  // Use crypto.randomUUID if available, fallback to manual generation
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Result of image compression including scale information
 */
export interface CompressionResult {
  /** Compressed image data URL */
  imageDataURL: string;
  /** Scale factor applied (e.g., 0.5 for 50% size) */
  scale: number;
  /** New image dimensions after compression */
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * Compress an image data URL for storage
 * Resizes to max width and converts to JPEG
 *
 * @param dataURL - The image data URL to compress
 * @param timeoutMs - Timeout in milliseconds (default: 10s)
 * @returns Promise resolving to compression result with image and scale info
 */
export function compressImageForStorage(
  dataURL: string,
  timeoutMs = 10000
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let img: HTMLImageElement | null = new Image();
    let cleanupDone = false;

    const cleanup = () => {
      if (cleanupDone) return;
      cleanupDone = true;

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      if (img) {
        img.onload = null;
        img.onerror = null;
        img = null;
      }
    };

    // Set timeout
    timeoutHandle = setTimeout(() => {
      cleanup();
      reject(new Error('Image compression timeout'));
    }, timeoutMs);

    img.onload = () => {
      // Validate image dimensions
      if (img!.width === 0 || img!.height === 0) {
        cleanup();
        reject(new Error('Image has zero width or height'));
        return;
      }

      // Calculate new dimensions
      const scale = Math.min(1, HISTORY_THUMBNAIL_MAX_WIDTH / img!.width);
      const width = Math.round(img!.width * scale);
      const height = Math.round(img!.height * scale);

      // Create canvas and draw scaled image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cleanup();
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img!, 0, 0, width, height);

      // Convert to JPEG for better compression
      try {
        const compressed = canvas.toDataURL('image/jpeg', HISTORY_THUMBNAIL_QUALITY);
        cleanup();
        resolve({
          imageDataURL: compressed,
          scale,
          dimensions: { width, height },
        });
      } catch (err) {
        cleanup();
        reject(new Error(`Failed to compress image: ${err}`));
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image for compression'));
    };

    img.src = dataURL;
  });
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Get all history entries from localStorage
 */
export function getEntries(): HistoryEntry[] {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage unavailable: unable to load history entries');
    return [];
  }

  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      console.warn('Invalid history format, resetting');
      return [];
    }

    // Validate entries and filter out corrupted ones
    return validateHistoryEntries(parsed);
  } catch (error) {
    console.error('Failed to load history from localStorage:', error);
    return [];
  }
}

/**
 * Save entries to localStorage
 */
function saveEntries(entries: HistoryEntry[]): boolean {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (error) {
    // Handle quota exceeded
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, removing oldest entries');

      // Try removing oldest entries until it fits
      let reducedEntries = entries.slice(0, Math.floor(entries.length / 2));
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(reducedEntries));
        return true;
      } catch {
        // Last resort: clear all history
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        return false;
      }
    }

    console.error('Failed to save history to localStorage:', error);
    return false;
  }
}

/**
 * Scale detection bounding boxes by a given factor
 */
function scaleDetectionBBox(
  bbox: [number, number, number, number],
  scale: number
): [number, number, number, number] {
  return [
    Math.round(bbox[0] * scale),
    Math.round(bbox[1] * scale),
    Math.round(bbox[2] * scale),
    Math.round(bbox[3] * scale),
  ];
}

/**
 * Scale OCR bounding box by a given factor
 */
function scaleOCRBBox(
  bbox: { x: number; y: number; width: number; height: number },
  scale: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(bbox.x * scale),
    y: Math.round(bbox.y * scale),
    width: Math.round(bbox.width * scale),
    height: Math.round(bbox.height * scale),
  };
}

/**
 * Scale detection results to match compressed image
 */
function scaleDetectionResults(results: DetectionResult, scale: number): DetectionResult {
  return {
    ...results,
    objects: results.objects.map(
      (obj): DetectedObject => ({
        ...obj,
        bbox: scaleDetectionBBox(obj.bbox, scale),
      })
    ),
  };
}

/**
 * Scale OCR results to match compressed image
 */
function scaleOCRResults(results: OCRAnalysis, scale: number): OCRAnalysis {
  return {
    ...results,
    textRegions: results.textRegions.map(
      (region): OCRResult => ({
        ...region,
        bbox: region.bbox ? scaleOCRBBox(region.bbox, scale) : undefined,
      })
    ),
    imageDimensions: {
      width: Math.round(results.imageDimensions.width * scale),
      height: Math.round(results.imageDimensions.height * scale),
    },
  };
}

/**
 * Scale classification results to match compressed image
 */
function scaleClassificationResults(
  results: ClassificationAnalysis,
  scale: number
): ClassificationAnalysis {
  return {
    ...results,
    imageDimensions: {
      width: Math.round(results.imageDimensions.width * scale),
      height: Math.round(results.imageDimensions.height * scale),
    },
  };
}

/**
 * Add a new entry to history (FIFO queue)
 * Compresses image and scales results to match compressed dimensions
 *
 * @returns The created entry, or null if failed
 */
export async function addEntry(input: HistoryEntryInput): Promise<HistoryEntry | null> {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage unavailable: cannot add history entry');
    return null;
  }

  try {
    // Compress image for storage
    let compression: CompressionResult;
    try {
      compression = await compressImageForStorage(input.imageDataURL);
    } catch (compressionError) {
      console.warn('Image compression failed, using original image:', compressionError);
      // Fallback to original image with no scaling
      compression = {
        imageDataURL: input.imageDataURL,
        scale: 1,
        dimensions: input.imageDimensions,
      };
    }

    // Scale results to match compressed image dimensions
    let scaledResults: DetectionResult | ClassificationAnalysis | OCRAnalysis;
    if (compression.scale !== 1) {
      if (input.analysisType === 'detection') {
        scaledResults = scaleDetectionResults(input.results as DetectionResult, compression.scale);
      } else if (input.analysisType === 'ocr') {
        scaledResults = scaleOCRResults(input.results as OCRAnalysis, compression.scale);
      } else if (input.analysisType === 'classification') {
        scaledResults = scaleClassificationResults(
          input.results as ClassificationAnalysis,
          compression.scale
        );
      } else {
        scaledResults = input.results;
      }
    } else {
      scaledResults = input.results;
    }

    // Create full entry with scaled results and compressed dimensions
    // Use type assertion because TypeScript can't narrow the discriminated union
    const entry: HistoryEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      analysisType: input.analysisType,
      imageDataURL: compression.imageDataURL,
      results: scaledResults,
      imageDimensions: compression.dimensions,
    } as HistoryEntry;

    // Get existing entries
    const entries = getEntries();

    // Add new entry at the beginning (most recent first)
    const updated = [entry, ...entries];

    // Enforce max entries (FIFO - remove oldest)
    const trimmed = updated.slice(0, HISTORY_MAX_ENTRIES);

    // Save to localStorage
    if (saveEntries(trimmed)) {
      return entry;
    }

    return null;
  } catch (error) {
    console.error('Failed to add history entry:', error);
    return null;
  }
}

/**
 * Synchronous version of addEntry for use in stores
 * Note: Image compression happens asynchronously
 */
export function addEntrySync(input: HistoryEntryInput): void {
  // Fire and forget - the async operation will complete
  addEntry(input).catch((error) => {
    console.error('Failed to add history entry:', error);
  });
}

/**
 * Delete a specific entry by ID
 */
export function deleteEntry(id: string): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    const entries = getEntries();
    const filtered = entries.filter((e) => e.id !== id);

    if (filtered.length === entries.length) {
      // Entry not found
      return false;
    }

    return saveEntries(filtered);
  } catch (error) {
    console.error('Failed to delete history entry:', error);
    return false;
  }
}

/**
 * Clear all history entries
 */
export function clearHistory(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}

/**
 * Check if localStorage is available
 */
export function isAvailable(): boolean {
  return isLocalStorageAvailable();
}

/**
 * Get estimated storage usage for history
 */
export function getStorageUsage(): { used: number; available: number } | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY) || '';
    const used = new Blob([stored]).size;

    // Estimate available (5MB typical limit)
    const available = 5 * 1024 * 1024;

    return { used, available };
  } catch {
    return null;
  }
}

// ============================================================================
// Repository Instance
// ============================================================================

/**
 * History repository singleton
 * All operations are async where needed (e.g., addEntry returns Promise)
 */
export const historyRepository: IHistoryRepository = {
  getEntries,
  addEntry,
  deleteEntry,
  clearHistory,
  isAvailable,
  getStorageUsage,
};
