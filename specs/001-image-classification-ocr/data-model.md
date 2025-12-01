# Data Model: Image Classification and OCR Support

**Feature**: Image Classification and OCR Support
**Branch**: 001-image-classification-ocr
**Date**: 2025-11-30

## Overview

This document defines the data structures, types, and state management for the image classification and OCR feature. All entities are client-side TypeScript types with no backend persistence.

---

## Core Entities

### 1. ClassificationResult

Represents a single image classification prediction with confidence score.

**TypeScript Definition**:

```typescript
export interface ClassificationResult {
  /** Human-readable label from ImageNet taxonomy (e.g., "golden retriever", "beach") */
  label: string;

  /** Confidence score from 0.0 to 1.0 (model prediction probability) */
  confidence: number;

  /** Optional: ImageNet class ID for debugging (e.g., n02099601) */
  classId?: string;
}
```

**Validation Rules**:

- `label`: Non-empty string, max 100 characters
- `confidence`: Float between 0.0 and 1.0 (inclusive)
- `classId`: Optional string, ImageNet synset format (n########)

**Example**:

```typescript
const result: ClassificationResult = {
  label: 'beach',
  confidence: 0.92,
  classId: 'n09428293',
};
```

**State Transitions**: None (immutable value object)

**Relationships**:

- One `ClassificationAnalysis` contains 5 `ClassificationResult` objects (top-5 predictions)

---

### 2. OCRResult

Represents extracted text from an image region with optional bounding box coordinates.

**TypeScript Definition**:

```typescript
export interface OCRResult {
  /** Extracted text content (single word or line) */
  text: string;

  /** Tesseract.js confidence score from 0 to 100 */
  confidence: number;

  /**
   * Bounding box coordinates [x, y, width, height] in pixels
   * Coordinates relative to source image dimensions
   * Optional: May be undefined for full-page text extraction
   */
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Optional: Text language code (ISO 639-2, e.g., "eng", "spa") */
  lang?: string;
}
```

**Validation Rules**:

- `text`: Non-empty string after trimming whitespace
- `confidence`: Integer between 0 and 100 (inclusive)
- `bbox.x`, `bbox.y`: Non-negative integers
- `bbox.width`, `bbox.height`: Positive integers
- `lang`: Optional 3-letter ISO 639-2 code

**Example**:

```typescript
const result: OCRResult = {
  text: 'TOTAL',
  confidence: 95,
  bbox: { x: 120, y: 450, width: 80, height: 24 },
  lang: 'eng',
};
```

**State Transitions**: None (immutable value object)

**Relationships**:

- One `OCRAnalysis` contains array of `OCRResult` objects (variable count)

**Reading Order**:

- Results sorted by `bbox.y` (top-to-bottom), then `bbox.x` (left-to-right)
- For right-to-left languages (e.g., Arabic), reverse x-axis sorting

---

### 3. AnalysisMode

Enum representing the current active analysis type in the UI.

**TypeScript Definition**:

```typescript
export type AnalysisMode = 'detection' | 'classification' | 'ocr';

export const ANALYSIS_MODES = {
  DETECTION: 'detection' as const,
  CLASSIFICATION: 'classification' as const,
  OCR: 'ocr' as const,
} as const;
```

**Valid Values**:

- `'detection'`: Object detection (existing COCO-SSD)
- `'classification'`: Image classification (MobileNetV2)
- `'ocr'`: Optical character recognition (Tesseract.js)

**State Transitions**:

```
         ┌──────────────┐
         │  detection   │ (initial state)
         └──────────────┘
              ↕    ↕
    ┌─────────┘    └─────────┐
    ↓                        ↓
┌────────────────┐    ┌──────────┐
│ classification │ ←→ │   ocr    │
└────────────────┘    └──────────┘
```

- All modes can transition to any other mode
- Mode changes trigger result clearing (FR-010)

**Relationships**:

- One `AnalysisState` has one active `AnalysisMode`
- Mode determines which results component renders in `AnalysisModeTabs`

---

### 4. ProcessingStatus

Enum representing the current processing state for each analysis type.

**TypeScript Definition**:

```typescript
export type ProcessingStatus = 'idle' | 'loading' | 'processing' | 'complete' | 'error';

export interface ProcessingState {
  status: ProcessingStatus;
  message?: string; // Optional error message or status description
  progress?: number; // Optional: 0-100 for model loading progress
}
```

**Valid Values**:

- `'idle'`: No analysis running, no results
- `'loading'`: ML model is being loaded from network
- `'processing'`: Analysis in progress (image/video frame being processed)
- `'complete'`: Analysis finished, results available
- `'error'`: Processing failed (model load error, inference error, etc.)

**State Transitions**:

```
idle → loading → processing → complete
         ↓           ↓
       error  ←──  error
         ↓           ↓
       idle    →   idle (on retry)
```

**Validation Rules**:

- `message`: Required when `status === 'error'`, optional otherwise
- `progress`: Required when `status === 'loading'`, range 0-100

**Example**:

```typescript
const state: ProcessingState = {
  status: 'processing',
  message: 'Classifying image...',
  progress: undefined,
};

const errorState: ProcessingState = {
  status: 'error',
  message: 'Failed to load MobileNetV2 model. Check internet connection.',
  progress: undefined,
};
```

**Relationships**:

- One `AnalysisState` tracks three `ProcessingState` objects (one per mode)

---

### 5. AnalysisState (Global State)

Root state object for all analysis modes and results.

**TypeScript Definition**:

```typescript
export interface AnalysisState {
  /** Currently active analysis mode (determines which tab is visible) */
  activeMode: AnalysisMode;

  /** Processing states for each analysis type */
  processing: {
    detection: ProcessingState;
    classification: ProcessingState;
    ocr: ProcessingState;
  };

  /** Analysis results (null when no analysis run or results cleared) */
  results: {
    detection: DetectionResult | null; // Existing type from objectDetection.ts
    classification: ClassificationAnalysis | null;
    ocr: OCRAnalysis | null;
  };

  /** Currently loaded media element (image or video) */
  mediaElement: HTMLImageElement | HTMLVideoElement | null;

  /** Video stream state (null when using static image) */
  videoStream: {
    isActive: boolean;
    fps: number; // Target FPS for real-time analysis (5-10)
    analysisInterval: number | null; // setInterval ID for stopping
  } | null;
}
```

**Initialization**:

```typescript
const initialState: AnalysisState = {
  activeMode: 'detection',
  processing: {
    detection: { status: 'idle' },
    classification: { status: 'idle' },
    ocr: { status: 'idle' },
  },
  results: {
    detection: null,
    classification: null,
    ocr: null,
  },
  mediaElement: null,
  videoStream: null,
};
```

**State Management**:

- Implemented using Svelte store (reactive, lightweight)
- Exported from `src/lib/analysisState.ts`
- Accessed via `$analysisState` in Svelte components
- Modified via reducer-style update functions

**Update Functions**:

```typescript
export function setActiveMode(mode: AnalysisMode): void;
export function setProcessingStatus(mode: AnalysisMode, state: ProcessingState): void;
export function setResults(mode: AnalysisMode, results: AnalysisResult): void;
export function clearResults(mode: AnalysisMode): void;
export function setMediaElement(element: HTMLImageElement | HTMLVideoElement): void;
export function startVideoStream(fps: number): void;
export function stopVideoStream(): void;
```

---

### 6. ClassificationAnalysis

Container for a single classification analysis run.

**TypeScript Definition**:

```typescript
export interface ClassificationAnalysis {
  /** Top 5 classification results, sorted by confidence descending */
  predictions: ClassificationResult[];

  /** Total inference time in milliseconds */
  inferenceTime: number;

  /** Timestamp when analysis completed (ISO 8601 string) */
  timestamp: string;

  /** Source image dimensions (for reference) */
  imageDimensions: {
    width: number;
    height: number;
  };
}
```

**Validation Rules**:

- `predictions`: Array with exactly 5 elements (top-5 requirement from FR-002)
- `predictions` sorted by `confidence` descending (highest first)
- `inferenceTime`: Positive number in milliseconds
- `timestamp`: Valid ISO 8601 datetime string
- `imageDimensions`: Positive integers

**Example**:

```typescript
const analysis: ClassificationAnalysis = {
  predictions: [
    { label: 'beach', confidence: 0.92 },
    { label: 'sunset', confidence: 0.87 },
    { label: 'ocean', confidence: 0.76 },
    { label: 'sand', confidence: 0.65 },
    { label: 'sky', confidence: 0.58 },
  ],
  inferenceTime: 58,
  timestamp: '2025-11-30T14:32:10.123Z',
  imageDimensions: { width: 1920, height: 1080 },
};
```

**Post-Processing**:

- Filter predictions to top 5 (discard lower-confidence results)
- Sort by confidence descending
- Convert confidence to percentage for display (multiply by 100)

---

### 7. OCRAnalysis

Container for a single OCR analysis run.

**TypeScript Definition**:

```typescript
export interface OCRAnalysis {
  /** Array of recognized text regions (variable length) */
  textRegions: OCRResult[];

  /** Full extracted text concatenated in reading order */
  fullText: string;

  /** Total processing time in milliseconds */
  processingTime: number;

  /** Timestamp when analysis completed (ISO 8601 string) */
  timestamp: string;

  /** Source image dimensions (for bounding box scaling) */
  imageDimensions: {
    width: number;
    height: number;
  };

  /** Language pack used for OCR (e.g., "eng", "eng+spa") */
  language: string;
}
```

**Validation Rules**:

- `textRegions`: Array with 0 or more elements (empty if no text found)
- `textRegions` sorted by reading order (top-to-bottom, left-to-right)
- `fullText`: Concatenation of `textRegions[].text` with newlines
- `processingTime`: Positive number in milliseconds
- `timestamp`: Valid ISO 8601 datetime string
- `language`: Valid Tesseract.js language code

**Example**:

```typescript
const analysis: OCRAnalysis = {
  textRegions: [
    { text: 'RECEIPT', confidence: 98, bbox: { x: 100, y: 50, width: 120, height: 30 } },
    { text: 'TOTAL', confidence: 95, bbox: { x: 80, y: 200, width: 80, height: 24 } },
    { text: '$42.50', confidence: 92, bbox: { x: 200, y: 200, width: 100, height: 24 } },
  ],
  fullText: 'RECEIPT\nTOTAL\n$42.50',
  processingTime: 2450,
  timestamp: '2025-11-30T14:35:22.456Z',
  imageDimensions: { width: 800, height: 600 },
  language: 'eng',
};
```

**Post-Processing**:

- Filter regions with `confidence < 50` (low-confidence noise)
- Sort regions by `bbox.y` ascending, then `bbox.x` ascending
- Concatenate `text` with newlines to produce `fullText`

---

## Existing Entities (Reference)

### DetectionResult (from objectDetection.ts)

Already defined in the codebase, included here for completeness.

```typescript
export interface DetectedObject {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

export interface DetectionResult {
  objects: DetectedObject[];
  inferenceTime: number;
}
```

**Relationship to New Entities**:

- `AnalysisState.results.detection` stores `DetectionResult | null`
- Detection mode uses existing overlay system (no changes needed)

---

## State Lifecycle

### Image Upload Flow

```
1. User uploads image
   ↓
2. Image loads → setMediaElement(imgElement)
   ↓
3. User clicks "Classify" button
   ↓
4. setProcessingStatus('classification', { status: 'loading' })
   ↓
5. imageClassification.initialize() (load MobileNetV2)
   ↓
6. setProcessingStatus('classification', { status: 'processing' })
   ↓
7. imageClassification.classify(imgElement)
   ↓
8. setResults('classification', analysis)
   ↓
9. setProcessingStatus('classification', { status: 'complete' })
   ↓
10. ClassificationResults component renders top 5 labels
```

### Video Stream Flow

```
1. User starts camera
   ↓
2. Video stream active → setMediaElement(videoElement)
   ↓
3. User clicks "Enable Classification"
   ↓
4. startVideoStream(fps: 5)
   ↓
5. setInterval(() => {
     if (processing.classification.status !== 'processing') {
       classify current frame
     }
   }, 1000 / fps)
   ↓
6. Each frame:
   - setProcessingStatus('classification', { status: 'processing' })
   - Run classification
   - setResults('classification', analysis)
   - setProcessingStatus('classification', { status: 'complete' })
   ↓
7. User clicks "Stop Video"
   ↓
8. stopVideoStream() → clearInterval(analysisInterval)
   ↓
9. Stop video tracks → videoElement.srcObject = null
```

### Mode Switch Flow

```
1. User clicks "OCR" tab
   ↓
2. setActiveMode('ocr')
   ↓
3. clearResults('detection') // FR-010: Clear previous results
   ↓
4. clearResults('classification')
   ↓
5. OCRResults component renders (empty state)
   ↓
6. User clicks "Extract Text" button
   ↓
7. (OCR processing flow similar to classification above)
```

---

## Memory Considerations

**Entity Sizes** (approximate):

| Entity                 | Size       | Count           | Total Memory |
| ---------------------- | ---------- | --------------- | ------------ |
| ClassificationResult   | ~50 bytes  | 5 per analysis  | 250 bytes    |
| ClassificationAnalysis | ~400 bytes | 1 (latest only) | 400 bytes    |
| OCRResult              | ~150 bytes | ~50 per page    | 7.5 KB       |
| OCRAnalysis            | ~10 KB     | 1 (latest only) | 10 KB        |
| DetectionResult        | ~200 bytes | 1 (latest only) | 200 bytes    |
| AnalysisState          | ~15 KB     | 1 (singleton)   | 15 KB        |

**Total Data Memory**: <25 KB (negligible compared to model weights)

**Optimization**:

- Only store latest analysis per mode (discard history)
- Video stream: Overwrite results each frame (no accumulation)
- Clear results on mode switch (FR-010)
- No persistence to localStorage (session-only state)

---

## Type Exports

All types exported from `src/lib/types/analysis.ts`:

```typescript
export type {
  ClassificationResult,
  ClassificationAnalysis,
  OCRResult,
  OCRAnalysis,
  AnalysisMode,
  ProcessingStatus,
  ProcessingState,
  AnalysisState,
};

export { ANALYSIS_MODES };
```

**Usage in Components**:

```typescript
import type { ClassificationAnalysis, AnalysisMode } from '@/lib/types/analysis';
```
