import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ExportPanel from './ExportPanel.svelte';
import { exportService } from '../lib/services/exportService';
import type { DetectionResult, ClassificationAnalysis, OCRAnalysis } from '../lib/types/analysis';

// Mock exportService
vi.mock('../lib/services/exportService', () => ({
  exportService: {
    exportDetectionImage: vi.fn().mockResolvedValue({ success: true, filename: 'test.png' }),
    exportClassificationImage: vi.fn().mockResolvedValue({ success: true, filename: 'test.png' }),
    exportOCRImage: vi.fn().mockResolvedValue({ success: true, filename: 'test.png' }),
    exportOCRText: vi.fn().mockResolvedValue({ success: true, filename: 'test.txt' }),
    exportOCRResults: vi.fn().mockResolvedValue({
      imageResult: { success: true, filename: 'test.png' },
      textResult: { success: true, filename: 'test.txt' },
    }),
    exportResultsAsJSON: vi.fn().mockResolvedValue({ success: true, filename: 'test.json' }),
    copyResultsAsJSON: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Sample results
const detectionResults: DetectionResult = {
  objects: [{ class: 'person', score: 0.95, bbox: [100, 100, 200, 300] }],
  inferenceTime: 150,
};

const classificationResults: ClassificationAnalysis = {
  predictions: [
    { label: 'golden retriever', confidence: 0.92 },
    { label: 'labrador', confidence: 0.05 },
  ],
  inferenceTime: 80,
  timestamp: '2025-01-15T10:30:45.000Z',
  imageDimensions: { width: 800, height: 600 },
};

const ocrResults: OCRAnalysis = {
  textRegions: [{ text: 'Hello', bbox: { x: 10, y: 10, width: 50, height: 20 }, confidence: 95 }],
  fullText: 'Hello World',
  processingTime: 500,
  timestamp: '2025-01-15T10:30:45.000Z',
  imageDimensions: { width: 800, height: 600 },
  language: 'eng',
};

// Create a mock image element
const createMockImageElement = () => {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: 800 });
  Object.defineProperty(img, 'naturalHeight', { value: 600 });
  return img;
};

describe('ExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('UI State', () => {
    it('disables export button when no results available', () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'detection',
        imageElement: mockImage,
        detectionResults: null,
      });

      const exportButton = screen.getByTestId('export-button');
      expect(exportButton).toBeDisabled();
    });

    it('enables export button when results are available', () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'detection',
        imageElement: mockImage,
        detectionResults,
      });

      const exportButton = screen.getByTestId('export-button');
      expect(exportButton).not.toBeDisabled();
    });

    it('shows dropdown menu when export button is clicked', async () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'detection',
        imageElement: mockImage,
        detectionResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      expect(screen.getByText('Download Image (PNG)')).toBeInTheDocument();
      expect(screen.getByText('Copy JSON to Clipboard')).toBeInTheDocument();
      expect(screen.getByText('Download JSON')).toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', async () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'detection',
        imageElement: mockImage,
        detectionResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      expect(screen.getByText('Download Image (PNG)')).toBeInTheDocument();

      // Click outside the export panel
      fireEvent.click(document.body);
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.queryByText('Download Image (PNG)')).toBeNull();
      });
    });
  });

  describe('Detection Mode', () => {
    it('exports detection image when clicking download image', async () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'detection',
        imageElement: mockImage,
        detectionResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      const downloadButton = screen.getByText('Download Image (PNG)');
      await fireEvent.click(downloadButton);

      expect(exportService.exportDetectionImage).toHaveBeenCalledWith(
        mockImage,
        detectionResults,
        {}
      );

      await waitFor(() => {
        expect(screen.queryByText('Exported: test.png')).toBeInTheDocument();
      });
    });
  });

  describe('Classification Mode', () => {
    it('exports classification image when clicking download image', async () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'classification',
        imageElement: mockImage,
        classificationResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      const downloadButton = screen.getByText('Download Image (PNG)');
      await fireEvent.click(downloadButton);

      expect(exportService.exportClassificationImage).toHaveBeenCalledWith(
        mockImage,
        classificationResults
      );

      await waitFor(() => {
        expect(screen.queryByText('Exported: test.png')).toBeInTheDocument();
      });
    });
  });

  describe('OCR Mode', () => {
    it('exports only OCR image when clicking download image (not text file)', async () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'ocr',
        imageElement: mockImage,
        ocrResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      const downloadButton = screen.getByText('Download Image (PNG)');
      await fireEvent.click(downloadButton);

      // Should call exportOCRImage directly, not exportOCRResults
      expect(exportService.exportOCRImage).toHaveBeenCalledWith(mockImage, ocrResults);

      // Should NOT call exportOCRResults (which would also download text)
      expect(exportService.exportOCRResults).not.toHaveBeenCalled();

      // Should NOT call exportOCRText
      expect(exportService.exportOCRText).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.queryByText('Exported: test.png')).toBeInTheDocument();
      });
    });

    it('shows OCR text download option when in OCR mode', async () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'ocr',
        imageElement: mockImage,
        ocrResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      expect(screen.getByText('Download Image (PNG)')).toBeInTheDocument();
      expect(screen.getByText('Copy JSON to Clipboard')).toBeInTheDocument();
      expect(screen.getByText('Download JSON')).toBeInTheDocument();
      expect(screen.getByText('Download Text (.txt)')).toBeInTheDocument();
    });

    it('exports OCR text when clicking download text', async () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'ocr',
        imageElement: mockImage,
        ocrResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      const downloadButton = screen.getByText('Download Text (.txt)');
      await fireEvent.click(downloadButton);

      expect(exportService.exportOCRText).toHaveBeenCalledWith(ocrResults);

      await waitFor(() => {
        expect(screen.queryByText('Exported: test.txt')).toBeInTheDocument();
      });
    });
  });

  describe('JSON Export', () => {
    it('exports results as JSON file', async () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'detection',
        imageElement: mockImage,
        detectionResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      const downloadButton = screen.getByText('Download JSON');
      await fireEvent.click(downloadButton);

      expect(exportService.exportResultsAsJSON).toHaveBeenCalledWith('detection', detectionResults);

      await waitFor(() => {
        expect(screen.queryByText('Exported: test.json')).toBeInTheDocument();
      });
    });

    it('copies results as JSON to clipboard', async () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'detection',
        imageElement: mockImage,
        detectionResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      const copyButton = screen.getByText('Copy JSON to Clipboard');
      await fireEvent.click(copyButton);

      expect(exportService.copyResultsAsJSON).toHaveBeenCalledWith(detectionResults);

      await waitFor(() => {
        expect(screen.queryByText('Copied to clipboard!')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error message when export fails', async () => {
      vi.mocked(exportService.exportDetectionImage).mockRejectedValueOnce(
        new Error('Export failed')
      );

      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'detection',
        imageElement: mockImage,
        detectionResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      const downloadButton = screen.getByText('Download Image (PNG)');
      await fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.queryByText('Export failed')).toBeInTheDocument();
      });
    });

    it('shows error message when JSON copy fails', async () => {
      vi.mocked(exportService.copyResultsAsJSON).mockResolvedValueOnce({
        success: false,
        error: 'Clipboard error',
      });

      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'detection',
        imageElement: mockImage,
        detectionResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      const copyButton = screen.getByText('Copy JSON to Clipboard');
      await fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.queryByText('Clipboard error')).toBeInTheDocument();
      });
    });
  });

  describe('Feedback Toast', () => {
    it('displays success message and auto-dismisses after 3 seconds', async () => {
      const mockImage = createMockImageElement();

      render(ExportPanel, {
        activeMode: 'detection',
        imageElement: mockImage,
        detectionResults,
      });

      const exportButton = screen.getByTestId('export-button');
      await fireEvent.click(exportButton);

      const downloadButton = screen.getByText('Download Image (PNG)');
      await fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.queryByText('Exported: test.png')).toBeInTheDocument();
      });

      // Fast-forward 3 seconds
      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.queryByText('Exported: test.png')).toBeNull();
      });
    });
  });
});
