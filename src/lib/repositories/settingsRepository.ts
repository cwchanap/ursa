/**
 * Settings Repository
 *
 * Abstracts localStorage operations for user settings.
 * Handles serialization, validation, and error recovery.
 *
 * @module lib/repositories/settingsRepository
 */

import {
  type AppSettings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  validateSettings,
} from '../types/settings';

// ============================================================================
// Repository Interface
// ============================================================================

export interface ISettingsRepository {
  loadSettings(): AppSettings;
  saveSettings(settings: AppSettings): boolean;
  resetToDefaults(): void;
  isAvailable(): boolean;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__ursa_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load settings from localStorage
 *
 * @returns Validated settings (defaults filled in for missing values)
 */
export function loadSettings(): AppSettings {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage not available, using default settings');
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored) as Partial<AppSettings>;

    // Handle version migrations if needed
    if (parsed.version !== DEFAULT_SETTINGS.version) {
      console.info(`Migrating settings from version ${parsed.version} to ${DEFAULT_SETTINGS.version}`);
      // Future: Add migration logic here
    }

    // Validate and fill in defaults for any missing fields
    return validateSettings(parsed);
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to localStorage
 *
 * @param settings - Settings to save
 * @returns true if saved successfully, false otherwise
 */
export function saveSettings(settings: AppSettings): boolean {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage not available, settings not persisted');
    return false;
  }

  try {
    // Validate before saving
    const validated = validateSettings(settings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(validated));
    return true;
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error);
    return false;
  }
}

/**
 * Reset settings to defaults (clears localStorage entry)
 */
export function resetToDefaults(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to reset settings:', error);
  }
}

/**
 * Check if localStorage is available for settings
 */
export function isAvailable(): boolean {
  return isLocalStorageAvailable();
}

// ============================================================================
// Repository Instance
// ============================================================================

/**
 * Settings repository singleton
 */
export const settingsRepository: ISettingsRepository = {
  loadSettings,
  saveSettings,
  resetToDefaults,
  isAvailable,
};
