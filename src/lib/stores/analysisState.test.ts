import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  analysisState,
  activeMode,
  currentProcessing,
  isAnyProcessing,
  hasAnyResults,
  detectionResults,
  classificationResults,
  ocrResults,
  setActiveMode,
  setProcessingStatus,
  setDetectionResults,
  setClassificationResults,
  setOCRResults,
  clearResults,
  clearAllResults,
  setMediaElement,
  startVideoStream,
  setVideoAnalysisInterval,
  stopVideoStream,
  resetAnalysisState,
  getAnalysisStateSnapshot,
} from './analysisState';
import type { ClassificationAnalysis, OCRAnalysis, DetectionResult } from '../types/analysis';

const mockDetectionResult: DetectionResult = {
  objects: [{ bbox: [10, 20, 100, 80], class: 'person', score: 0.95 }],
  inferenceTime: 120,
};

const mockClassificationResult: ClassificationAnalysis = {
  predictions: [{ label: 'cat', confidence: 0.85 }],
  inferenceTime: 60,
  timestamp: new Date().toISOString(),
  imageDimensions: { width: 640, height: 480 },
};

const mockOCRResult: OCRAnalysis = {
  textRegions: [{ text: 'Hello', confidence: 90 }],
  fullText: 'Hello',
  processingTime: 300,
  timestamp: new Date().toISOString(),
  imageDimensions: { width: 640, height: 480 },
  language: 'eng',
};

describe('analysisState store', () => {
  beforeEach(() => {
    resetAnalysisState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with detection mode', () => {
      expect(get(activeMode)).toBe('detection');
    });

    it('starts with all processing states idle', () => {
      const state = get(analysisState);
      expect(state.processing.detection.status).toBe('idle');
      expect(state.processing.classification.status).toBe('idle');
      expect(state.processing.ocr.status).toBe('idle');
    });

    it('starts with all results null', () => {
      const state = get(analysisState);
      expect(state.results.detection).toBeNull();
      expect(state.results.classification).toBeNull();
      expect(state.results.ocr).toBeNull();
    });

    it('starts with no media element', () => {
      expect(get(analysisState).mediaElement).toBeNull();
    });

    it('starts with no video stream', () => {
      expect(get(analysisState).videoStream).toBeNull();
    });
  });

  describe('setActiveMode', () => {
    it('updates active mode to classification', () => {
      setActiveMode('classification');
      expect(get(activeMode)).toBe('classification');
    });

    it('updates active mode to ocr', () => {
      setActiveMode('ocr');
      expect(get(activeMode)).toBe('ocr');
    });

    it('updates currentProcessing derived store when mode changes', () => {
      setProcessingStatus('classification', { status: 'processing' });
      setActiveMode('classification');
      expect(get(currentProcessing).status).toBe('processing');
    });
  });

  describe('setProcessingStatus', () => {
    it('updates processing state for detection', () => {
      setProcessingStatus('detection', { status: 'loading', progress: 50 });
      const state = get(analysisState);
      expect(state.processing.detection.status).toBe('loading');
      expect(state.processing.detection.progress).toBe(50);
    });

    it('updates processing state for classification', () => {
      setProcessingStatus('classification', { status: 'processing', message: 'Classifying...' });
      const state = get(analysisState);
      expect(state.processing.classification.status).toBe('processing');
      expect(state.processing.classification.message).toBe('Classifying...');
    });

    it('does not affect other modes', () => {
      setProcessingStatus('detection', { status: 'processing' });
      const state = get(analysisState);
      expect(state.processing.classification.status).toBe('idle');
      expect(state.processing.ocr.status).toBe('idle');
    });
  });

  describe('setDetectionResults', () => {
    it('stores detection results and sets status to complete', () => {
      setDetectionResults(mockDetectionResult);
      const state = get(analysisState);
      expect(state.results.detection).toEqual(mockDetectionResult);
      expect(state.processing.detection.status).toBe('complete');
    });

    it('updates detectionResults derived store', () => {
      setDetectionResults(mockDetectionResult);
      expect(get(detectionResults)).toEqual(mockDetectionResult);
    });
  });

  describe('setClassificationResults', () => {
    it('stores classification results and sets status to complete', () => {
      setClassificationResults(mockClassificationResult);
      const state = get(analysisState);
      expect(state.results.classification).toEqual(mockClassificationResult);
      expect(state.processing.classification.status).toBe('complete');
    });

    it('updates classificationResults derived store', () => {
      setClassificationResults(mockClassificationResult);
      expect(get(classificationResults)).toEqual(mockClassificationResult);
    });
  });

  describe('setOCRResults', () => {
    it('stores OCR results and sets status to complete', () => {
      setOCRResults(mockOCRResult);
      const state = get(analysisState);
      expect(state.results.ocr).toEqual(mockOCRResult);
      expect(state.processing.ocr.status).toBe('complete');
    });

    it('updates ocrResults derived store', () => {
      setOCRResults(mockOCRResult);
      expect(get(ocrResults)).toEqual(mockOCRResult);
    });
  });

  describe('clearResults', () => {
    it('clears detection results and resets processing to idle', () => {
      setDetectionResults(mockDetectionResult);
      clearResults('detection');
      const state = get(analysisState);
      expect(state.results.detection).toBeNull();
      expect(state.processing.detection.status).toBe('idle');
    });

    it('does not affect other mode results', () => {
      setDetectionResults(mockDetectionResult);
      setClassificationResults(mockClassificationResult);
      clearResults('detection');
      expect(get(classificationResults)).toEqual(mockClassificationResult);
    });
  });

  describe('clearAllResults', () => {
    it('clears all results and resets all processing states', () => {
      setDetectionResults(mockDetectionResult);
      setClassificationResults(mockClassificationResult);
      setOCRResults(mockOCRResult);
      clearAllResults();
      const state = get(analysisState);
      expect(state.results.detection).toBeNull();
      expect(state.results.classification).toBeNull();
      expect(state.results.ocr).toBeNull();
      expect(state.processing.detection.status).toBe('idle');
      expect(state.processing.classification.status).toBe('idle');
      expect(state.processing.ocr.status).toBe('idle');
    });
  });

  describe('derived stores', () => {
    describe('isAnyProcessing', () => {
      it('returns false when all idle', () => {
        expect(get(isAnyProcessing)).toBe(false);
      });

      it('returns true when detection is processing', () => {
        setProcessingStatus('detection', { status: 'processing' });
        expect(get(isAnyProcessing)).toBe(true);
      });

      it('returns true when classification is processing', () => {
        setProcessingStatus('classification', { status: 'processing' });
        expect(get(isAnyProcessing)).toBe(true);
      });

      it('returns true when ocr is processing', () => {
        setProcessingStatus('ocr', { status: 'processing' });
        expect(get(isAnyProcessing)).toBe(true);
      });

      it('returns false when status is complete (not processing)', () => {
        setDetectionResults(mockDetectionResult);
        expect(get(isAnyProcessing)).toBe(false);
      });
    });

    describe('hasAnyResults', () => {
      it('returns false when no results', () => {
        expect(get(hasAnyResults)).toBe(false);
      });

      it('returns true when detection results exist', () => {
        setDetectionResults(mockDetectionResult);
        expect(get(hasAnyResults)).toBe(true);
      });

      it('returns true when classification results exist', () => {
        setClassificationResults(mockClassificationResult);
        expect(get(hasAnyResults)).toBe(true);
      });

      it('returns true when OCR results exist', () => {
        setOCRResults(mockOCRResult);
        expect(get(hasAnyResults)).toBe(true);
      });

      it('returns false after clearing all results', () => {
        setDetectionResults(mockDetectionResult);
        clearAllResults();
        expect(get(hasAnyResults)).toBe(false);
      });
    });

    describe('currentProcessing', () => {
      it('reflects active mode processing state', () => {
        setActiveMode('ocr');
        setProcessingStatus('ocr', { status: 'loading', message: 'Loading OCR...' });
        expect(get(currentProcessing).status).toBe('loading');
        expect(get(currentProcessing).message).toBe('Loading OCR...');
      });
    });
  });

  describe('setMediaElement', () => {
    it('stores a media element reference', () => {
      const img = document.createElement('img');
      setMediaElement(img);
      expect(get(analysisState).mediaElement).toBe(img);
    });

    it('can be set to null', () => {
      const img = document.createElement('img');
      setMediaElement(img);
      setMediaElement(null);
      expect(get(analysisState).mediaElement).toBeNull();
    });
  });

  describe('video stream management', () => {
    it('startVideoStream sets videoStream as active', () => {
      startVideoStream(10);
      const state = get(analysisState);
      expect(state.videoStream?.isActive).toBe(true);
      expect(state.videoStream?.fps).toBe(10);
      expect(state.videoStream?.analysisInterval).toBeNull();
    });

    it('setVideoAnalysisInterval stores the interval id', () => {
      startVideoStream(10);
      const intervalId = setInterval(() => {}, 1000);
      setVideoAnalysisInterval(intervalId);
      expect(get(analysisState).videoStream?.analysisInterval).toBe(intervalId);
      clearInterval(intervalId);
    });

    it('setVideoAnalysisInterval clears interval when no videoStream', () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      const intervalId = setInterval(() => {}, 1000);
      setVideoAnalysisInterval(intervalId);
      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    });

    it('stopVideoStream sets videoStream to null', () => {
      startVideoStream(5);
      stopVideoStream();
      expect(get(analysisState).videoStream).toBeNull();
    });

    it('stopVideoStream clears interval before stopping', () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      startVideoStream(5);
      const intervalId = setInterval(() => {}, 1000);
      setVideoAnalysisInterval(intervalId);
      stopVideoStream();
      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    });
  });

  describe('resetAnalysisState', () => {
    it('resets to initial state', () => {
      setActiveMode('ocr');
      setDetectionResults(mockDetectionResult);
      setProcessingStatus('ocr', { status: 'processing' });
      resetAnalysisState();
      expect(get(activeMode)).toBe('detection');
      expect(get(hasAnyResults)).toBe(false);
      expect(get(isAnyProcessing)).toBe(false);
    });

    it('clears video stream interval on reset', () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      startVideoStream(5);
      const intervalId = setInterval(() => {}, 1000);
      setVideoAnalysisInterval(intervalId);
      resetAnalysisState();
      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    });
  });

  describe('getAnalysisStateSnapshot', () => {
    it('returns current state snapshot', () => {
      setActiveMode('classification');
      const snapshot = getAnalysisStateSnapshot();
      expect(snapshot.activeMode).toBe('classification');
    });

    it('snapshot is not reactive (copy at time of call)', () => {
      const snapshot = getAnalysisStateSnapshot();
      setActiveMode('ocr');
      expect(snapshot.activeMode).toBe('detection');
    });
  });
});
