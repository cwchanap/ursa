# Quickstart: Image Classification and OCR Feature

**Feature**: Image Classification and OCR Support
**Branch**: 001-image-classification-ocr
**Date**: 2025-11-30

## Overview

This guide provides a rapid onboarding path for developers implementing or contributing to the image classification and OCR feature in Ursa. Follow this guide to understand the architecture, set up your environment, and make your first changes.

---

## Prerequisites

- **Node.js**: 18+ (Bun runtime compatible)
- **Bun**: 1.0+ (package manager and runtime)
- **Git**: 2.30+
- **Modern Browser**: Chrome/Firefox/Safari with WebGL support
- **Internet Connection**: Required for first-time model downloads (~15MB total)

**Recommended IDE Setup**:

- VS Code with Astro extension
- TypeScript language server
- ESLint extension

---

## Setup (5 minutes)

### 1. Clone and Install

```bash
# Clone repository (if not already done)
git clone <repo-url>
cd ursa

# Checkout feature branch
git checkout 001-image-classification-ocr

# Install dependencies
bun install
```

### 2. Verify Existing Setup

```bash
# Start dev server
bun run dev

# Visit http://localhost:4321
# You should see the existing object detection interface
```

### 3. Install New Dependencies

```bash
# Add classification and OCR libraries
bun add @tensorflow-models/mobilenet tesseract.js

# Verify installation
bun pm ls | grep -E "(mobilenet|tesseract)"
```

Expected output:

```
@tensorflow-models/mobilenet 2.1.1
tesseract.js 5.0.4
```

---

## Architecture Overview (5 minutes)

### Component Hierarchy

```
src/pages/index.astro
│
├── MediaViewer.astro (MODIFY)
│   ├── [Classify Button] → imageClassification.classify()
│   ├── [Extract Text Button] → ocrExtraction.extractText()
│   └── [Enable Video] → startVideoStream()
│
├── AnalysisModeTabs.astro (NEW)
│   ├── Tab: Detection → ObjectDetectionOverlay
│   ├── Tab: Classification → ClassificationResults
│   └── Tab: OCR → OCRResults
│
└── Results Components
    ├── ClassificationResults.astro (NEW)
    ├── OCRResults.astro (NEW)
    └── ObjectDetectionOverlay.astro (EXISTING)
```

### Service Layer

```
src/lib/
├── imageClassification.ts (NEW)
│   └── Wraps @tensorflow-models/mobilenet
│
├── ocrExtraction.ts (NEW)
│   └── Wraps tesseract.js
│
├── analysisState.ts (NEW)
│   └── Svelte store for global state
│
└── objectDetection.ts (EXISTING)
    └── Wraps @tensorflow-models/coco-ssd
```

### Data Flow

```
User clicks "Classify"
    ↓
MediaViewer calls imageClassification.classify(imageElement)
    ↓
imageClassification.ts:
  1. Check if model loaded (if not, load MobileNetV2)
  2. Preprocess image to 224x224
  3. Run inference (WebGL backend)
  4. Return top-5 predictions
    ↓
Update analysisState store with ClassificationAnalysis
    ↓
ClassificationResults.astro reactively renders predictions
```

---

## Key Files to Modify

### Priority 1: Core Services (Start Here)

**File**: `src/lib/imageClassification.ts` (NEW)
**Purpose**: Wrap MobileNetV2 for image classification
**Contract**: Implements `IImageClassificationService` from `contracts/analysis-api.ts`

**Quick Template**:

```typescript
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';

export class ImageClassification {
  private model: any = null;

  async initialize(): Promise<void> {
    await tf.setBackend('webgl');
    await tf.ready();
    this.model = await mobilenet.load();
  }

  async classify(imageElement: HTMLImageElement): Promise<ClassificationAnalysis> {
    const startTime = performance.now();
    const predictions = await this.model.classify(imageElement, 5); // Top 5
    const inferenceTime = performance.now() - startTime;

    return {
      predictions: predictions.map((p) => ({
        label: p.className,
        confidence: p.probability,
      })),
      inferenceTime,
      timestamp: new Date().toISOString(),
      imageDimensions: {
        width: imageElement.naturalWidth || imageElement.videoWidth,
        height: imageElement.naturalHeight || imageElement.videoHeight,
      },
    };
  }

  async dispose(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}
```

---

**File**: `src/lib/ocrExtraction.ts` (NEW)
**Purpose**: Wrap Tesseract.js for OCR
**Contract**: Implements `IOCRExtractionService` from `contracts/analysis-api.ts`

**Quick Template**:

```typescript
import { createWorker } from 'tesseract.js';

export class OCRExtraction {
  private worker: Tesseract.Worker | null = null;

  async initialize(language = 'eng'): Promise<void> {
    this.worker = await createWorker(language);
  }

  async extractText(imageElement: HTMLImageElement): Promise<OCRAnalysis> {
    const startTime = performance.now();
    const { data } = await this.worker.recognize(imageElement);
    const processingTime = performance.now() - startTime;

    const textRegions = data.words.map((word) => ({
      text: word.text,
      confidence: word.confidence,
      bbox: word.bbox,
    }));

    return {
      textRegions,
      fullText: data.text,
      processingTime,
      timestamp: new Date().toISOString(),
      imageDimensions: {
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight,
      },
      language: data.text,
    };
  }

  async dispose(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
```

---

### Priority 2: State Management

**File**: `src/lib/analysisState.ts` (NEW)
**Purpose**: Svelte store for global analysis state
**Contract**: Implements `IAnalysisStateActions` from `contracts/analysis-api.ts`

**Quick Template**:

```typescript
import { writable } from 'svelte/store';
import type { AnalysisState, AnalysisMode, ProcessingState } from './types/analysis';

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

export const analysisState = writable<AnalysisState>(initialState);

export function setActiveMode(mode: AnalysisMode): void {
  analysisState.update((state) => ({ ...state, activeMode: mode }));
}

export function setProcessingStatus(mode: AnalysisMode, processingState: ProcessingState): void {
  analysisState.update((state) => ({
    ...state,
    processing: {
      ...state.processing,
      [mode]: processingState,
    },
  }));
}

// ... (see contracts/analysis-api.ts for full interface)
```

---

### Priority 3: UI Components

**File**: `src/components/AnalysisModeTabs.astro` (NEW)
**Purpose**: Tabbed interface for switching between analysis modes

**Quick Template**:

```astro
---
import type { AnalysisMode } from '@/lib/types/analysis';

export interface Props {
  activeMode: AnalysisMode;
}

const { activeMode } = Astro.props;

const tabs = [
  { mode: 'detection', label: 'Detection' },
  { mode: 'classification', label: 'Classification' },
  { mode: 'ocr', label: 'OCR' },
] as const;
---

<div class="border-b border-gray-200">
  <nav class="flex space-x-4" aria-label="Analysis modes">
    {tabs.map(tab => (
      <button
        data-mode={tab.mode}
        class:list={[
          "px-4 py-2 border-b-2 font-medium transition-colors",
          activeMode === tab.mode
            ? "border-blue-600 text-blue-600"
            : "border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300"
        ]}
        role="tab"
        aria-selected={activeMode === tab.mode}
      >
        {tab.label}
      </button>
    ))}
  </nav>
</div>

<script>
  import { setActiveMode } from '@/lib/analysisState';

  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', (e) => {
      const mode = (e.target as HTMLElement).dataset.mode as AnalysisMode;
      setActiveMode(mode);
    });
  });
</script>
```

---

**File**: `src/components/ClassificationResults.astro` (NEW)
**Purpose**: Display top-5 classification predictions

**Quick Template**:

```astro
---
import type { ClassificationAnalysis } from '@/lib/types/analysis';

export interface Props {
  analysis: ClassificationAnalysis | null;
}

const { analysis } = Astro.props;
---

<div class="p-4">
  {analysis ? (
    <div>
      <h3 class="font-semibold mb-2">Top 5 Predictions</h3>
      <ul class="space-y-2">
        {analysis.predictions.map(pred => (
          <li class="flex justify-between items-center">
            <span class="capitalize">{pred.label}</span>
            <span class="font-mono text-sm text-gray-600">
              {(pred.confidence * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
      <p class="text-xs text-gray-500 mt-4">
        Inference: {analysis.inferenceTime.toFixed(0)}ms
      </p>
    </div>
  ) : (
    <p class="text-gray-500">No classification results yet. Click "Classify" to start.</p>
  )}
</div>
```

---

## Testing Your Changes

### Unit Tests

```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch

# Test specific file
bun run test src/lib/imageClassification.test.ts
```

### Manual Browser Testing

1. **Start dev server**: `bun run dev`
2. **Open DevTools**: F12 → Console tab
3. **Upload test image**: Use `/public/test-images/beach-sunset.jpg`
4. **Click "Classify"**: Verify top-5 results appear
5. **Check performance**:
   ```javascript
   performance.getEntriesByType('measure').filter((m) => m.name.includes('classification'));
   ```
6. **Memory check**:
   ```javascript
   performance.memory.usedJSHeapSize / 1024 / 1024; // MB
   ```

### Integration Testing

```bash
# Lint check
bun run lint

# Build check
bun run build

# Preview production build
bun run preview
```

---

## Common Development Tasks

### Task: Add a New Analysis Mode

1. **Update `AnalysisMode` type** in `src/lib/types/analysis.ts`:

   ```typescript
   export type AnalysisMode = 'detection' | 'classification' | 'ocr' | 'new-mode';
   ```

2. **Add processing state** to `AnalysisState.processing`:

   ```typescript
   processing: {
     // ...
     'new-mode': ProcessingState;
   }
   ```

3. **Create service class** in `src/lib/newModeService.ts`

4. **Create results component** in `src/components/NewModeResults.astro`

5. **Add tab** to `AnalysisModeTabs.astro`

---

### Task: Change Top-K Classification Results

**File**: `src/lib/imageClassification.ts`

Change this line:

```typescript
const predictions = await this.model.classify(imageElement, 5); // Top 5
```

To:

```typescript
const predictions = await this.model.classify(imageElement, 10); // Top 10
```

**Also update**:

- `ClassificationAnalysis` validation in `data-model.md`
- UI layout in `ClassificationResults.astro` (handle more results)

---

### Task: Add OCR Language Support

**File**: `src/components/OCRResults.astro`

Add language selector:

```astro
<select id="language-select">
  <option value="eng">English</option>
  <option value="spa">Spanish</option>
  <option value="fra">French</option>
</select>

<script>
  import { ocrExtraction } from '@/lib/ocrExtraction';

  document.getElementById('language-select').addEventListener('change', async (e) => {
    const lang = (e.target as HTMLSelectElement).value;
    await ocrExtraction.loadLanguage(lang);
  });
</script>
```

---

## Debugging Tips

### Issue: Model Not Loading

**Symptom**: "Failed to load MobileNetV2 model" error

**Solutions**:

1. Check internet connection (models download from CDN)
2. Verify WebGL is available:
   ```javascript
   await tf.setBackend('webgl');
   console.log(tf.getBackend()); // Should be 'webgl'
   ```
3. Check browser console for CORS errors
4. Clear cache and reload

---

### Issue: Slow Classification Inference

**Symptom**: Inference time >100ms consistently

**Solutions**:

1. Verify WebGL backend is used (not CPU fallback)
2. Check image size (should be scaled to 224x224, not larger)
3. Monitor GPU usage in Chrome DevTools → Performance tab
4. Reduce video FPS if running real-time analysis

---

### Issue: OCR Not Detecting Text

**Symptom**: `textRegions` array is empty

**Solutions**:

1. Check image quality (blurry text may fail)
2. Verify language pack matches image text language
3. Lower `minConfidence` threshold:
   ```typescript
   const request = { imageElement, minConfidence: 30 }; // Lower threshold
   ```
4. Check Tesseract.js worker status:
   ```javascript
   console.log(ocrExtraction.getStatus()); // Should be 'idle' or 'processing'
   ```

---

### Issue: Memory Leak

**Symptom**: Browser tab becomes slow after 5+ minutes

**Solutions**:

1. Verify `dispose()` is called on mode switch
2. Check for orphaned event listeners
3. Monitor memory growth:
   ```javascript
   setInterval(() => {
     console.log('Memory:', (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2), 'MB');
   }, 5000);
   ```
4. Call `dispose()` manually in DevTools:
   ```javascript
   window.imageClassification.dispose();
   window.ocrExtraction.dispose();
   ```

---

## Performance Benchmarks

**Target Performance** (from research.md):

| Metric                   | Target   | Measurement                        |
| ------------------------ | -------- | ---------------------------------- |
| MobileNetV2 load         | <5s      | First classification time          |
| Classification inference | <60ms    | Per-frame processing time          |
| Tesseract worker init    | <2s      | First OCR time                     |
| OCR processing           | <3s      | Single-page document               |
| Video FPS                | 5-10 FPS | Calculated: 1000ms / inferenceTime |

**How to Measure**:

```javascript
// In browser DevTools console
performance.getEntriesByType('measure').forEach((m) => {
  console.log(`${m.name}: ${m.duration.toFixed(2)}ms`);
});
```

---

## Next Steps

1. **Implement Core Services**: Start with `imageClassification.ts` and `ocrExtraction.ts`
2. **Set Up State Management**: Implement `analysisState.ts` Svelte store
3. **Build UI Components**: Create `AnalysisModeTabs.astro` and results components
4. **Integrate with MediaViewer**: Add "Classify" and "Extract Text" buttons
5. **Write Tests**: Add unit tests for services, integration tests for components
6. **Performance Testing**: Benchmark against targets, optimize if needed
7. **Documentation**: Update README with new features

**Ready to start?** Begin with `src/lib/imageClassification.ts` using the template above.

---

## Resources

- **Spec**: [spec.md](./spec.md)
- **Implementation Plan**: [plan.md](./plan.md)
- **Research**: [research.md](./research.md)
- **Data Model**: [data-model.md](./data-model.md)
- **API Contracts**: [contracts/analysis-api.ts](./contracts/analysis-api.ts)

**External Documentation**:

- TensorFlow.js MobileNet: https://github.com/tensorflow/tfjs-models/tree/master/mobilenet
- Tesseract.js: https://tesseract.projectnaptha.com/
- Astro Components: https://docs.astro.build/en/core-concepts/astro-components/
- Svelte Stores: https://svelte.dev/docs#run-time-svelte-store

**Questions?** Check [CLAUDE.md](../../../CLAUDE.md) for project-wide guidance.
