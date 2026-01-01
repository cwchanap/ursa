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

// ============================================================================
// Repository Interface
// ============================================================================

export interface IHistoryRepository {
  getEntries(): HistoryEntry[];
  addEntry(entry: HistoryEntryInput): HistoryEntry | null;
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
 * Compress an image data URL for storage
 * Resizes to max width and converts to JPEG
 */
export function compressImageForStorage(dataURL: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      const scale = Math.min(1, HISTORY_THUMBNAIL_MAX_WIDTH / img.width);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      // Create canvas and draw scaled image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to original if canvas fails
        resolve(dataURL);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG for better compression
      const compressed = canvas.toDataURL('image/jpeg', HISTORY_THUMBNAIL_QUALITY);
      resolve(compressed);
    };

    img.onerror = () => {
      // Fallback to original on error
      resolve(dataURL);
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
 * Add a new entry to history (FIFO queue)
 * Compresses image and generates ID/timestamp
 *
 * @returns The created entry, or null if failed
 */
export async function addEntry(input: HistoryEntryInput): Promise<HistoryEntry | null> {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    // Compress the image for storage
    const compressedImage = await compressImageForStorage(input.imageDataURL);

    // Create the full entry
    const entry: HistoryEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      analysisType: input.analysisType,
      imageDataURL: compressedImage,
      results: input.results,
      imageDimensions: input.imageDimensions,
    };

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
 */
export const historyRepository: IHistoryRepository = {
  getEntries,
  addEntry: (input) => {
    // Return synchronously for interface compatibility
    // Actual save happens asynchronously
    addEntrySync(input);
    return null;
  },
  deleteEntry,
  clearHistory,
  isAvailable,
  getStorageUsage,
};

/**
 * Async version of the repository for direct use
 */
export const historyRepositoryAsync = {
  getEntries,
  addEntry,
  deleteEntry,
  clearHistory,
  isAvailable,
  getStorageUsage,
};
