/**
 * Analysis Error Classes
 *
 * Custom error classes for analysis failures with specific error codes
 * and mode context for better error handling and user messaging.
 *
 * @module lib/errors/analysisErrors
 */

import type { AnalysisMode } from '../types/analysis';

/**
 * Base error for all analysis failures
 */
export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly mode: AnalysisMode
  ) {
    super(message);
    this.name = 'AnalysisError';
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    return this.message;
  }

  /**
   * Check if this error is recoverable (e.g., retry may help)
   */
  isRecoverable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

/**
 * Error thrown when a model fails to load
 */
export class ModelLoadError extends AnalysisError {
  constructor(mode: AnalysisMode, reason: string) {
    super(`Failed to load ${mode} model: ${reason}`, 'MODEL_LOAD_FAILED', mode);
    this.name = 'ModelLoadError';
  }

  getUserMessage(): string {
    switch (this.mode) {
      case 'classification':
        return 'Unable to load the image classification model. Please check your internet connection and try again.';
      case 'ocr':
        return 'Unable to load the text recognition engine. Please check your internet connection and try again.';
      case 'detection':
        return 'Unable to load the object detection model. Please check your internet connection and try again.';
      default:
        return 'Unable to load the analysis model. Please try again.';
    }
  }

  isRecoverable(): boolean {
    return true; // Model loading can be retried
  }
}

/**
 * Error thrown when inference/analysis fails
 */
export class InferenceError extends AnalysisError {
  constructor(mode: AnalysisMode, reason: string) {
    super(`${mode} inference failed: ${reason}`, 'INFERENCE_FAILED', mode);
    this.name = 'InferenceError';
  }

  getUserMessage(): string {
    switch (this.mode) {
      case 'classification':
        return 'Unable to classify the image. Please try with a different image.';
      case 'ocr':
        return 'Unable to extract text from the image. Please ensure the image contains readable text.';
      case 'detection':
        return 'Unable to detect objects in the image. Please try with a different image.';
      default:
        return 'Analysis failed. Please try again.';
    }
  }

  isRecoverable(): boolean {
    return false; // Different image needed, not a retry situation
  }
}

/**
 * Error thrown when Tesseract.js worker fails
 */
export class WorkerError extends AnalysisError {
  constructor(reason: string) {
    super(`OCR worker error: ${reason}`, 'WORKER_FAILED', 'ocr');
    this.name = 'WorkerError';
  }

  getUserMessage(): string {
    return 'The text recognition system encountered an error. Please refresh the page and try again.';
  }

  isRecoverable(): boolean {
    return true; // Worker can be recreated
  }
}

/**
 * Error thrown when WebGL is not available
 */
export class WebGLError extends AnalysisError {
  constructor(mode: AnalysisMode) {
    super('WebGL is not available', 'WEBGL_UNAVAILABLE', mode);
    this.name = 'WebGLError';
  }

  getUserMessage(): string {
    return 'Your browser does not support WebGL, which is required for AI analysis. Please try a different browser or enable hardware acceleration.';
  }

  isRecoverable(): boolean {
    return false; // Requires browser/hardware change
  }
}

/**
 * Error thrown when WebAssembly is not available (for Tesseract.js)
 */
export class WebAssemblyError extends AnalysisError {
  constructor() {
    super('WebAssembly is not available', 'WASM_UNAVAILABLE', 'ocr');
    this.name = 'WebAssemblyError';
  }

  getUserMessage(): string {
    return 'Your browser does not support WebAssembly, which is required for text recognition. Please try a different browser.';
  }

  isRecoverable(): boolean {
    return false; // Requires browser change
  }
}

/**
 * Error thrown when image is invalid or unsupported
 */
export class InvalidImageError extends AnalysisError {
  constructor(mode: AnalysisMode, reason: string) {
    super(`Invalid image: ${reason}`, 'INVALID_IMAGE', mode);
    this.name = 'InvalidImageError';
  }

  getUserMessage(): string {
    return 'The image could not be processed. Please ensure it is a valid image file.';
  }

  isRecoverable(): boolean {
    return false; // Requires different image
  }
}

/**
 * Error thrown when language pack fails to load
 */
export class LanguagePackError extends AnalysisError {
  public readonly language: string;

  constructor(language: string, reason: string) {
    super(`Failed to load language pack '${language}': ${reason}`, 'LANGUAGE_PACK_FAILED', 'ocr');
    this.name = 'LanguagePackError';
    this.language = language;
  }

  getUserMessage(): string {
    return `Unable to load the ${this.language} language pack. Text recognition will continue with English.`;
  }

  isRecoverable(): boolean {
    return true; // Can retry or fallback to English
  }
}

/**
 * Type guard to check if an error is an AnalysisError
 */
export function isAnalysisError(error: unknown): error is AnalysisError {
  return error instanceof AnalysisError;
}

/**
 * Convert any error to a user-friendly message
 */
export function getErrorMessage(error: unknown): string {
  if (isAnalysisError(error)) {
    return error.getUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}
