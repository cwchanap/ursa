import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PerformanceMonitor from './PerformanceMonitor.svelte';
import type { DetectionResult, ClassificationAnalysis, OCRAnalysis } from '../lib/types/analysis';

const mockDetection: DetectionResult = {
  objects: [{ bbox: [0, 0, 100, 100], class: 'cat', score: 0.9 }],
  inferenceTime: 45,
};

const mockClassification: ClassificationAnalysis = {
  predictions: [{ label: 'cat', confidence: 0.9 }],
  inferenceTime: 80,
  timestamp: new Date().toISOString(),
  imageDimensions: { width: 640, height: 480 },
};

const mockOCR: OCRAnalysis = {
  textRegions: [],
  fullText: '',
  processingTime: 150,
  timestamp: new Date().toISOString(),
  imageDimensions: { width: 640, height: 480 },
  language: 'eng',
};

describe('PerformanceMonitor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('renders nothing when no results are provided', () => {
      const { container } = render(PerformanceMonitor);
      expect(container.querySelector('.performance-monitor')).toBeNull();
    });

    it('renders nothing when isVisible is false', () => {
      const { container } = render(PerformanceMonitor, {
        props: { detectionResult: mockDetection, isVisible: false },
      });
      expect(container.querySelector('.performance-monitor')).toBeNull();
    });

    it('renders monitor panel when detection result is provided', () => {
      const { container } = render(PerformanceMonitor, {
        props: { detectionResult: mockDetection },
      });
      expect(container.querySelector('.performance-monitor')).not.toBeNull();
    });

    it('renders monitor panel when classification result is provided', () => {
      const { container } = render(PerformanceMonitor, {
        props: { classificationResult: mockClassification },
      });
      expect(container.querySelector('.performance-monitor')).not.toBeNull();
    });

    it('renders monitor panel when OCR result is provided', () => {
      const { container } = render(PerformanceMonitor, {
        props: { ocrResult: mockOCR },
      });
      expect(container.querySelector('.performance-monitor')).not.toBeNull();
    });

    it('has role="region" and aria-label for accessibility', () => {
      render(PerformanceMonitor, { props: { detectionResult: mockDetection } });
      expect(screen.getByRole('region', { name: /performance metrics/i })).toBeInTheDocument();
    });
  });

  describe('detection result display', () => {
    it('shows Detection label', () => {
      render(PerformanceMonitor, { props: { detectionResult: mockDetection } });
      expect(screen.getByText('Detection')).toBeInTheDocument();
    });

    it('shows inference time for detection', () => {
      render(PerformanceMonitor, { props: { detectionResult: mockDetection } });
      expect(screen.getByText('45ms')).toBeInTheDocument();
    });

    it('applies fast timing class for inferenceTime < 60ms', () => {
      const { container } = render(PerformanceMonitor, {
        props: { detectionResult: { ...mockDetection, inferenceTime: 45 } },
      });
      expect(container.querySelector('.entry-time.timing-fast')).not.toBeNull();
    });

    it('applies medium timing class for inferenceTime 60-100ms', () => {
      const { container } = render(PerformanceMonitor, {
        props: { detectionResult: { ...mockDetection, inferenceTime: 80 } },
      });
      expect(container.querySelector('.entry-time.timing-medium')).not.toBeNull();
    });

    it('applies slow timing class for inferenceTime >= 100ms', () => {
      const { container } = render(PerformanceMonitor, {
        props: { detectionResult: { ...mockDetection, inferenceTime: 150 } },
      });
      expect(container.querySelector('.entry-time.timing-slow')).not.toBeNull();
    });
  });

  describe('classification result display', () => {
    it('shows Classification label', () => {
      render(PerformanceMonitor, { props: { classificationResult: mockClassification } });
      expect(screen.getByText('Classification')).toBeInTheDocument();
    });

    it('shows inference time for classification', () => {
      render(PerformanceMonitor, { props: { classificationResult: mockClassification } });
      expect(screen.getByText('80ms')).toBeInTheDocument();
    });

    it('applies medium timing class for 80ms', () => {
      const { container } = render(PerformanceMonitor, {
        props: { classificationResult: mockClassification },
      });
      expect(container.querySelector('.entry-time.timing-medium')).not.toBeNull();
    });
  });

  describe('OCR result display', () => {
    it('shows OCR label', () => {
      render(PerformanceMonitor, { props: { ocrResult: mockOCR } });
      expect(screen.getByText('OCR')).toBeInTheDocument();
    });

    it('shows processing time for OCR', () => {
      render(PerformanceMonitor, { props: { ocrResult: mockOCR } });
      expect(screen.getByText('150ms')).toBeInTheDocument();
    });

    it('applies slow timing class for processingTime >= 100ms', () => {
      const { container } = render(PerformanceMonitor, { props: { ocrResult: mockOCR } });
      expect(container.querySelector('.entry-time.timing-slow')).not.toBeNull();
    });
  });

  describe('time formatting', () => {
    it('formats time in ms for values under 1000', () => {
      render(PerformanceMonitor, {
        props: { detectionResult: { ...mockDetection, inferenceTime: 999 } },
      });
      expect(screen.getByText('999ms')).toBeInTheDocument();
    });

    it('formats time in seconds for values >= 1000ms', () => {
      render(PerformanceMonitor, {
        props: { detectionResult: { ...mockDetection, inferenceTime: 1500 } },
      });
      expect(screen.getByText('1.50s')).toBeInTheDocument();
    });
  });

  describe('multiple results', () => {
    it('shows all three entries when all results are provided', () => {
      render(PerformanceMonitor, {
        props: {
          detectionResult: mockDetection,
          classificationResult: mockClassification,
          ocrResult: mockOCR,
        },
      });
      expect(screen.getByText('Detection')).toBeInTheDocument();
      expect(screen.getByText('Classification')).toBeInTheDocument();
      expect(screen.getByText('OCR')).toBeInTheDocument();
    });

    it('shows exactly 3 timing values when all results provided', () => {
      const { container } = render(PerformanceMonitor, {
        props: {
          detectionResult: mockDetection,
          classificationResult: mockClassification,
          ocrResult: mockOCR,
        },
      });
      const timingEntries = container.querySelectorAll('.entry-time');
      expect(timingEntries).toHaveLength(3);
    });
  });

  describe('legend display', () => {
    it('shows legend items when monitor is visible', () => {
      render(PerformanceMonitor, { props: { detectionResult: mockDetection } });
      expect(screen.getByText('<60ms')).toBeInTheDocument();
      expect(screen.getByText('60-100ms')).toBeInTheDocument();
      expect(screen.getByText('>100ms')).toBeInTheDocument();
    });
  });
});
