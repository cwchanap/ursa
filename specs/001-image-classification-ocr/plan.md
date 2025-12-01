# Implementation Plan: Image Classification and OCR Support

**Branch**: `001-image-classification-ocr` | **Date**: 2025-11-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-image-classification-ocr/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Extend Ursa's AI capabilities beyond object detection to include image classification (identifying scenes, concepts, objects) and OCR (extracting text from images). This feature will use TensorFlow.js MobileNetV2 for classification and Tesseract.js for OCR, with a tabbed interface for switching between analysis modes. Real-time video classification and OCR will be supported at 5-10 FPS, following the existing architecture patterns for canvas overlays and memory management.

## Technical Context

**Language/Version**: TypeScript 5.x (Astro 5.14.1 framework)
**Primary Dependencies**:

- TensorFlow.js 4.22.0 with WebGL backend (existing)
- @tensorflow-models/mobilenet (new - for image classification)
- Tesseract.js 5.x (new - WebAssembly-based OCR)
- Existing: Astro, Tailwind CSS 4.x, Bun runtime

**Storage**: Browser-side only (no backend persistence)
**State Management**: Svelte stores for reactive analysis state. The project uses Svelte components (`.svelte`) for interactive UI elements (MediaViewer, Button, ObjectDetectionOverlay) and Astro components (`.astro`) for page layouts and static content. New interactive components MUST use Svelte to leverage reactive stores.
**Testing**: Vitest 4.x with @testing-library/svelte, manual browser testing for WebGL/ML operations
**Target Platform**: Modern browsers with WebGL support (Chrome/Firefox/Safari), HTTPS required in production for camera access
**Project Type**: Web application (single-page Astro site)
**Performance Goals**:

- Classification inference: <60ms per frame (MobileNetV2 spec)
- OCR processing: <3 seconds for standard documents
- Video analysis: 5-10 FPS for real-time classification/OCR
- Model loading: <10 seconds on broadband

**Constraints**:

- Memory growth: <50MB over 10 minutes continuous use
- Bundle size increase: ~11MB total (9MB MobileNetV2 + 2MB Tesseract core)
- WebGL backend required (no CPU fallback for ML operations)
- Browser-side processing only (no server-side ML)

**Scale/Scope**:

- 3 analysis modes (detection, classification, OCR) with combined mode
- Top 5 classification results per analysis
- Support for 100+ languages via Tesseract.js language packs (English default)
- Single-user client-side application

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Performance-First Design ✅

**Compliance**:

- ✅ Video FPS capped at 5-10 (FR-009 aligns with existing pattern)
- ✅ Canvas overlays for OCR bounding boxes (reusing existing overlay system)
- ✅ Large image scaling via CSS max-height (already implemented)
- ✅ Memory cleanup: `dispose()` methods for MobileNetV2 and Tesseract workers
- ✅ WebGL backend for TensorFlow.js (existing infrastructure)

**New Considerations**:

- Tesseract.js uses WebAssembly (not WebGL) - separate memory pool, needs worker cleanup
- Classification model (~9MB) loads once and persists (similar to COCO-SSD)

### II. Graceful Degradation ✅

**Compliance**:

- ✅ Model loading failures → user-friendly error states (FR-008)
- ✅ OCR language pack failures → fallback to English with notification
- ✅ Detection failures → UI remains functional (existing pattern)
- ✅ WebGL check before ML operations (existing)

**New Considerations**:

- Tesseract worker initialization failures (WebAssembly not supported)
- OCR on non-text images → "No text found" instead of errors

### III. TypeScript Strictness ✅

**Compliance**:

- ✅ Explicit `any` only for TensorFlow.js/MobileNetV2 model instances
- ✅ Tesseract.js has official TypeScript definitions (no `any` needed)
- ✅ All public functions with explicit return types
- ✅ Component props typed (Astro + Svelte patterns)

**New Types Required**:

- `ClassificationResult { label: string; confidence: number }`
- `OCRResult { text: string; bbox?: [number, number, number, number]; confidence: number }`
- `AnalysisMode: 'detection' | 'classification' | 'ocr'`

### IV. Component Architecture ✅

**Compliance**:

- ✅ New files in `/src/lib/`: `imageClassification.ts`, `ocrExtraction.ts`
- ✅ Components follow PascalCase (new: `AnalysisModeTabs.astro`)
- ✅ Naming convention: No "object/detection" prefix needed (different domain)
- ✅ Window object pattern for global state (existing `MediaViewer` integration)

**New Components**:

- `src/lib/imageClassification.ts` - MobileNetV2 wrapper
- `src/lib/ocrExtraction.ts` - Tesseract.js wrapper
- `src/components/AnalysisModeTabs.astro` - Tabbed UI for results
- `src/components/ClassificationResults.astro` - Display top 5 labels
- `src/components/OCRResults.astro` - Display extracted text with copy button

### V. Memory Management ✅

**Compliance**:

- ✅ `imageClassification.dispose()` for MobileNetV2 cleanup
- ✅ `ocrExtraction.dispose()` to terminate Tesseract workers
- ✅ Video stream cleanup (existing `MediaViewer` pattern)
- ✅ Canvas removal for OCR overlays (reuse existing overlay system)
- ✅ Event listeners cleanup on component unmount

**New Cleanup Patterns**:

- Tesseract worker termination: `await worker.terminate()`
- Classification model disposal: `model.dispose()` (TensorFlow.js pattern)
- Language pack caching strategy (avoid re-downloading on mode switch)

**GATE RESULT**: ✅ **PASS** - No constitutional violations. All new components align with existing architecture principles.

## Project Structure

### Documentation (this feature)

```text
specs/001-image-classification-ocr/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── analysis-api.ts  # TypeScript interface definitions (client-side contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── objectDetection.ts           # Existing - COCO-SSD wrapper
│   ├── objectDetectionOverlay.ts    # Existing - Canvas overlay system
│   ├── imageClassification.ts       # NEW - MobileNetV2 wrapper
│   ├── ocrExtraction.ts             # NEW - Tesseract.js wrapper
│   └── utils.ts                     # Existing utilities
│
├── components/
│   ├── MediaViewer.svelte            # MODIFY - Add classification/OCR buttons
│   ├── ObjectDetectionOverlay.svelte # Existing - Reuse for OCR overlays
│   ├── OCROverlay.svelte             # NEW - Dedicated OCR canvas overlay with hover tooltips
│   ├── AnalysisModeTabs.svelte       # NEW - Tabbed interface for results
│   ├── ClassificationResults.svelte  # NEW - Display top 5 classification labels
│   └── OCRResults.svelte             # NEW - Display extracted text with copy button
│
├── layouts/
│   └── main.astro                   # Existing - No changes
│
└── pages/
    └── index.astro                  # MODIFY - Add new script tags for MobileNetV2/Tesseract CDN

tests/
├── unit/
│   ├── imageClassification.test.ts  # NEW - MobileNetV2 initialization tests
│   └── ocrExtraction.test.ts        # NEW - Tesseract.js mock tests
│
└── integration/
    └── analysis-modes.test.ts       # NEW - Mode switching and result display tests
```

**Structure Decision**: Web application with client-side TypeScript modules. Following existing Astro patterns with `/src/lib/` for business logic and `/src/components/` for UI. No backend required - all ML processing happens in the browser.

## Complexity Tracking

> No constitutional violations requiring justification.

**Rationale**: This feature extends existing patterns without introducing new architectural complexity. The tabbed interface adds UI complexity but follows standard web component composition. Tesseract.js uses WebAssembly instead of WebGL, but this is a documented exception similar to the existing TensorFlow.js CDN approach.

---

## Phase 1 Post-Design Constitution Re-Evaluation

_Re-checked after completing data model, contracts, and quickstart design._

### I. Performance-First Design ✅ **CONFIRMED**

**Design Compliance**:

- ✅ Top-5 classification limit prevents UI clutter and maintains performance
- ✅ Bounding box hover interaction avoids constant text rendering overhead
- ✅ Svelte store for state management (reactive, minimal overhead)
- ✅ Performance Marks API integrated for real-time monitoring
- ✅ Memory budgeting documented: ~28MB models + <50MB operational growth

**Additional Considerations from Design**:

- Classification inference measured via `performance.measure()` with color-coded display (green <60ms, yellow 60-100ms, red >100ms)
- OCR processing throttled to match 5-10 FPS target for video streams
- Language pack caching strategy prevents re-downloads

**Verdict**: No design decisions violate performance requirements. All optimizations align with existing patterns.

### II. Graceful Degradation ✅ **CONFIRMED**

**Design Compliance**:

- ✅ `ProcessingStatus` enum tracks all error states explicitly
- ✅ `AnalysisError`, `ModelLoadError`, `InferenceError`, `WorkerError` custom error classes
- ✅ User-friendly error messages in `ProcessingState.message`
- ✅ OCR empty results show "No text found" instead of errors
- ✅ Tesseract.js WebAssembly availability check before initialization

**Error Handling Examples from Contracts**:

```typescript
// From contracts/analysis-api.ts
export class ModelLoadError extends AnalysisError {
  constructor(mode: AnalysisMode, reason: string) {
    super(`Failed to load ${mode} model: ${reason}`, 'MODEL_LOAD_FAILED', mode);
  }
}
```

**Verdict**: Error taxonomy is comprehensive and user-centric. All failure modes accounted for.

### III. TypeScript Strictness ✅ **CONFIRMED**

**Design Compliance**:

- ✅ All types exported from `contracts/analysis-api.ts` with full interface definitions
- ✅ `any` usage limited to MobileNetV2 model instance (documented in contracts)
- ✅ Tesseract.js uses official type definitions (no `any` needed)
- ✅ All service interfaces (`IImageClassificationService`, `IOCRExtractionService`) fully typed
- ✅ UI component props typed (`AnalysisModeTabsProps`, `ClassificationResultsProps`, `OCRResultsProps`)

**Type Safety Examples**:

```typescript
// From contracts/analysis-api.ts - fully typed, no implicit any
export interface IImageClassificationService {
  initialize(): Promise<void>;
  classify(request: ClassifyImageRequest): Promise<ClassificationAnalysis>;
  getStatus(): ProcessingStatus;
  isReady(): boolean;
  dispose(): Promise<void>;
}
```

**Verdict**: Type coverage is comprehensive. All public APIs have explicit contracts.

### IV. Component Architecture ✅ **CONFIRMED**

**Design Compliance**:

- ✅ New files follow naming conventions: `imageClassification.ts`, `ocrExtraction.ts` (camelCase in `/src/lib/`)
- ✅ Components follow PascalCase: `AnalysisModeTabs.astro`, `ClassificationResults.astro`, `OCRResults.astro`
- ✅ Window object pattern extended for global state via Svelte store (reactive, cleaner than raw `window`)
- ✅ Component hierarchy documented in quickstart.md

**Architecture Decision**:

- Svelte store (`analysisState`) is a modern, reactive alternative to `window` object assignments
- Store is singleton, accessible via `$analysisState` in components (Astro + Svelte pattern)
- No breaking changes to existing `ObjectDetection` window pattern

**Verdict**: Component structure follows project conventions. Svelte store is an architectural improvement while maintaining compatibility.

### V. Memory Management ✅ **CONFIRMED**

**Design Compliance**:

- ✅ `dispose()` methods in all service interfaces (mandatory via contracts)
- ✅ Lifecycle hooks documented: mode switch, page unload, error cleanup
- ✅ Memory budget calculated: 28MB models + 15KB data structures
- ✅ Worker termination pattern for Tesseract.js: `await worker.terminate()`
- ✅ State clearing on mode switch (FR-010 compliance)

**Memory Management Examples from Quickstart**:

```typescript
// From quickstart.md
async dispose(): Promise<void> {
  if (this.model) {
    this.model.dispose(); // TensorFlow.js cleanup
    this.model = null;
  }
}

async dispose(): Promise<void> {
  if (this.worker) {
    await this.worker.terminate(); // WebAssembly worker cleanup
    this.worker = null;
  }
}
```

**Monitoring Strategy**:

- `performance.memory` API tracking in dev mode
- Warnings if memory growth exceeds 5MB/minute
- Manual "Clear Memory" button for testing

**Verdict**: Memory management is explicit, testable, and constitutional.

---

## Final Constitution Compliance Summary

| Principle                   | Initial Check | Post-Design Check | Status                                               |
| --------------------------- | ------------- | ----------------- | ---------------------------------------------------- |
| I. Performance-First Design | ✅ PASS       | ✅ CONFIRMED      | All performance targets met in design                |
| II. Graceful Degradation    | ✅ PASS       | ✅ CONFIRMED      | Error taxonomy comprehensive                         |
| III. TypeScript Strictness  | ✅ PASS       | ✅ CONFIRMED      | All contracts fully typed                            |
| IV. Component Architecture  | ✅ PASS       | ✅ CONFIRMED      | Follows existing patterns + Svelte store improvement |
| V. Memory Management        | ✅ PASS       | ✅ CONFIRMED      | Explicit cleanup in all services                     |

**Overall Verdict**: ✅ **CONSTITUTIONAL** - This feature is ready to proceed to implementation (Phase 2: Tasks generation via `/speckit.tasks`).
