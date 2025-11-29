import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import MediaViewer from './MediaViewer.svelte';

// Mock the ObjectDetection class
const mockInitialize = vi.fn(() => Promise.resolve());
const mockProcessImage = vi.fn(() => Promise.resolve({
  objects: [],
  inferenceTime: 100,
}));
const mockUpdateOptions = vi.fn();
const mockDispose = vi.fn();
const mockStartVideoDetection = vi.fn(() => () => {});

vi.mock('../lib/objectDetection.js', () => ({
  ObjectDetection: class {
    initialize = mockInitialize;
    processImage = mockProcessImage;
    updateOptions = mockUpdateOptions;
    dispose = mockDispose;
    startVideoDetection = mockStartVideoDetection;
  },
}));

// Mock getUserMedia
const mockGetUserMedia = vi.fn(() => Promise.resolve({
  getTracks: () => [{ stop: vi.fn() }],
}));

describe('MediaViewer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup navigator.mediaDevices mock
    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mockGetUserMedia,
        },
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    // Clean up window.detectionOverlay
    if (typeof window !== 'undefined') {
      delete (window as any).detectionOverlay;
    }
  });

  describe('Mode Toggle', () => {
    it('renders video mode button', async () => {
      render(MediaViewer);
      
      const videoBtn = screen.getByText('📹 Video Mode');
      expect(videoBtn).toBeInTheDocument();
    });

    it('renders image mode button', async () => {
      render(MediaViewer);
      
      const imageBtn = screen.getByText('🖼️ Image Mode');
      expect(imageBtn).toBeInTheDocument();
    });

    it('starts in video mode by default', async () => {
      render(MediaViewer);
      
      expect(screen.getByText('Video Mode')).toBeInTheDocument();
      expect(screen.getByText('Start Camera')).toBeInTheDocument();
    });

    it('switches to image mode when image button is clicked', async () => {
      render(MediaViewer);
      
      const imageBtn = screen.getByText('🖼️ Image Mode');
      await fireEvent.click(imageBtn);
      
      expect(screen.getByText('Image Mode with Object Detection')).toBeInTheDocument();
      expect(screen.getByText(/Click to upload an image/i)).toBeInTheDocument();
    });

    it('switches back to video mode when video button is clicked', async () => {
      render(MediaViewer);
      
      // Switch to image mode first
      const imageBtn = screen.getByText('🖼️ Image Mode');
      await fireEvent.click(imageBtn);
      
      // Switch back to video mode
      const videoBtn = screen.getByText('📹 Video Mode');
      await fireEvent.click(videoBtn);
      
      expect(screen.getByText('Video Mode')).toBeInTheDocument();
      expect(screen.getByText('Start Camera')).toBeInTheDocument();
    });

    it('applies active styling to video mode button by default', async () => {
      render(MediaViewer);
      
      const videoBtn = screen.getByText('📹 Video Mode');
      expect(videoBtn).toHaveClass('bg-blue-500');
      expect(videoBtn).toHaveClass('text-white');
    });

    it('applies inactive styling to image mode button by default', async () => {
      render(MediaViewer);
      
      const imageBtn = screen.getByText('🖼️ Image Mode');
      expect(imageBtn).toHaveClass('bg-gray-200');
      expect(imageBtn).toHaveClass('text-gray-700');
    });
  });

  describe('Video Mode', () => {
    it('shows Start Camera button initially', async () => {
      render(MediaViewer);
      
      expect(screen.getByText('Start Camera')).toBeInTheDocument();
    });

    it('renders video element', async () => {
      const { container } = render(MediaViewer);
      
      const video = container.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('autoplay');
      expect(video).toHaveAttribute('muted');
      expect(video).toHaveAttribute('playsinline');
    });

    it('does not show Stop Camera button initially', async () => {
      render(MediaViewer);
      
      expect(screen.queryByText('Stop Camera')).not.toBeInTheDocument();
    });

    it('does not show detection buttons initially', async () => {
      render(MediaViewer);
      
      expect(screen.queryByText('Start Detection')).not.toBeInTheDocument();
      expect(screen.queryByText('Stop Detection')).not.toBeInTheDocument();
    });
  });

  describe('Image Mode', () => {
    it('shows upload area when in image mode', async () => {
      render(MediaViewer);
      
      const imageBtn = screen.getByText('🖼️ Image Mode');
      await fireEvent.click(imageBtn);
      
      expect(screen.getByText(/Click to upload an image/i)).toBeInTheDocument();
      expect(screen.getByText(/PNG, JPG, GIF up to 10MB/i)).toBeInTheDocument();
    });

    it('has a hidden file input for image upload', async () => {
      const { container } = render(MediaViewer);
      
      const imageBtn = screen.getByText('🖼️ Image Mode');
      await fireEvent.click(imageBtn);
      
      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveClass('hidden');
      expect(fileInput).toHaveAttribute('accept', 'image/*');
    });

    it('applies drag over styling when dragging file', async () => {
      render(MediaViewer);
      
      const imageBtn = screen.getByText('🖼️ Image Mode');
      await fireEvent.click(imageBtn);
      
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('button');
      expect(uploadArea).toBeInTheDocument();
      
      await fireEvent.dragOver(uploadArea!);
      expect(uploadArea).toHaveClass('border-blue-400');
      expect(uploadArea).toHaveClass('bg-blue-50');
    });

    it('removes drag styling on drag leave', async () => {
      render(MediaViewer);
      
      const imageBtn = screen.getByText('🖼️ Image Mode');
      await fireEvent.click(imageBtn);
      
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('button');
      
      await fireEvent.dragOver(uploadArea!);
      await fireEvent.dragLeave(uploadArea!);
      
      expect(uploadArea).not.toHaveClass('border-blue-400');
      expect(uploadArea).not.toHaveClass('bg-blue-50');
    });
  });

  describe('ObjectDetectionOverlay Integration', () => {
    it('includes ObjectDetectionOverlay component', async () => {
      render(MediaViewer);
      
      // The overlay should render its controls
      expect(screen.getByText('Object Detection')).toBeInTheDocument();
    });

    it('shows detection controls from overlay', async () => {
      render(MediaViewer);
      
      expect(screen.getByText('Detect Objects')).toBeInTheDocument();
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible mode toggle buttons', async () => {
      render(MediaViewer);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('video element has proper attributes', async () => {
      const { container } = render(MediaViewer);
      
      const video = container.querySelector('video');
      expect(video).toHaveAttribute('muted');
      expect(video).toHaveAttribute('playsinline');
    });
  });
});
