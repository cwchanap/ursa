import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ClassificationResults from './ClassificationResults.svelte';
import type { ClassificationAnalysis } from '../lib/types/analysis';

const mockAnalysis: ClassificationAnalysis = {
  predictions: [
    { label: 'golden retriever', confidence: 0.85 },
    { label: 'labrador', confidence: 0.60 },
    { label: 'poodle', confidence: 0.35 },
  ],
  inferenceTime: 55,
  timestamp: '2026-03-15T12:00:00.000Z',
  imageDimensions: { width: 640, height: 480 },
};

describe('ClassificationResults Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('idle state', () => {
    it('shows idle message when status is idle and no analysis', () => {
      render(ClassificationResults, {
        props: { analysis: null, processing: { status: 'idle' } },
      });
      expect(screen.getByText(/upload an image/i)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading title when status is loading', () => {
      render(ClassificationResults, {
        props: { analysis: null, processing: { status: 'loading' } },
      });
      expect(screen.getByText(/loading classification model/i)).toBeInTheDocument();
    });

    it('shows default loading message when no message provided', () => {
      render(ClassificationResults, {
        props: { analysis: null, processing: { status: 'loading' } },
      });
      expect(screen.getByText(/initializing mobilenet/i)).toBeInTheDocument();
    });

    it('shows custom loading message when provided', () => {
      render(ClassificationResults, {
        props: {
          analysis: null,
          processing: { status: 'loading', message: 'Downloading model...' },
        },
      });
      expect(screen.getByText('Downloading model...')).toBeInTheDocument();
    });

    it('shows progress bar when progress is provided', () => {
      const { container } = render(ClassificationResults, {
        props: {
          analysis: null,
          processing: { status: 'loading', progress: 60 },
        },
      });
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar).not.toBeNull();
      expect(progressBar).toHaveStyle('width: 60%');
    });
  });

  describe('processing state', () => {
    it('shows processing text when status is processing', () => {
      render(ClassificationResults, {
        props: { analysis: null, processing: { status: 'processing' } },
      });
      expect(screen.getByText(/classifying image/i)).toBeInTheDocument();
    });

    it('shows custom processing message', () => {
      render(ClassificationResults, {
        props: {
          analysis: null,
          processing: { status: 'processing', message: 'Running inference...' },
        },
      });
      expect(screen.getByText('Running inference...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error title when status is error', () => {
      render(ClassificationResults, {
        props: { analysis: null, processing: { status: 'error' } },
      });
      expect(screen.getByText(/classification error/i)).toBeInTheDocument();
    });

    it('shows default error message when none provided', () => {
      render(ClassificationResults, {
        props: { analysis: null, processing: { status: 'error' } },
      });
      expect(screen.getByText(/unable to classify/i)).toBeInTheDocument();
    });

    it('shows custom error message when provided', () => {
      render(ClassificationResults, {
        props: {
          analysis: null,
          processing: { status: 'error', message: 'WebGL not available' },
        },
      });
      expect(screen.getByText('WebGL not available')).toBeInTheDocument();
    });
  });

  describe('results display', () => {
    it('shows classification results header when status is complete', () => {
      render(ClassificationResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText(/classification results/i)).toBeInTheDocument();
    });

    it('shows all prediction labels', () => {
      render(ClassificationResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText(/golden retriever/i)).toBeInTheDocument();
      expect(screen.getByText(/labrador/i)).toBeInTheDocument();
      expect(screen.getByText(/poodle/i)).toBeInTheDocument();
    });

    it('shows confidence percentages', () => {
      render(ClassificationResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText('85.0%')).toBeInTheDocument();
      expect(screen.getByText('60.0%')).toBeInTheDocument();
      expect(screen.getByText('35.0%')).toBeInTheDocument();
    });

    it('shows ranked items with # prefix', () => {
      render(ClassificationResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
    });

    it('shows inference time in header badge', () => {
      render(ClassificationResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText('55ms')).toBeInTheDocument();
    });

    it('shows image dimensions in meta section', () => {
      render(ClassificationResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText('640 × 480')).toBeInTheDocument();
    });

    it('does not show results when status is not complete', () => {
      render(ClassificationResults, {
        props: { analysis: mockAnalysis, processing: { status: 'processing' } },
      });
      expect(screen.queryByText(/classification results/i)).toBeNull();
    });

    it('shows no predictions message when predictions array is empty', () => {
      const emptyAnalysis = { ...mockAnalysis, predictions: [] };
      render(ClassificationResults, {
        props: { analysis: emptyAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText(/no objects could be classified/i)).toBeInTheDocument();
    });

    it('shows "Top 5 Predictions" heading', () => {
      render(ClassificationResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText(/top 5 predictions/i)).toBeInTheDocument();
    });
  });

  describe('confidence color classes', () => {
    it('applies high confidence class for confidence >= 0.7', () => {
      const highConf: ClassificationAnalysis = {
        ...mockAnalysis,
        predictions: [{ label: 'cat', confidence: 0.9 }],
      };
      const { container } = render(ClassificationResults, {
        props: { analysis: highConf, processing: { status: 'complete' } },
      });
      expect(container.querySelector('.prediction-confidence.high')).not.toBeNull();
    });

    it('applies medium confidence class for confidence 0.4-0.7', () => {
      const medConf: ClassificationAnalysis = {
        ...mockAnalysis,
        predictions: [{ label: 'cat', confidence: 0.55 }],
      };
      const { container } = render(ClassificationResults, {
        props: { analysis: medConf, processing: { status: 'complete' } },
      });
      expect(container.querySelector('.prediction-confidence.medium')).not.toBeNull();
    });

    it('applies low confidence class for confidence < 0.4', () => {
      const lowConf: ClassificationAnalysis = {
        ...mockAnalysis,
        predictions: [{ label: 'cat', confidence: 0.2 }],
      };
      const { container } = render(ClassificationResults, {
        props: { analysis: lowConf, processing: { status: 'complete' } },
      });
      expect(container.querySelector('.prediction-confidence.low')).not.toBeNull();
    });
  });

  describe('inference time badge', () => {
    it('shows fast badge for inferenceTime < 60ms', () => {
      const { container } = render(ClassificationResults, {
        props: {
          analysis: { ...mockAnalysis, inferenceTime: 45 },
          processing: { status: 'complete' },
        },
      });
      expect(container.querySelector('.inference-badge.fast')).not.toBeNull();
    });

    it('shows medium badge for inferenceTime 60-100ms', () => {
      const { container } = render(ClassificationResults, {
        props: {
          analysis: { ...mockAnalysis, inferenceTime: 80 },
          processing: { status: 'complete' },
        },
      });
      expect(container.querySelector('.inference-badge.medium')).not.toBeNull();
    });

    it('shows slow badge for inferenceTime >= 100ms', () => {
      const { container } = render(ClassificationResults, {
        props: {
          analysis: { ...mockAnalysis, inferenceTime: 150 },
          processing: { status: 'complete' },
        },
      });
      expect(container.querySelector('.inference-badge.slow')).not.toBeNull();
    });
  });
});
