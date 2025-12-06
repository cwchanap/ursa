/**
 * Bounding Box Utilities
 *
 * Utility functions for normalizing and denormalizing bounding box coordinates
 * between pixel coordinates and normalized (0-1) coordinates.
 *
 * @module lib/utils/bboxUtils
 */

import type { NormalizedBBox, OCRResult } from '../types/analysis';

/**
 * Pixel-based bounding box
 */
export interface PixelBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Convert pixel bounding box to normalized coordinates (0-1)
 *
 * @param bbox - Bounding box in pixel coordinates
 * @param imageWidth - Source image width in pixels
 * @param imageHeight - Source image height in pixels
 * @returns Bounding box in normalized coordinates (0-1)
 */
export function normalizeBBox(
  bbox: PixelBBox,
  imageWidth: number,
  imageHeight: number
): NormalizedBBox {
  if (imageWidth <= 0 || imageHeight <= 0) {
    throw new Error('Image dimensions must be positive');
  }

  return {
    x: bbox.x / imageWidth,
    y: bbox.y / imageHeight,
    width: bbox.width / imageWidth,
    height: bbox.height / imageHeight,
  };
}

/**
 * Convert normalized bounding box to pixel coordinates
 *
 * @param bbox - Bounding box in normalized coordinates (0-1)
 * @param targetWidth - Target width in pixels
 * @param targetHeight - Target height in pixels
 * @returns Bounding box in pixel coordinates
 */
export function denormalizeBBox(
  bbox: NormalizedBBox,
  targetWidth: number,
  targetHeight: number
): PixelBBox {
  if (targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('Target dimensions must be positive');
  }

  return {
    x: Math.round(bbox.x * targetWidth),
    y: Math.round(bbox.y * targetHeight),
    width: Math.round(bbox.width * targetWidth),
    height: Math.round(bbox.height * targetHeight),
  };
}

/**
 * Scale bounding box from source to target dimensions
 *
 * @param bbox - Original bounding box in pixels
 * @param sourceWidth - Source image width
 * @param sourceHeight - Source image height
 * @param targetWidth - Target canvas/display width
 * @param targetHeight - Target canvas/display height
 * @returns Scaled bounding box in target coordinates
 */
export function scaleBBox(
  bbox: PixelBBox,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): PixelBBox {
  const normalized = normalizeBBox(bbox, sourceWidth, sourceHeight);
  return denormalizeBBox(normalized, targetWidth, targetHeight);
}

/**
 * Check if a point is inside a bounding box
 *
 * @param x - Point x coordinate
 * @param y - Point y coordinate
 * @param bbox - Bounding box to check against
 * @returns True if point is inside the bounding box
 */
export function isPointInBBox(x: number, y: number, bbox: PixelBBox): boolean {
  return (
    x >= bbox.x &&
    x <= bbox.x + bbox.width &&
    y >= bbox.y &&
    y <= bbox.y + bbox.height
  );
}

/**
 * Find OCR result that contains a given point
 *
 * @param x - Point x coordinate
 * @param y - Point y coordinate
 * @param results - Array of OCR results
 * @returns OCR result containing the point, or null if none found
 */
export function findOCRResultAtPoint(
  x: number,
  y: number,
  results: OCRResult[]
): OCRResult | null {
  for (const result of results) {
    if (result.bbox && isPointInBBox(x, y, result.bbox)) {
      return result;
    }
  }
  return null;
}

/**
 * Get the center point of a bounding box
 *
 * @param bbox - Bounding box
 * @returns Center coordinates {x, y}
 */
export function getBBoxCenter(bbox: PixelBBox): { x: number; y: number } {
  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
  };
}

/**
 * Calculate the area of a bounding box
 *
 * @param bbox - Bounding box
 * @returns Area in square pixels
 */
export function getBBoxArea(bbox: PixelBBox): number {
  return bbox.width * bbox.height;
}

/**
 * Check if two bounding boxes overlap
 *
 * @param bbox1 - First bounding box
 * @param bbox2 - Second bounding box
 * @returns True if bounding boxes overlap
 */
export function doBBoxesOverlap(bbox1: PixelBBox, bbox2: PixelBBox): boolean {
  return !(
    bbox1.x + bbox1.width < bbox2.x ||
    bbox2.x + bbox2.width < bbox1.x ||
    bbox1.y + bbox1.height < bbox2.y ||
    bbox2.y + bbox2.height < bbox1.y
  );
}

/**
 * Expand a bounding box by a given padding
 *
 * @param bbox - Original bounding box
 * @param padding - Padding in pixels (can be negative to shrink)
 * @returns Expanded bounding box
 */
export function expandBBox(bbox: PixelBBox, padding: number): PixelBBox {
  // Clamp width and height to minimum 0 to handle negative padding
  const newWidth = Math.max(0, bbox.width + padding * 2);
  const newHeight = Math.max(0, bbox.height + padding * 2);
  
  // Adjust position to keep the shrunken bbox centered within the original bbox
  const x = bbox.x + (bbox.width - newWidth) / 2;
  const y = bbox.y + (bbox.height - newHeight) / 2;
  
  return {
    x,
    y,
    width: newWidth,
    height: newHeight,
  };
}

/**
 * Clamp bounding box to image boundaries
 *
 * @param bbox - Bounding box to clamp
 * @param imageWidth - Image width
 * @param imageHeight - Image height
 * @returns Clamped bounding box
 */
export function clampBBox(
  bbox: PixelBBox,
  imageWidth: number,
  imageHeight: number
): PixelBBox {
  // First compute clamped coordinates
  const clampedX = Math.max(0, Math.min(bbox.x, imageWidth));
  const clampedY = Math.max(0, Math.min(bbox.y, imageHeight));
  
  // Compute shifts from original position
  const shiftX = clampedX - bbox.x;
  const shiftY = clampedY - bbox.y;
  
  // Adjust width and height to account for origin shifts and ensure no overflow
  const width = Math.max(0, Math.min(bbox.width - shiftX, imageWidth - clampedX));
  const height = Math.max(0, Math.min(bbox.height - shiftY, imageHeight - clampedY));

  return { x: clampedX, y: clampedY, width, height };
}

/**
 * Sort OCR results by reading order (top-to-bottom, left-to-right)
 * For right-to-left languages, use sortByRTLReadingOrder instead
 *
 * @param results - Array of OCR results
 * @returns Sorted array (does not mutate original)
 */
export function sortByReadingOrder(results: OCRResult[]): OCRResult[] {
  return [...results].sort((a, b) => {
    // Skip results without bounding boxes
    if (!a.bbox || !b.bbox) {
      if (!a.bbox && !b.bbox) return 0;
      return a.bbox ? -1 : 1;
    }

    // First sort by vertical position (top-to-bottom)
    // Allow for some tolerance to group items on the same line
    const yTolerance = Math.min(a.bbox.height, b.bbox.height) * 0.5;
    const yDiff = a.bbox.y - b.bbox.y;

    if (Math.abs(yDiff) > yTolerance) {
      return yDiff;
    }

    // If on roughly the same line, sort by horizontal position (left-to-right)
    return a.bbox.x - b.bbox.x;
  });
}

/**
 * Sort OCR results by RTL reading order (top-to-bottom, right-to-left)
 *
 * @param results - Array of OCR results
 * @returns Sorted array (does not mutate original)
 */
export function sortByRTLReadingOrder(results: OCRResult[]): OCRResult[] {
  return [...results].sort((a, b) => {
    if (!a.bbox || !b.bbox) {
      if (!a.bbox && !b.bbox) return 0;
      return a.bbox ? -1 : 1;
    }

    const yTolerance = Math.min(a.bbox.height, b.bbox.height) * 0.5;
    const yDiff = a.bbox.y - b.bbox.y;

    if (Math.abs(yDiff) > yTolerance) {
      return yDiff;
    }

    // RTL: right-to-left for same line
    return b.bbox.x - a.bbox.x;
  });
}
