/**
 * Analysis State Store
 *
 * Svelte writable store for managing global analysis state across components.
 * Handles mode switching, processing status, and results for detection,
 * classification, and OCR.
 *
 * @module lib/stores/analysisState
 */

import { writable, derived, get } from 'svelte/store';
import type {
  AnalysisState,
  AnalysisMode,
  ProcessingState,
  ClassificationAnalysis,
  OCRAnalysis,
  DetectionResult,
} from '../types/analysis';
import { INITIAL_ANALYSIS_STATE } from '../types/analysis';

/**
 * Main analysis state store
 */
export const analysisState = writable<AnalysisState>(INITIAL_ANALYSIS_STATE);

// ============================================================================
// Derived Stores
// ============================================================================

/**
 * Current active mode
 */
export const activeMode = derived(analysisState, ($state) => $state.activeMode);

/**
 * Current processing state for the active mode
 */
export const currentProcessing = derived(analysisState, ($state) => $state.processing[$state.activeMode]);

/**
 * Check if any mode is currently processing
 */
export const isAnyProcessing = derived(analysisState, ($state) => {
  return (
    $state.processing.detection.status === 'processing' ||
    $state.processing.classification.status === 'processing' ||
    $state.processing.ocr.status === 'processing'
  );
});

/**
 * Check if any mode has results
 */
export const hasAnyResults = derived(analysisState, ($state) => {
  return (
    $state.results.detection !== null ||
    $state.results.classification !== null ||
    $state.results.ocr !== null
  );
});

/**
 * Get results for specific modes
 */
export const detectionResults = derived(analysisState, ($state) => $state.results.detection);
export const classificationResults = derived(analysisState, ($state) => $state.results.classification);
export const ocrResults = derived(analysisState, ($state) => $state.results.ocr);

// ============================================================================
// Action Functions
// ============================================================================

/**
 * Switch active analysis mode
 */
export function setActiveMode(mode: AnalysisMode): void {
  analysisState.update((state) => ({
    ...state,
    activeMode: mode,
  }));
}

/**
 * Update processing status for a specific mode
 */
export function setProcessingStatus(mode: AnalysisMode, processingState: ProcessingState): void {
  analysisState.update((state) => ({
    ...state,
    processing: {
      ...state.processing,
      [mode]: processingState,
    },
  }));
}

/**
 * Store detection results
 */
export function setDetectionResults(results: DetectionResult): void {
  analysisState.update((state) => ({
    ...state,
    results: {
      ...state.results,
      detection: results,
    },
    processing: {
      ...state.processing,
      detection: { status: 'complete' },
    },
  }));
}

/**
 * Store classification results
 */
export function setClassificationResults(results: ClassificationAnalysis): void {
  analysisState.update((state) => ({
    ...state,
    results: {
      ...state.results,
      classification: results,
    },
    processing: {
      ...state.processing,
      classification: { status: 'complete' },
    },
  }));
}

/**
 * Store OCR results
 */
export function setOCRResults(results: OCRAnalysis): void {
  analysisState.update((state) => ({
    ...state,
    results: {
      ...state.results,
      ocr: results,
    },
    processing: {
      ...state.processing,
      ocr: { status: 'complete' },
    },
  }));
}

/**
 * Clear results for a specific mode
 */
export function clearResults(mode: AnalysisMode): void {
  analysisState.update((state) => ({
    ...state,
    results: {
      ...state.results,
      [mode]: null,
    },
    processing: {
      ...state.processing,
      [mode]: { status: 'idle' },
    },
  }));
}

/**
 * Clear results for all modes (FR-010 compliance)
 */
export function clearAllResults(): void {
  analysisState.update((state) => ({
    ...state,
    results: {
      detection: null,
      classification: null,
      ocr: null,
    },
    processing: {
      detection: { status: 'idle' },
      classification: { status: 'idle' },
      ocr: { status: 'idle' },
    },
  }));
}

/**
 * Set the current media element
 */
export function setMediaElement(element: HTMLImageElement | HTMLVideoElement | null): void {
  analysisState.update((state) => ({
    ...state,
    mediaElement: element,
  }));
}

/**
 * Start real-time video analysis
 */
export function startVideoStream(fps: number): void {
  const state = get(analysisState);

  // Clear any existing interval
  if (state.videoStream?.analysisInterval) {
    clearInterval(state.videoStream.analysisInterval);
  }

  analysisState.update((state) => ({
    ...state,
    videoStream: {
      isActive: true,
      fps,
      analysisInterval: null, // Will be set by the component
    },
  }));
}

/**
 * Set the video analysis interval ID (for cleanup)
 */
export function setVideoAnalysisInterval(intervalId: ReturnType<typeof setInterval>): void {
  analysisState.update((state) => ({
    ...state,
    videoStream: state.videoStream
      ? {
          ...state.videoStream,
          analysisInterval: intervalId,
        }
      : null,
  }));
}

/**
 * Stop real-time video analysis
 */
export function stopVideoStream(): void {
  const state = get(analysisState);

  if (state.videoStream?.analysisInterval) {
    clearInterval(state.videoStream.analysisInterval);
  }

  analysisState.update((state) => ({
    ...state,
    videoStream: null,
  }));
}

/**
 * Reset to initial state
 */
export function resetAnalysisState(): void {
  const state = get(analysisState);

  // Clean up video stream interval if exists
  if (state.videoStream?.analysisInterval) {
    clearInterval(state.videoStream.analysisInterval);
  }

  analysisState.set(INITIAL_ANALYSIS_STATE);
}

/**
 * Get current state snapshot (for use outside reactive contexts)
 */
export function getAnalysisStateSnapshot(): AnalysisState {
  return get(analysisState);
}
