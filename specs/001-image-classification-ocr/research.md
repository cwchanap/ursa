# Research: Image Classification and OCR Technologies

**Feature**: Image Classification and OCR Support
**Branch**: 001-image-classification-ocr
**Date**: 2025-11-30

## Overview

This document consolidates research findings for implementing image classification and OCR capabilities in Ursa. All technical decisions are based on compatibility with the existing TensorFlow.js architecture, browser-side processing constraints, and constitutional performance requirements.

---

## 1. Image Classification Model Selection

### Decision: TensorFlow.js MobileNetV2

**Rationale**:

- **Performance**: ~60ms inference time on WebGL backend meets <3 second total processing requirement
- **Accuracy**: 71% top-1 ImageNet accuracy sufficient for general-purpose classification
- **Size**: ~9MB model size fits within 10-second load time constraint on broadband
- **Compatibility**: Official TensorFlow.js model, seamless integration with existing WebGL backend
- **Mobile-First**: Optimized for resource-constrained environments (aligns with browser constraints)

**Alternatives Considered**:

| Model            | Pros                                 | Cons                                           | Why Rejected                                                      |
| ---------------- | ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------- |
| **MobileNetV1**  | Fastest (~50ms), smallest (4MB)      | Lower accuracy (70% top-1)                     | Minimal performance gain (~10ms) not worth accuracy loss          |
| **ResNet50**     | Higher accuracy (75% top-1)          | Slow inference (~150ms), large model (98MB)    | Exceeds performance budget, 2.5x slower than target               |
| **EfficientNet** | Best accuracy/size ratio (77%, 29MB) | Moderate speed (~80ms), less browser-optimized | Larger model increases load time, diminishing returns on accuracy |
| **Inception-v3** | High accuracy (78% top-1)            | Very large (95MB), slow (~200ms)               | Load time >10s on typical connections, performance bottleneck     |

**Implementation Notes**:

- Use `@tensorflow-models/mobilenet` npm package (official)
- Load model version 2 with alpha=1.0 (full-width model for best accuracy)
- Preprocess images to 224x224 (MobileNetV2 input size)
- Return top-5 predictions sorted by confidence (ImageNet standard)

**References**:

- TensorFlow.js MobileNet documentation: https://github.com/tensorflow/tfjs-models/tree/master/mobilenet
- MobileNetV2 paper: https://arxiv.org/abs/1801.04381

---

## 2. OCR Library Selection

### Decision: Tesseract.js 5.x

**Rationale**:

- **Maturity**: Industry-standard OCR engine (Google's Tesseract), 15+ years of development
- **Language Support**: 100+ languages via downloadable language packs (meets multilingual requirement)
- **Browser Compatibility**: WebAssembly-based, works in all modern browsers without plugins
- **Accuracy**: 90%+ accuracy for clean printed text (meets SC-004)
- **Size**: Core engine ~2MB + English language pack ~4MB (acceptable load time)
- **TypeScript Support**: Official type definitions, no `any` types needed
- **Offline Capable**: Language packs cached after first download

**Alternatives Considered**:

| Solution                     | Pros                                         | Cons                                                                | Why Rejected                                                 |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| **TensorFlow.js OCR models** | Integrated with existing TF.js setup         | Experimental, limited languages, lower accuracy                     | Not production-ready, English-only for most models           |
| **Google Cloud Vision API**  | Highest accuracy (95%+), no client-side load | Requires API key, privacy concerns, cost per use, internet required | Violates offline-first principle, user data leaves browser   |
| **OCR.space API**            | Free tier, simple integration                | Internet required, rate limits, privacy issues                      | Same concerns as Cloud Vision                                |
| **Custom LSTM model**        | Maximum control                              | Requires training data, development effort, uncertain accuracy      | Development timeline too long, no clear accuracy improvement |
| **Paddle.js OCR**            | Good accuracy, Chinese/English focus         | Less mature, larger bundle, fewer languages                         | Tesseract.js has broader language support and community      |

**Implementation Notes**:

- Use `tesseract.js` npm package (latest v5.x)
- Initialize worker on first use, keep alive for session (avoid re-initialization)
- Download English language pack by default (~4MB)
- Lazy-load additional language packs on demand
- Use PSM_AUTO (page segmentation mode automatic) for general-purpose OCR
- Extract bounding boxes for hover interaction (Word level granularity)
- Terminate worker on component unmount or page unload

**Performance Optimization**:

- Use WebAssembly backend (faster than JavaScript fallback)
- Process images at max 2000px width (scale down larger images)
- Cache language packs in browser storage (avoid re-download)
- Run OCR in Web Worker to avoid blocking main thread

**References**:

- Tesseract.js documentation: https://tesseract.projectnaptha.com/
- Language pack repository: https://github.com/naptha/tessdata

---

## 3. UI Pattern: Tabbed Interface for Analysis Results

### Decision: Tailwind CSS-based Tab Component

**Rationale**:

- **Consistency**: Matches existing Tailwind CSS 4.x design system
- **Accessibility**: Native HTML `<button>` elements with ARIA attributes
- **Simplicity**: No additional UI library dependencies
- **Performance**: Minimal JavaScript, CSS-only transitions
- **Responsive**: Works on mobile and desktop (important for camera access)

**Alternatives Considered**:

| Approach                 | Pros                             | Cons                                                  | Why Rejected                                   |
| ------------------------ | -------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| **Accordion panels**     | Space-efficient, mobile-friendly | Requires clicking to see each result, less intuitive  | More steps to view multiple results            |
| **Side-by-side columns** | Parallel view of all results     | Poor mobile experience, requires horizontal scrolling | Mobile users are primary use case for camera   |
| **Stacked panels**       | All visible at once              | Requires vertical scrolling, cluttered on mobile      | Conflicts with existing MediaViewer layout     |
| **Radix UI Tabs**        | Pre-built accessibility          | Adds React dependency (Ursa uses Astro), bundle bloat | Architectural mismatch, unnecessary dependency |

**Implementation Notes**:

- Create `AnalysisModeTabs.astro` component with three tabs: "Detection", "Classification", "OCR"
- Active tab state managed via Svelte store (reactive, lightweight)
- Content panels show/hide with CSS `display: none` (instant switching, no animation overhead)
- Tab buttons use `aria-selected` and `role="tab"` for screen readers
- Keyboard navigation: Arrow keys to switch tabs, Tab key to focus content

**Design Tokens** (Tailwind CSS):

```css
/* Active tab */
bg-blue-600 text-white border-b-2 border-blue-600

/* Inactive tab */
bg-gray-100 text-gray-700 hover:bg-gray-200 border-b-2 border-transparent
```

**References**:

- ARIA tabs pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- Tailwind CSS components: https://tailwindcss.com/docs/

---

## 4. Canvas Overlay Strategy for OCR Bounding Boxes

### Decision: Extend ObjectDetectionOverlay for OCR Regions

**Rationale**:

- **Code Reuse**: Existing `ObjectDetectionOverlay.astro` already handles canvas lifecycle
- **Consistency**: Same visual style as object detection bounding boxes
- **Performance**: Canvas rendering already optimized for 5-10 FPS
- **Memory Management**: Overlay cleanup patterns already implemented

**Implementation Approach**:

- Draw rectangular bounding boxes around detected text regions
- Use different color for OCR boxes (e.g., green vs. red for objects)
- On hover: Show tooltip with extracted text above/below bounding box
- Tooltip uses CSS `position: absolute` with dynamic x/y coordinates
- Clear canvas and redraw on each video frame (same as object detection)

**Hover Interaction**:

1. Mouse enters bounding box region → Calculate mouse x/y vs. bbox coordinates
2. If mouse inside bbox → Show tooltip with extracted text
3. Mouse leaves bbox → Hide tooltip
4. Tooltip positioned to avoid edge clipping (flip to opposite side if near edge)

**Color Coding**:

- Object detection boxes: Red (#EF4444)
- OCR text boxes: Green (#10B981)
- Classification results: No boxes (text-only list)

**Alternatives Considered**:

- **Direct text overlay**: Clearer but clutters video, unreadable if text overlaps
- **Sidebar with synchronized highlights**: More complex, requires layout changes
- **Click-to-reveal instead of hover**: Extra interaction step, less intuitive

**References**:

- Existing implementation: `src/lib/objectDetectionOverlay.ts`
- Canvas 2D API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

---

## 5. Memory Management for New ML Models

### Decision: Unified Disposal Pattern with Lifecycle Hooks

**Rationale**:

- **Constitution Compliance**: Principle V requires explicit cleanup for ML resources
- **Memory Leaks Prevention**: Both TensorFlow.js and Tesseract.js allocate WASM memory
- **Existing Pattern**: ObjectDetection class already implements `dispose()` method

**Cleanup Strategy**:

**MobileNetV2 (imageClassification.ts)**:

```typescript
async dispose(): Promise<void> {
  if (this.model) {
    this.model.dispose(); // TensorFlow.js cleanup
    this.model = null;
  }
}
```

**Tesseract.js (ocrExtraction.ts)**:

```typescript
async dispose(): Promise<void> {
  if (this.worker) {
    await this.worker.terminate(); // WebAssembly worker cleanup
    this.worker = null;
  }
}
```

**Lifecycle Hooks**:

1. **On mode switch**: Call `dispose()` on inactive mode's model (e.g., switching from OCR to Classification)
2. **On page unload**: Call `dispose()` on all models via `beforeunload` event
3. **On error**: Call `dispose()` in finally block to prevent orphaned resources
4. **On video stop**: Keep models loaded (user may restart video)

**Memory Budget**:

- COCO-SSD: ~13MB (existing)
- MobileNetV2: ~9MB (new)
- Tesseract.js: ~6MB (2MB core + 4MB English pack) (new)
- **Total**: ~28MB model memory + <50MB operational growth over 10 min

**Monitoring**:

- Use `performance.memory` API in Chrome to track heap usage
- Log warnings if memory growth exceeds 5MB/minute
- Provide manual "Clear Memory" button in dev mode

**References**:

- TensorFlow.js memory management: https://www.tensorflow.org/js/guide/tensors_operations#memory
- Tesseract.js worker termination: https://github.com/naptha/tesseract.js/blob/master/docs/api.md#worker-terminate

---

## 6. CDN vs. NPM Package Strategy

### Decision: Hybrid Approach (NPM for TensorFlow.js, CDN for Tesseract.js)

**Rationale**:

- **TensorFlow.js**: Already using npm packages (`@tensorflow/tfjs`, `@tensorflow-models/*`)
- **Tesseract.js**: Better via npm to leverage Vite bundling and tree-shaking
- **MobileNetV2**: Use npm package for consistency

**Implementation**:

**package.json additions**:

```json
{
  "dependencies": {
    "@tensorflow-models/mobilenet": "^2.1.1",
    "tesseract.js": "^5.0.4"
  }
}
```

**Import pattern** (following existing objectDetection.ts):

```typescript
import * as mobilenet from '@tensorflow-models/mobilenet';
import { createWorker } from 'tesseract.js';
```

**Why Not CDN for Tesseract.js**:

- npm version integrates better with TypeScript
- Vite can optimize bundle (code splitting, tree shaking)
- Easier dependency version management
- Local development doesn't require internet for CDN assets

**Language Pack Loading** (Tesseract.js):

- Language packs loaded from CDN at runtime (separate from main bundle)
- Cached in browser after first download
- Default: English (`eng.traineddata` ~4MB)
- On-demand: Load other languages when user selects them

**References**:

- TensorFlow.js installation guide: https://www.tensorflow.org/js/guide/platform_and_environment
- Tesseract.js npm package: https://www.npmjs.com/package/tesseract.js

---

## 7. Testing Strategy for ML Features

### Decision: Unit Tests with Mocks + Manual Browser Integration Tests

**Rationale**:

- **Unit Tests**: Fast, deterministic, run in CI/CD
- **Integration Tests**: Verify actual ML model behavior (can't be mocked)
- **Existing Pattern**: Vitest already set up for unit tests

**Unit Test Approach** (Vitest + Mocks):

**imageClassification.test.ts**:

- Mock `@tensorflow-models/mobilenet` using Vitest `vi.mock()`
- Test model initialization, loading states, error handling
- Test top-5 result filtering and sorting
- Test dispose() cleanup

**ocrExtraction.test.ts**:

- Mock `tesseract.js` worker creation
- Test language pack loading states
- Test bounding box extraction
- Test worker termination

**integration/analysis-modes.test.ts**:

- Use `@testing-library/svelte` to test UI interactions
- Mock ML models but test actual tab switching logic
- Test results display, copy to clipboard functionality
- Test mode persistence (if user reloads page)

**Manual Browser Tests** (Required):

1. Load actual MobileNetV2 model in Chrome DevTools
2. Run classification on sample images (beach, cat, car)
3. Verify top-5 results match expected ImageNet categories
4. Check WebGL backend is used (`tf.getBackend()` returns 'webgl')
5. Monitor memory usage over 10-minute session
6. Test OCR with sample document images
7. Verify bounding box hover interactions
8. Test on mobile Safari (camera access, touch interactions)

**Test Images** (include in `/public/test-images/`):

- `beach-sunset.jpg` - Expected: beach, sunset, ocean
- `cat-portrait.jpg` - Expected: cat, tabby, whiskers
- `document-receipt.jpg` - Expected text: "RECEIPT", "TOTAL", "$XX.XX"
- `street-sign.jpg` - Expected text: "STOP", "Main St."

**CI/CD Integration**:

- Unit tests run on every commit (fast, <10 seconds)
- Integration tests run on PR (slower, may skip actual model loading)
- Manual browser tests required before merging to main

**References**:

- Vitest mocking: https://vitest.dev/guide/mocking.html
- Testing Library: https://testing-library.com/docs/svelte-testing-library/intro

---

## 8. Performance Benchmarking Plan

### Decision: Implement Performance Marks API for Real-Time Monitoring

**Rationale**:

- **Constitution Requirement**: Performance-First Design principle mandates performance tracking
- **User Visibility**: Show inference times in dev mode
- **Optimization Baseline**: Establish metrics before/after optimizations

**Metrics to Track**:

| Metric                       | Target   | Measurement Method                                        |
| ---------------------------- | -------- | --------------------------------------------------------- |
| MobileNetV2 load time        | <5s      | `performance.mark()` from init start to model ready       |
| Classification inference     | <60ms    | `performance.measure()` from image input to top-5 results |
| Tesseract.js worker init     | <2s      | `performance.mark()` from worker creation to ready        |
| OCR processing (single page) | <3s      | `performance.measure()` from recognize start to results   |
| Video FPS (classification)   | 5-10 FPS | Calculate 1000ms / inference time                         |
| Video FPS (OCR)              | 5-10 FPS | Throttle OCR to match (longer processing time)            |
| Memory growth rate           | <5MB/min | `performance.memory.usedJSHeapSize` delta                 |

**Implementation**:

```typescript
// In imageClassification.ts
performance.mark('mobilenet-load-start');
const model = await mobilenet.load();
performance.mark('mobilenet-load-end');
performance.measure('mobilenet-load', 'mobilenet-load-start', 'mobilenet-load-end');

const measure = performance.getEntriesByName('mobilenet-load')[0];
console.log(`MobileNetV2 loaded in ${measure.duration}ms`);
```

**Dev Mode Display**:

- Show inference time overlay on video (e.g., "Classification: 58ms")
- Color-code based on performance: Green <60ms, Yellow 60-100ms, Red >100ms
- Display FPS counter for video streams
- Memory usage graph (optional, advanced)

**Production**:

- Remove console logs
- Keep performance marks for browser DevTools analysis
- Optional: Send anonymized metrics to analytics (with user consent)

**References**:

- Performance API: https://developer.mozilla.org/en-US/docs/Web/API/Performance
- Performance measurement guide: https://web.dev/articles/user-centric-performance-metrics

---

## Summary of Research Decisions

| Component                  | Decision                                     | Key Rationale                                                       |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| **Classification Model**   | TensorFlow.js MobileNetV2                    | Best balance of speed (60ms), accuracy (71%), and size (9MB)        |
| **OCR Library**            | Tesseract.js 5.x                             | Industry standard, 100+ languages, WebAssembly-based, 90%+ accuracy |
| **UI Pattern**             | Tailwind CSS Tabs                            | Matches existing design system, accessible, lightweight             |
| **Canvas Overlay**         | Extend ObjectDetectionOverlay                | Code reuse, consistent with existing architecture                   |
| **Memory Management**      | Unified dispose() pattern                    | Prevents leaks, follows existing ObjectDetection pattern            |
| **Package Strategy**       | NPM for both (hybrid CDN for language packs) | Better TypeScript integration, Vite optimization                    |
| **Testing**                | Unit (mocked) + Manual browser tests         | Fast CI/CD + real ML verification                                   |
| **Performance Monitoring** | Performance Marks API                        | Real-time tracking, dev mode visibility                             |

**Next Phase**: Use these research findings to design data models and API contracts in Phase 1.
