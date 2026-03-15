import { describe, it, expect } from 'vitest';
import {
  AnalysisError,
  ModelLoadError,
  InferenceError,
  WorkerError,
  WebGLError,
  WebAssemblyError,
  InvalidImageError,
  LanguagePackError,
  isAnalysisError,
  getErrorMessage,
} from './analysisErrors';

describe('AnalysisError', () => {
  it('creates error with correct properties', () => {
    const err = new AnalysisError('test message', 'TEST_CODE', 'detection');
    expect(err.message).toBe('test message');
    expect(err.code).toBe('TEST_CODE');
    expect(err.mode).toBe('detection');
    expect(err.name).toBe('AnalysisError');
  });

  it('is an instance of Error', () => {
    const err = new AnalysisError('msg', 'CODE', 'ocr');
    expect(err).toBeInstanceOf(Error);
  });

  it('getUserMessage returns the message', () => {
    const err = new AnalysisError('user msg', 'CODE', 'detection');
    expect(err.getUserMessage()).toBe('user msg');
  });

  it('isRecoverable returns true for NETWORK_ERROR', () => {
    const err = new AnalysisError('msg', 'NETWORK_ERROR', 'detection');
    expect(err.isRecoverable()).toBe(true);
  });

  it('isRecoverable returns true for TIMEOUT', () => {
    const err = new AnalysisError('msg', 'TIMEOUT', 'detection');
    expect(err.isRecoverable()).toBe(true);
  });

  it('isRecoverable returns false for other codes', () => {
    const err = new AnalysisError('msg', 'OTHER_CODE', 'detection');
    expect(err.isRecoverable()).toBe(false);
  });
});

describe('ModelLoadError', () => {
  it('creates error with correct code and mode', () => {
    const err = new ModelLoadError('detection', 'network failure');
    expect(err.code).toBe('MODEL_LOAD_FAILED');
    expect(err.mode).toBe('detection');
    expect(err.name).toBe('ModelLoadError');
    expect(err.message).toContain('detection');
    expect(err.message).toContain('network failure');
  });

  it('isRecoverable returns true', () => {
    expect(new ModelLoadError('detection', 'reason').isRecoverable()).toBe(true);
  });

  it('returns detection-specific user message', () => {
    const msg = new ModelLoadError('detection', 'reason').getUserMessage();
    expect(msg).toContain('object detection');
  });

  it('returns classification-specific user message', () => {
    const msg = new ModelLoadError('classification', 'reason').getUserMessage();
    expect(msg).toContain('classification');
  });

  it('returns ocr-specific user message', () => {
    const msg = new ModelLoadError('ocr', 'reason').getUserMessage();
    expect(msg).toContain('text recognition');
  });
});

describe('InferenceError', () => {
  it('creates error with correct code', () => {
    const err = new InferenceError('detection', 'tensor error');
    expect(err.code).toBe('INFERENCE_FAILED');
    expect(err.name).toBe('InferenceError');
  });

  it('isRecoverable returns false', () => {
    expect(new InferenceError('detection', 'reason').isRecoverable()).toBe(false);
  });

  it('returns detection-specific user message', () => {
    const msg = new InferenceError('detection', 'reason').getUserMessage();
    expect(msg).toContain('detect objects');
  });

  it('returns classification-specific user message', () => {
    const msg = new InferenceError('classification', 'reason').getUserMessage();
    expect(msg).toContain('classify');
  });

  it('returns ocr-specific user message', () => {
    const msg = new InferenceError('ocr', 'reason').getUserMessage();
    expect(msg).toContain('extract text');
  });
});

describe('WorkerError', () => {
  it('creates error with ocr mode and WORKER_FAILED code', () => {
    const err = new WorkerError('worker crashed');
    expect(err.code).toBe('WORKER_FAILED');
    expect(err.mode).toBe('ocr');
    expect(err.name).toBe('WorkerError');
  });

  it('isRecoverable returns true', () => {
    expect(new WorkerError('reason').isRecoverable()).toBe(true);
  });

  it('getUserMessage mentions refresh', () => {
    const msg = new WorkerError('reason').getUserMessage();
    expect(msg).toContain('refresh');
  });
});

describe('WebGLError', () => {
  it('creates error with WEBGL_UNAVAILABLE code', () => {
    const err = new WebGLError('detection');
    expect(err.code).toBe('WEBGL_UNAVAILABLE');
    expect(err.mode).toBe('detection');
    expect(err.name).toBe('WebGLError');
  });

  it('isRecoverable returns false', () => {
    expect(new WebGLError('detection').isRecoverable()).toBe(false);
  });

  it('getUserMessage mentions WebGL', () => {
    const msg = new WebGLError('detection').getUserMessage();
    expect(msg).toContain('WebGL');
  });
});

describe('WebAssemblyError', () => {
  it('creates error with ocr mode and WASM_UNAVAILABLE code', () => {
    const err = new WebAssemblyError();
    expect(err.code).toBe('WASM_UNAVAILABLE');
    expect(err.mode).toBe('ocr');
    expect(err.name).toBe('WebAssemblyError');
  });

  it('isRecoverable returns false', () => {
    expect(new WebAssemblyError().isRecoverable()).toBe(false);
  });

  it('getUserMessage mentions WebAssembly', () => {
    const msg = new WebAssemblyError().getUserMessage();
    expect(msg).toContain('WebAssembly');
  });
});

describe('InvalidImageError', () => {
  it('creates error with INVALID_IMAGE code', () => {
    const err = new InvalidImageError('detection', 'image too small');
    expect(err.code).toBe('INVALID_IMAGE');
    expect(err.name).toBe('InvalidImageError');
  });

  it('isRecoverable returns false', () => {
    expect(new InvalidImageError('detection', 'reason').isRecoverable()).toBe(false);
  });

  it('getUserMessage mentions valid image file', () => {
    const msg = new InvalidImageError('detection', 'reason').getUserMessage();
    expect(msg).toContain('valid image');
  });
});

describe('LanguagePackError', () => {
  it('creates error with LANGUAGE_PACK_FAILED code', () => {
    const err = new LanguagePackError('deu', 'not found');
    expect(err.code).toBe('LANGUAGE_PACK_FAILED');
    expect(err.mode).toBe('ocr');
    expect(err.name).toBe('LanguagePackError');
    expect(err.language).toBe('deu');
  });

  it('isRecoverable returns true', () => {
    expect(new LanguagePackError('deu', 'reason').isRecoverable()).toBe(true);
  });

  it('getUserMessage includes language name', () => {
    const msg = new LanguagePackError('deu', 'reason').getUserMessage();
    expect(msg).toContain('deu');
  });
});

describe('isAnalysisError', () => {
  it('returns true for AnalysisError instances', () => {
    expect(isAnalysisError(new AnalysisError('msg', 'CODE', 'detection'))).toBe(true);
  });

  it('returns true for subclass instances', () => {
    expect(isAnalysisError(new ModelLoadError('detection', 'reason'))).toBe(true);
    expect(isAnalysisError(new WorkerError('reason'))).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isAnalysisError(new Error('plain'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isAnalysisError('string')).toBe(false);
    expect(isAnalysisError(null)).toBe(false);
    expect(isAnalysisError(42)).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('returns getUserMessage for AnalysisError', () => {
    const err = new ModelLoadError('detection', 'reason');
    expect(getErrorMessage(err)).toBe(err.getUserMessage());
  });

  it('returns message for plain Error', () => {
    const err = new Error('plain error message');
    expect(getErrorMessage(err)).toBe('plain error message');
  });

  it('returns fallback for unknown errors', () => {
    expect(getErrorMessage('string error')).toContain('unexpected error');
    expect(getErrorMessage(null)).toContain('unexpected error');
    expect(getErrorMessage(42)).toContain('unexpected error');
  });
});
