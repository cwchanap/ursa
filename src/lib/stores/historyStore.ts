/**
 * History Store
 *
 * Svelte writable store for managing analysis history.
 * Auto-persists to localStorage with FIFO queue management.
 * Follows the pattern established in analysisState.ts.
 *
 * @module lib/stores/historyStore
 */

import { writable, derived, get } from 'svelte/store';
import type { HistoryEntry, HistoryEntryInput, HistoryState } from '../types/history';
import { INITIAL_HISTORY_STATE } from '../types/history';
import {
  historyRepository,
  getEntries,
  deleteEntry as repoDeleteEntry,
  clearHistory as repoClearHistory,
} from '../repositories/historyRepository';

// ============================================================================
// Store Creation
// ============================================================================

/**
 * Initialize store with history from localStorage
 */
function createHistoryStore() {
  // Load initial entries from localStorage
  const initialEntries = getEntries();
  const initialState: HistoryState = {
    entries: initialEntries,
    selectedEntryId: null,
  };

  const { subscribe, set, update } = writable<HistoryState>(initialState);

  return {
    subscribe,
    set,
    update,

    /**
     * Reload entries from localStorage
     */
    reload: () => {
      const entries = getEntries();
      update((state) => {
        // Clear selectedEntryId if it no longer exists in the new entries list
        const selectedEntryExists = state.selectedEntryId
          ? entries.some((e) => e.id === state.selectedEntryId)
          : true;

        return {
          ...state,
          entries,
          selectedEntryId: selectedEntryExists ? state.selectedEntryId : null,
        };
      });
    },
  };
}

// ============================================================================
// Main Store
// ============================================================================

export const historyStore = createHistoryStore();

// ============================================================================
// Derived Stores
// ============================================================================

/**
 * All history entries (most recent first)
 */
export const historyEntries = derived(historyStore, ($state) => $state.entries);

/**
 * Currently selected entry (for viewing)
 */
export const selectedEntry = derived(historyStore, ($state) => {
  if (!$state.selectedEntryId) return null;
  return $state.entries.find((e) => e.id === $state.selectedEntryId) || null;
});

/**
 * Whether there are any history entries
 */
export const hasHistory = derived(historyStore, ($state) => $state.entries.length > 0);

/**
 * Number of history entries
 */
export const historyCount = derived(historyStore, ($state) => $state.entries.length);

/**
 * Whether an entry is currently selected
 */
export const hasSelectedEntry = derived(historyStore, ($state) => {
  if (!$state.selectedEntryId) return false;
  return $state.entries.some((e) => e.id === $state.selectedEntryId);
});

// ============================================================================
// Action Functions
// ============================================================================

/**
 * Add a new entry to history
 * Image will be compressed automatically
 */
export async function addToHistory(input: HistoryEntryInput): Promise<HistoryEntry | null> {
  try {
    const entry = await historyRepository.addEntry(input);

    if (entry) {
      // Reload from repository to ensure consistency
      historyStore.reload();
    }

    return entry;
  } catch (error) {
    console.error('Failed to add to history:', error);
    return null;
  }
}

/**
 * Select an entry for viewing
 */
export function selectEntry(id: string): void {
  historyStore.update((state) => ({
    ...state,
    selectedEntryId: id,
  }));
}

/**
 * Clear the selection
 */
export function clearSelection(): void {
  historyStore.update((state) => ({
    ...state,
    selectedEntryId: null,
  }));
}

/**
 * Delete a specific entry
 */
export function deleteHistoryEntry(id: string): boolean {
  const success = repoDeleteEntry(id);

  if (success) {
    historyStore.update((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
      // Clear selection if deleted entry was selected
      selectedEntryId: state.selectedEntryId === id ? null : state.selectedEntryId,
    }));
  }

  return success;
}

/**
 * Clear all history entries
 */
export function clearAllHistory(): void {
  repoClearHistory();
  historyStore.set(INITIAL_HISTORY_STATE);
}

/**
 * Get current history state snapshot (for non-reactive contexts)
 */
export function getHistorySnapshot(): HistoryState {
  return get(historyStore);
}

/**
 * Get a specific entry by ID
 */
export function getEntryById(id: string): HistoryEntry | null {
  const state = get(historyStore);
  return state.entries.find((e) => e.id === id) || null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a history entry input from current analysis state
 * Helper for components to prepare data for addToHistory
 */
export function createHistoryEntryInput(
  imageElement: HTMLImageElement | HTMLVideoElement,
  analysisType: HistoryEntryInput['analysisType'],
  results: HistoryEntryInput['results']
): Promise<HistoryEntryInput> {
  return new Promise((resolve, reject) => {
    const timeoutMs = 5000; // 5 second timeout
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let loadListener: (() => void) | null = null;

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (loadListener !== null) {
        if (imageElement instanceof HTMLImageElement) {
          imageElement.removeEventListener('load', loadListener);
        } else {
          imageElement.removeEventListener('loadedmetadata', loadListener);
        }
        loadListener = null;
      }
    };

    const processImage = () => {
      try {
        // Get image dimensions
        const width =
          imageElement instanceof HTMLVideoElement
            ? imageElement.videoWidth
            : imageElement.naturalWidth;
        const height =
          imageElement instanceof HTMLVideoElement
            ? imageElement.videoHeight
            : imageElement.naturalHeight;

        // Validate dimensions are non-zero
        if (width === 0 || height === 0) {
          cleanup();
          reject(new Error('Image/video dimensions are zero - element may not be loaded'));
          return;
        }

        // Convert image to data URL
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(imageElement, 0, 0, width, height);

        const imageDataURL = canvas.toDataURL('image/png');

        cleanup();
        resolve({
          analysisType,
          imageDataURL,
          results,
          imageDimensions: { width, height },
        });
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    try {
      // Check if element is already loaded
      const width =
        imageElement instanceof HTMLVideoElement
          ? imageElement.videoWidth
          : imageElement.naturalWidth;
      const height =
        imageElement instanceof HTMLVideoElement
          ? imageElement.videoHeight
          : imageElement.naturalHeight;

      if (width > 0 && height > 0) {
        // Element is already loaded, process immediately
        processImage();
        return;
      }

      // Element not loaded, wait for load event
      loadListener = () => {
        processImage();
      };

      if (imageElement instanceof HTMLImageElement) {
        imageElement.addEventListener('load', loadListener);
      } else {
        imageElement.addEventListener('loadedmetadata', loadListener);
      }

      // Set timeout to reject if element never loads
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout waiting for image/video to load'));
      }, timeoutMs);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
