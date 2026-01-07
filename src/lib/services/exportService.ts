/**
 * Export Service
 *
 * Business logic for exporting analysis results as images, JSON, or text.
 * Handles canvas composition, overlay rendering, and file downloads.
 *
 * @module lib/services/exportService
 */

import type { AnalysisMode, DetectionResult, ClassificationAnalysis, OCRAnalysis, DetectedObject, OCRResult } from '../types/analysis';
import type { ExportResult, ImageExportOptions, JSONExportOptions, TextExportOptions } from '../types/export';
import { generateExportFilename, DEFAULT_CLASSIFICATION_OVERLAY } from '../types/export';
import type { DetectionSettings } from '../types/settings';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Trigger a file download from a Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get dimensions from a media element
 */
function getMediaDimensions(element: HTMLImageElement | HTMLVideoElement): { width: number; height: number } {
  if (element instanceof HTMLVideoElement) {
    return { width: element.videoWidth, height: element.videoHeight };
  }
  return { width: element.naturalWidth, height: element.naturalHeight };
}

/**
 * Draw media element to a canvas
 */
function drawMediaToCanvas(
  ctx: CanvasRenderingContext2D,
  element: HTMLImageElement | HTMLVideoElement,
  width: number,
  height: number
): void {
  ctx.drawImage(element, 0, 0, width, height);
}

// ============================================================================
// Detection Drawing (Reused from objectDetection.ts pattern)
// ============================================================================

const DETECTION_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
];

/**
 * Draw detection bounding boxes on a canvas
 */
function drawDetections(
  ctx: CanvasRenderingContext2D,
  detections: DetectedObject[],
  settings: Partial<DetectionSettings> = {}
): void {
  const {
    showLabels = true,
    showScores = true,
  } = settings;

  const lineWidth = 2;
  const fontSize = 16;

  ctx.font = `${fontSize}px Arial`;
  ctx.lineWidth = lineWidth;

  const colorMap = new Map<string, string>();

  detections.forEach((detection) => {
    const [x, y, width, height] = detection.bbox;

    // Get or assign color for this class
    if (!colorMap.has(detection.class)) {
      colorMap.set(detection.class, DETECTION_COLORS[colorMap.size % DETECTION_COLORS.length]);
    }
    const color = colorMap.get(detection.class)!;

    // Draw bounding box
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, width, height);

    // Draw label
    if (showLabels) {
      const label = showScores
        ? `${detection.class} ${(detection.score * 100).toFixed(0)}%`
        : detection.class;

      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;

      // Background rectangle
      ctx.fillStyle = color;
      ctx.fillRect(x, y - textHeight - 4, textWidth + 8, textHeight + 4);

      // Text
      ctx.fillStyle = 'white';
      ctx.fillText(label, x + 4, y - 4);
    }
  });
}

// ============================================================================
// Classification Overlay
// ============================================================================

/**
 * Draw classification results as a bottom overlay bar
 */
function drawClassificationOverlay(
  ctx: CanvasRenderingContext2D,
  analysis: ClassificationAnalysis,
  canvasWidth: number,
  canvasHeight: number
): void {
  const {
    barHeight,
    backgroundColor,
    textColor,
    fontFamily,
    fontSize,
    topPredictions,
    padding,
  } = DEFAULT_CLASSIFICATION_OVERLAY;

  // Draw background bar
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, canvasHeight - barHeight, canvasWidth, barHeight);

  // Draw top border line
  ctx.strokeStyle = textColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, canvasHeight - barHeight);
  ctx.lineTo(canvasWidth, canvasHeight - barHeight);
  ctx.stroke();

  // Draw predictions
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = textColor;

  const top = analysis.predictions.slice(0, topPredictions);
  let xOffset = padding;
  const yPosition = canvasHeight - barHeight / 2 + fontSize / 3;

  top.forEach((pred, i) => {
    const text = `${i + 1}. ${pred.label} (${(pred.confidence * 100).toFixed(1)}%)`;
    ctx.fillText(text, xOffset, yPosition);
    xOffset += ctx.measureText(text).width + 30;
  });

  // Draw timestamp on the right
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `12px ${fontFamily}`;
  const timestamp = new Date(analysis.timestamp).toLocaleTimeString();
  ctx.fillText(timestamp, canvasWidth - padding, yPosition);
  ctx.textAlign = 'left';
}

// ============================================================================
// OCR Overlay
// ============================================================================

/**
 * Draw OCR text region boxes on a canvas
 */
function drawOCROverlay(
  ctx: CanvasRenderingContext2D,
  textRegions: OCRResult[]
): void {
  ctx.strokeStyle = '#10B981'; // Green
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';

  textRegions.forEach((region) => {
    if (region.bbox) {
      const { x, y, width, height } = region.bbox;

      // Draw filled background
      ctx.fillRect(x, y, width, height);

      // Draw border
      ctx.strokeRect(x, y, width, height);

      // Draw confidence bar at bottom
      const confidenceWidth = (region.confidence / 100) * width;
      ctx.fillStyle = '#10B981';
      ctx.fillRect(x, y + height - 3, confidenceWidth, 3);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    }
  });
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export detection results as an annotated image
 */
export async function exportDetectionImage(
  imageElement: HTMLImageElement | HTMLVideoElement,
  results: DetectionResult,
  settings: Partial<DetectionSettings> = {},
  options: ImageExportOptions = {}
): Promise<ExportResult> {
  try {
    const { width, height } = getMediaDimensions(imageElement);
    const filename = options.filename || generateExportFilename('detection', options.format || 'png');

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { success: false, filename, error: 'Failed to get canvas context' };
    }

    // Draw original image
    drawMediaToCanvas(ctx, imageElement, width, height);

    // Draw detection overlays
    if (options.includeOverlay !== false) {
      drawDetections(ctx, results.objects, settings);
    }

    // Convert to blob and download
    const format = options.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = options.quality ?? 0.92;

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({ success: false, filename, error: 'Failed to create image blob' });
            return;
          }

          downloadBlob(blob, filename);
          resolve({ success: true, filename, fileSize: blob.size });
        },
        format,
        quality
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, filename: '', error: message };
  }
}

/**
 * Export classification results as an annotated image with bottom overlay
 */
export async function exportClassificationImage(
  imageElement: HTMLImageElement | HTMLVideoElement,
  analysis: ClassificationAnalysis,
  options: ImageExportOptions = {}
): Promise<ExportResult> {
  try {
    const { width, height } = getMediaDimensions(imageElement);
    const filename = options.filename || generateExportFilename('classification', options.format || 'png');

    // Create canvas with extra space for overlay
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height + DEFAULT_CLASSIFICATION_OVERLAY.barHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { success: false, filename, error: 'Failed to get canvas context' };
    }

    // Draw original image at the top of the canvas
    drawMediaToCanvas(ctx, imageElement, width, height);

    // Draw classification overlay in the extra space below the image
    if (options.includeOverlay !== false) {
      drawClassificationOverlay(ctx, analysis, width, canvas.height);
    }

    // Convert to blob and download
    const format = options.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = options.quality ?? 0.92;

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({ success: false, filename, error: 'Failed to create image blob' });
            return;
          }

          downloadBlob(blob, filename);
          resolve({ success: true, filename, fileSize: blob.size });
        },
        format,
        quality
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, filename: '', error: message };
  }
}

/**
 * Export OCR results as an annotated image and a text file
 */
export async function exportOCRResults(
  imageElement: HTMLImageElement | HTMLVideoElement,
  analysis: OCRAnalysis,
  options: ImageExportOptions = {}
): Promise<{ imageResult: ExportResult; textResult: ExportResult }> {
  // Export annotated image
  const imageResult = await exportOCRImage(imageElement, analysis, options);

  // Export text file
  const textResult = await exportOCRText(analysis);

  return { imageResult, textResult };
}

/**
 * Export OCR results as an annotated image
 */
export async function exportOCRImage(
  imageElement: HTMLImageElement | HTMLVideoElement,
  analysis: OCRAnalysis,
  options: ImageExportOptions = {}
): Promise<ExportResult> {
  try {
    const { width, height } = getMediaDimensions(imageElement);
    const filename = options.filename || generateExportFilename('ocr', options.format || 'png');

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { success: false, filename, error: 'Failed to get canvas context' };
    }

    // Draw original image
    drawMediaToCanvas(ctx, imageElement, width, height);

    // Draw OCR overlays
    if (options.includeOverlay !== false) {
      drawOCROverlay(ctx, analysis.textRegions);
    }

    // Convert to blob and download
    const format = options.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = options.quality ?? 0.92;

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({ success: false, filename, error: 'Failed to create image blob' });
            return;
          }

          downloadBlob(blob, filename);
          resolve({ success: true, filename, fileSize: blob.size });
        },
        format,
        quality
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, filename: '', error: message };
  }
}

/**
 * Export OCR extracted text as a text file
 */
export async function exportOCRText(
  analysis: OCRAnalysis,
  options: TextExportOptions = {}
): Promise<ExportResult> {
  try {
    const filename = options.filename || generateExportFilename('ocr', 'txt');

    const blob = new Blob([analysis.fullText], { type: 'text/plain' });
    downloadBlob(blob, filename);

    return { success: true, filename, fileSize: blob.size };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, filename: '', error: message };
  }
}

/**
 * Export results as JSON file
 */
export async function exportResultsAsJSON(
  mode: AnalysisMode,
  results: DetectionResult | ClassificationAnalysis | OCRAnalysis,
  options: JSONExportOptions = {}
): Promise<ExportResult> {
  try {
    const filename = options.filename || generateExportFilename(mode, 'json');
    const prettyPrint = options.prettyPrint !== false;

    const json = prettyPrint
      ? JSON.stringify(results, null, 2)
      : JSON.stringify(results);

    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, filename);

    return { success: true, filename, fileSize: blob.size };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, filename: '', error: message };
  }
}

/**
 * Copy results as JSON to clipboard
 */
export async function copyResultsAsJSON(
  results: DetectionResult | ClassificationAnalysis | OCRAnalysis
): Promise<{ success: boolean; error?: string }> {
  try {
    const json = JSON.stringify(results, null, 2);

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(json);
      return { success: true };
    }

    // Fallback for non-secure contexts
    const textArea = document.createElement('textarea');
    textArea.value = json;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (!success) {
      return { success: false, error: 'execCommand copy failed' };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ============================================================================
// Service Instance
// ============================================================================

export const exportService = {
  exportDetectionImage,
  exportClassificationImage,
  exportOCRResults,
  exportOCRImage,
  exportOCRText,
  exportResultsAsJSON,
  copyResultsAsJSON,
};
