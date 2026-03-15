import { describe, it, expect } from 'vitest';
import type { OCRResult } from '../types/analysis';
import {
  normalizeBBox,
  denormalizeBBox,
  scaleBBox,
  isPointInBBox,
  findOCRResultAtPoint,
  getBBoxCenter,
  getBBoxArea,
  doBBoxesOverlap,
  expandBBox,
  clampBBox,
  sortByReadingOrder,
  sortByRTLReadingOrder,
  type PixelBBox,
} from './bboxUtils';

describe('normalizeBBox', () => {
  it('converts pixel bbox to normalized coordinates', () => {
    const result = normalizeBBox({ x: 100, y: 50, width: 200, height: 100 }, 400, 200);
    expect(result).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
  });

  it('handles full-size bbox', () => {
    const result = normalizeBBox({ x: 0, y: 0, width: 640, height: 480 }, 640, 480);
    expect(result).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('throws when imageWidth is zero', () => {
    expect(() => normalizeBBox({ x: 0, y: 0, width: 10, height: 10 }, 0, 100)).toThrow(
      'Image dimensions must be positive'
    );
  });

  it('throws when imageHeight is zero', () => {
    expect(() => normalizeBBox({ x: 0, y: 0, width: 10, height: 10 }, 100, 0)).toThrow(
      'Image dimensions must be positive'
    );
  });

  it('throws when dimensions are negative', () => {
    expect(() => normalizeBBox({ x: 0, y: 0, width: 10, height: 10 }, -100, 100)).toThrow(
      'Image dimensions must be positive'
    );
  });
});

describe('denormalizeBBox', () => {
  it('converts normalized bbox to pixel coordinates', () => {
    const result = denormalizeBBox({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, 400, 200);
    expect(result).toEqual({ x: 100, y: 50, width: 200, height: 100 });
  });

  it('rounds to nearest pixel', () => {
    const result = denormalizeBBox({ x: 0.333, y: 0.333, width: 0.333, height: 0.333 }, 100, 100);
    expect(result.x).toBe(33);
    expect(result.y).toBe(33);
  });

  it('throws when targetWidth is zero', () => {
    expect(() => denormalizeBBox({ x: 0, y: 0, width: 1, height: 1 }, 0, 100)).toThrow(
      'Target dimensions must be positive'
    );
  });

  it('throws when targetHeight is zero', () => {
    expect(() => denormalizeBBox({ x: 0, y: 0, width: 1, height: 1 }, 100, 0)).toThrow(
      'Target dimensions must be positive'
    );
  });
});

describe('scaleBBox', () => {
  it('scales bbox from source to target dimensions', () => {
    const bbox = { x: 100, y: 100, width: 200, height: 200 };
    const result = scaleBBox(bbox, 400, 400, 800, 800);
    expect(result).toEqual({ x: 200, y: 200, width: 400, height: 400 });
  });

  it('scales down when target is smaller', () => {
    const bbox = { x: 200, y: 200, width: 200, height: 200 };
    const result = scaleBBox(bbox, 800, 800, 400, 400);
    expect(result).toEqual({ x: 100, y: 100, width: 100, height: 100 });
  });

  it('handles non-square source and target', () => {
    const bbox = { x: 0, y: 0, width: 640, height: 480 };
    const result = scaleBBox(bbox, 640, 480, 320, 240);
    expect(result).toEqual({ x: 0, y: 0, width: 320, height: 240 });
  });
});

describe('isPointInBBox', () => {
  const bbox: PixelBBox = { x: 10, y: 10, width: 100, height: 80 };

  it('returns true for point inside bbox', () => {
    expect(isPointInBBox(50, 50, bbox)).toBe(true);
  });

  it('returns true for point on bbox edge', () => {
    expect(isPointInBBox(10, 10, bbox)).toBe(true);
    expect(isPointInBBox(110, 90, bbox)).toBe(true);
  });

  it('returns false for point outside bbox', () => {
    expect(isPointInBBox(5, 50, bbox)).toBe(false);
    expect(isPointInBBox(50, 5, bbox)).toBe(false);
    expect(isPointInBBox(120, 50, bbox)).toBe(false);
    expect(isPointInBBox(50, 100, bbox)).toBe(false);
  });
});

describe('findOCRResultAtPoint', () => {
  const results: OCRResult[] = [
    { text: 'Hello', confidence: 90, bbox: { x: 0, y: 0, width: 100, height: 30 } },
    { text: 'World', confidence: 85, bbox: { x: 0, y: 50, width: 100, height: 30 } },
    { text: 'NoBBox', confidence: 80 },
  ];

  it('returns OCR result when point is inside its bbox', () => {
    const result = findOCRResultAtPoint(50, 15, results);
    expect(result?.text).toBe('Hello');
  });

  it('returns second result when point is in second bbox', () => {
    const result = findOCRResultAtPoint(50, 65, results);
    expect(result?.text).toBe('World');
  });

  it('returns null when point is not in any bbox', () => {
    expect(findOCRResultAtPoint(50, 35, results)).toBeNull();
  });

  it('skips results without bbox', () => {
    const noBboxResults: OCRResult[] = [{ text: 'NoBBox', confidence: 80 }];
    expect(findOCRResultAtPoint(50, 50, noBboxResults)).toBeNull();
  });

  it('returns null for empty results array', () => {
    expect(findOCRResultAtPoint(50, 50, [])).toBeNull();
  });
});

describe('getBBoxCenter', () => {
  it('returns center of bbox', () => {
    const center = getBBoxCenter({ x: 0, y: 0, width: 100, height: 80 });
    expect(center).toEqual({ x: 50, y: 40 });
  });

  it('returns center when bbox is offset', () => {
    const center = getBBoxCenter({ x: 20, y: 10, width: 60, height: 40 });
    expect(center).toEqual({ x: 50, y: 30 });
  });
});

describe('getBBoxArea', () => {
  it('calculates area correctly', () => {
    expect(getBBoxArea({ x: 0, y: 0, width: 10, height: 20 })).toBe(200);
  });

  it('returns 0 for zero-width bbox', () => {
    expect(getBBoxArea({ x: 0, y: 0, width: 0, height: 20 })).toBe(0);
  });

  it('returns 0 for zero-height bbox', () => {
    expect(getBBoxArea({ x: 0, y: 0, width: 10, height: 0 })).toBe(0);
  });
});

describe('doBBoxesOverlap', () => {
  it('returns true for overlapping bboxes', () => {
    const b1 = { x: 0, y: 0, width: 100, height: 100 };
    const b2 = { x: 50, y: 50, width: 100, height: 100 };
    expect(doBBoxesOverlap(b1, b2)).toBe(true);
  });

  it('returns true for one bbox inside another', () => {
    const outer = { x: 0, y: 0, width: 200, height: 200 };
    const inner = { x: 50, y: 50, width: 50, height: 50 };
    expect(doBBoxesOverlap(outer, inner)).toBe(true);
  });

  it('returns false for non-overlapping bboxes (horizontal)', () => {
    const b1 = { x: 0, y: 0, width: 100, height: 100 };
    const b2 = { x: 200, y: 0, width: 100, height: 100 };
    expect(doBBoxesOverlap(b1, b2)).toBe(false);
  });

  it('returns false for non-overlapping bboxes (vertical)', () => {
    const b1 = { x: 0, y: 0, width: 100, height: 100 };
    const b2 = { x: 0, y: 200, width: 100, height: 100 };
    expect(doBBoxesOverlap(b1, b2)).toBe(false);
  });

  it('returns true for edge-touching bboxes', () => {
    const b1 = { x: 0, y: 0, width: 100, height: 100 };
    const b2 = { x: 100, y: 0, width: 100, height: 100 };
    expect(doBBoxesOverlap(b1, b2)).toBe(true);
  });
});

describe('expandBBox', () => {
  it('expands bbox by padding', () => {
    const result = expandBBox({ x: 10, y: 10, width: 80, height: 60 }, 5);
    expect(result).toEqual({ x: 5, y: 5, width: 90, height: 70 });
  });

  it('shrinks bbox with negative padding', () => {
    const result = expandBBox({ x: 10, y: 10, width: 80, height: 60 }, -5);
    expect(result).toEqual({ x: 15, y: 15, width: 70, height: 50 });
  });

  it('clamps width/height to 0 when padding is too negative', () => {
    const result = expandBBox({ x: 10, y: 10, width: 20, height: 20 }, -20);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it('zero padding returns same dimensions', () => {
    const bbox = { x: 10, y: 10, width: 80, height: 60 };
    expect(expandBBox(bbox, 0)).toEqual(bbox);
  });
});

describe('clampBBox', () => {
  it('returns unchanged bbox when fully inside image', () => {
    const bbox = { x: 10, y: 10, width: 80, height: 60 };
    expect(clampBBox(bbox, 200, 200)).toEqual(bbox);
  });

  it('clamps bbox that extends past right edge', () => {
    const result = clampBBox({ x: 150, y: 0, width: 100, height: 50 }, 200, 200);
    expect(result.x).toBe(150);
    expect(result.width).toBe(50);
  });

  it('clamps bbox that extends past bottom edge', () => {
    const result = clampBBox({ x: 0, y: 150, width: 50, height: 100 }, 200, 200);
    expect(result.y).toBe(150);
    expect(result.height).toBe(50);
  });

  it('clamps bbox with negative origin', () => {
    const result = clampBBox({ x: -10, y: -10, width: 50, height: 50 }, 200, 200);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.width).toBe(40);
    expect(result.height).toBe(40);
  });

  it('returns zero-size bbox when entirely outside image', () => {
    const result = clampBBox({ x: 300, y: 300, width: 50, height: 50 }, 200, 200);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });
});

describe('sortByReadingOrder', () => {
  const makeResult = (text: string, x: number, y: number, h = 20): OCRResult => ({
    text,
    confidence: 90,
    bbox: { x, y, width: 80, height: h },
  });

  it('sorts top-to-bottom then left-to-right', () => {
    const results = [
      makeResult('C', 100, 50),
      makeResult('A', 0, 0),
      makeResult('B', 100, 0),
    ];
    const sorted = sortByReadingOrder(results);
    expect(sorted.map((r) => r.text)).toEqual(['A', 'B', 'C']);
  });

  it('does not mutate the original array', () => {
    const results = [makeResult('B', 100, 0), makeResult('A', 0, 0)];
    const original = [...results];
    sortByReadingOrder(results);
    expect(results[0].text).toBe(original[0].text);
  });

  it('items without bbox are sorted to the end', () => {
    const results: OCRResult[] = [
      { text: 'NoBBox', confidence: 80 },
      makeResult('WithBBox', 0, 0),
    ];
    const sorted = sortByReadingOrder(results);
    expect(sorted[0].text).toBe('WithBBox');
    expect(sorted[1].text).toBe('NoBBox');
  });

  it('groups items on the same line by x position', () => {
    const results = [
      makeResult('Second', 100, 5),
      makeResult('First', 0, 0),
    ];
    const sorted = sortByReadingOrder(results);
    expect(sorted.map((r) => r.text)).toEqual(['First', 'Second']);
  });

  it('returns empty array unchanged', () => {
    expect(sortByReadingOrder([])).toEqual([]);
  });
});

describe('sortByRTLReadingOrder', () => {
  const makeResult = (text: string, x: number, y: number, h = 20): OCRResult => ({
    text,
    confidence: 90,
    bbox: { x, y, width: 80, height: h },
  });

  it('sorts top-to-bottom then right-to-left on same line', () => {
    const results = [
      makeResult('Left', 0, 0),
      makeResult('Right', 200, 0),
    ];
    const sorted = sortByRTLReadingOrder(results);
    expect(sorted[0].text).toBe('Right');
    expect(sorted[1].text).toBe('Left');
  });

  it('still sorts top-to-bottom across lines', () => {
    const results = [
      makeResult('Bottom', 0, 100),
      makeResult('Top', 200, 0),
    ];
    const sorted = sortByRTLReadingOrder(results);
    expect(sorted[0].text).toBe('Top');
    expect(sorted[1].text).toBe('Bottom');
  });

  it('items without bbox are sorted to the end', () => {
    const results: OCRResult[] = [
      { text: 'NoBBox', confidence: 80 },
      makeResult('WithBBox', 0, 0),
    ];
    const sorted = sortByRTLReadingOrder(results);
    expect(sorted[0].text).toBe('WithBBox');
  });
});
