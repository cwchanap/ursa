/**
 * Settings Store
 *
 * Svelte writable store for managing user settings.
 * Auto-persists to localStorage with debouncing.
 * Follows the pattern established in analysisState.ts.
 *
 * @module lib/stores/settingsStore
 */

import { writable, derived, get } from 'svelte/store';
import type {
  AppSettings,
  DetectionSettings,
  OCRSettings,
  PerformanceSettings,
  SupportedLanguage,
} from '../types/settings';
import { DEFAULT_SETTINGS, clampSetting } from '../types/settings';
import { loadSettings, saveSettings, resetToDefaults } from '../repositories/settingsRepository';

// ============================================================================
// Store Creation
// ============================================================================

/**
 * Initialize store with settings from localStorage
 */
function createSettingsStore() {
  const initialSettings = loadSettings();
  const { subscribe, set, update } = writable<AppSettings>(initialSettings);

  // Debounce timer for auto-save
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  const SAVE_DEBOUNCE_MS = 500;

  /**
   * Save settings with debouncing
   */
  function debouncedSave(settings: AppSettings): void {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
      saveSettings(settings);
      saveTimeout = null;
    }, SAVE_DEBOUNCE_MS);
  }

  return {
    subscribe,

    /**
     * Update settings and auto-save
     */
    set: (settings: AppSettings) => {
      set(settings);
      debouncedSave(settings);
    },

    /**
     * Update settings with a function and auto-save
     */
    update: (updater: (settings: AppSettings) => AppSettings) => {
      update((current) => {
        const updated = updater(current);
        debouncedSave(updated);
        return updated;
      });
    },

    /**
     * Reset to default settings
     */
    reset: () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      resetToDefaults();
      set(DEFAULT_SETTINGS);
    },

    /**
     * Force immediate save (bypass debounce)
     */
    saveNow: () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      const current = get({ subscribe });
      saveSettings(current);
    },

    /**
     * Cleanup any pending timeouts (useful for HMR or app shutdown)
     */
    cleanup: () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
    },
  };
}

// ============================================================================
// Main Store
// ============================================================================

export const settingsStore = createSettingsStore();

// ============================================================================
// HMR Cleanup
// ============================================================================

// Cleanup pending saves during HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    settingsStore.cleanup();
  });
}

// ============================================================================
// Derived Stores
// ============================================================================

/**
 * Detection settings only
 */
export const detectionSettings = derived(settingsStore, ($settings) => $settings.detection);

/**
 * OCR settings only
 */
export const ocrSettings = derived(settingsStore, ($settings) => $settings.ocr);

/**
 * Performance settings only
 */
export const performanceSettings = derived(settingsStore, ($settings) => $settings.performance);

/**
 * Video FPS setting (commonly accessed)
 */
export const videoFPS = derived(settingsStore, ($settings) => $settings.performance.videoFPS);

/**
 * Confidence threshold (commonly accessed)
 */
export const confidenceThreshold = derived(
  settingsStore,
  ($settings) => $settings.detection.confidenceThreshold
);

// ============================================================================
// Action Functions
// ============================================================================

/**
 * Update detection settings
 */
export function updateDetectionSettings(updates: Partial<DetectionSettings>): void {
  settingsStore.update((settings) => ({
    ...settings,
    detection: {
      ...settings.detection,
      ...updates,
      // Ensure values are clamped
      confidenceThreshold:
        updates.confidenceThreshold !== undefined
          ? clampSetting(updates.confidenceThreshold, 'confidenceThreshold')
          : settings.detection.confidenceThreshold,
      maxDetections:
        updates.maxDetections !== undefined
          ? clampSetting(updates.maxDetections, 'maxDetections')
          : settings.detection.maxDetections,
    },
  }));
}

/**
 * Update OCR settings
 */
export function updateOCRSettings(updates: Partial<OCRSettings>): void {
  settingsStore.update((settings) => ({
    ...settings,
    ocr: {
      ...settings.ocr,
      ...updates,
      minConfidence:
        updates.minConfidence !== undefined
          ? clampSetting(updates.minConfidence, 'minConfidence')
          : settings.ocr.minConfidence,
    },
  }));
}

/**
 * Update OCR language specifically
 */
export function updateOCRLanguage(language: SupportedLanguage): void {
  settingsStore.update((settings) => ({
    ...settings,
    ocr: {
      ...settings.ocr,
      language,
    },
  }));
}

/**
 * Update performance settings
 */
export function updatePerformanceSettings(updates: Partial<PerformanceSettings>): void {
  settingsStore.update((settings) => ({
    ...settings,
    performance: {
      ...settings.performance,
      ...updates,
      videoFPS:
        updates.videoFPS !== undefined
          ? clampSetting(updates.videoFPS, 'videoFPS')
          : settings.performance.videoFPS,
    },
  }));
}

/**
 * Update video FPS specifically
 */
export function updateVideoFPS(fps: number): void {
  settingsStore.update((settings) => ({
    ...settings,
    performance: {
      ...settings.performance,
      videoFPS: clampSetting(fps, 'videoFPS'),
    },
  }));
}

/**
 * Reset all settings to defaults
 */
export function resetSettings(): void {
  settingsStore.reset();
}

/**
 * Get current settings snapshot (for non-reactive contexts)
 */
export function getSettingsSnapshot(): AppSettings {
  return get(settingsStore);
}
