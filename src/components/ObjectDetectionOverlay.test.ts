import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ObjectDetectionOverlay from './ObjectDetectionOverlay.svelte';

// Mock the ObjectDetection class
const mockInitialize = vi.fn(() => Promise.resolve());
const mockProcessImage = vi.fn(() => Promise.resolve({
  objects: [
    { class: 'person', score: 0.95 },
    { class: 'dog', score: 0.87 },
  ],
  inferenceTime: 150,
}));
const mockUpdateOptions = vi.fn();
const mockDispose = vi.fn();

vi.mock('../lib/objectDetection.js', () => ({
  ObjectDetection: class {
    initialize = mockInitialize;
    processImage = mockProcessImage;
    updateOptions = mockUpdateOptions;
    dispose = mockDispose;
  },
}));

describe('ObjectDetectionOverlay Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up window.detectionOverlay
    if (typeof window !== 'undefined') {
      delete (window as any).detectionOverlay;
    }
  });

  describe('Rendering', () => {
    it('renders detection controls when showControls is true', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: true, showStats: false },
      });
      
      expect(screen.getByText('Object Detection')).toBeInTheDocument();
      expect(screen.getByText('Detect Objects')).toBeInTheDocument();
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('does not render controls when showControls is false', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: false, showStats: false },
      });
      
      expect(screen.queryByText('Object Detection')).not.toBeInTheDocument();
    });

    it('renders confidence slider with default value', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: true },
      });
      
      const slider = screen.getByLabelText(/Confidence Threshold/i);
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveValue('50');
    });

    it('renders max detections slider with default value', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: true },
      });
      
      const slider = screen.getByLabelText(/Max Detections/i);
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveValue('20');
    });

    it('renders show labels checkbox checked by default', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: true },
      });
      
      const checkbox = screen.getByLabelText(/Show Labels/i);
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toBeChecked();
    });

    it('renders show scores checkbox checked by default', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: true },
      });
      
      const checkbox = screen.getByLabelText(/Show Scores/i);
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toBeChecked();
    });
  });

  describe('Controls Interaction', () => {
    it('updates confidence value when slider changes', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: true },
      });
      
      const slider = screen.getByLabelText(/Confidence Threshold/i);
      await fireEvent.input(slider, { target: { value: '75' } });
      
      expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('updates max detections value when slider changes', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: true },
      });
      
      const slider = screen.getByLabelText(/Max Detections/i);
      await fireEvent.input(slider, { target: { value: '30' } });
      
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('toggles show labels checkbox', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: true },
      });
      
      const checkbox = screen.getByLabelText(/Show Labels/i);
      expect(checkbox).toBeChecked();
      
      await fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('toggles show scores checkbox', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: true },
      });
      
      const checkbox = screen.getByLabelText(/Show Scores/i);
      expect(checkbox).toBeChecked();
      
      await fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('Model Initialization', () => {
    it('initializes the detection model on mount', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: true, showStats: true },
      });
      
      await waitFor(() => {
        expect(mockInitialize).toHaveBeenCalledTimes(1);
      });
    });

    it('exposes detectionOverlay to window object', async () => {
      render(ObjectDetectionOverlay, {
        props: { showControls: true },
      });
      
      await waitFor(() => {
        expect((window as any).detectionOverlay).toBeDefined();
        expect((window as any).detectionOverlay.isReady).toBeDefined();
        expect((window as any).detectionOverlay.setMediaElement).toBeDefined();
        expect((window as any).detectionOverlay.getDetector).toBeDefined();
      });
    });
  });

  describe('Custom className', () => {
    it('applies custom className to container', async () => {
      const { container } = render(ObjectDetectionOverlay, {
        props: { className: 'custom-class' },
      });
      
      const overlay = container.querySelector('.object-detection-overlay');
      expect(overlay).toHaveClass('custom-class');
    });
  });
});
