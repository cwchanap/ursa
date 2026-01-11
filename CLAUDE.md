# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ursa is an Astro-based web application that provides real-time AI analysis for images and live video streams. It supports three analysis modes:

- **Object Detection**: Real-time object detection using TensorFlow.js COCO-SSD model
- **Image Classification**: Scene/object classification using MobileNet
- **OCR**: Text extraction using Tesseract.js

**Tech Stack**: Astro 5.x, Svelte 5, TypeScript, Tailwind CSS 4.x, TensorFlow.js 4.22.0 (WebGL), Tesseract.js 6.x, Bun package manager

## Development Commands

```bash
# Development
bun run dev          # Start dev server on port 4321
bun run build        # Production build
bun run preview      # Preview production build

# Testing (Vitest with happy-dom)
bun run test                     # Run all tests (use this, not 'bun test')
bun run test:watch               # Watch mode

# Code Quality
bun run lint         # Run ESLint (TypeScript + Astro)
bun run lint:fix     # Auto-fix linting issues

# Git Hooks (via Husky)
# Pre-commit runs lint-staged automatically
```

## Architecture Patterns

### Component Framework

UI components are built with **Svelte 5** (not Astro components):

```
src/components/
├── MediaViewer.svelte           # Main media display, drag-drop, camera access
├── AnalysisModeTabs.svelte      # Mode switching UI (detection/classification/OCR)
├── ObjectDetectionOverlay.svelte # Detection bounding boxes & controls
├── ClassificationResults.svelte  # MobileNet prediction display
├── OCROverlay.svelte            # OCR text region highlights
├── OCRResults.svelte            # Extracted text display
├── PerformanceMonitor.svelte    # Real-time FPS & memory stats
└── Button.svelte                # Reusable button component
```

Astro is used only for pages and layouts (`src/pages/`, `src/layouts/`).

### State Management with Svelte Stores

Global state is managed via Svelte writable stores in `src/lib/stores/analysisState.ts`:

```typescript
import { analysisState, setActiveMode, setDetectionResults } from '@/lib/stores/analysisState';

// Switch modes
setActiveMode('classification');

// Update results
setDetectionResults({ objects: [...], inferenceTime: 150 });

// Derived stores for reactive access
import { activeMode, isAnyProcessing, detectionResults } from '@/lib/stores/analysisState';
```

Key state actions: `setActiveMode()`, `setProcessingStatus()`, `setDetectionResults()`, `setClassificationResults()`, `setOCRResults()`, `clearAllResults()`, `resetAnalysisState()`

### TensorFlow.js Integration

TensorFlow.js is loaded via **npm packages** (not CDN). Vite's `optimizeDeps` pre-bundles them to avoid browser hanging during model loading:

```typescript
// Standard npm imports - see src/lib/objectDetection.ts
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// Model initialization pattern
await tf.setBackend('webgl');
await tf.ready();
this.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
```

**Important Vite config** (`astro.config.mjs`):

- `optimizeDeps.include` lists all TensorFlow packages for pre-bundling
- `node-fetch` is aliased to a browser shim at `src/lib/shims/node-fetch-browser.ts`
- `global` is defined as `globalThis` for TensorFlow.js compatibility

Always check service `getStatus()` or `isReady()` before running inference since model loading is async.

### Canvas Overlay System

Detection and OCR results are rendered on dynamically created canvas overlays:

- Canvas elements are positioned absolutely over media elements
- Coordinates are scaled from detection bbox to canvas dimensions
- Overlays must be cleared and redrawn each detection cycle
- Always set `pointer-events: none` and `z-index: 10`

```typescript
const scaleX = canvas.width / imageWidth;
const scaleY = canvas.height / imageHeight;
```

## File Structure

```
src/
├── components/       # Svelte components (PascalCase)
├── lib/
│   ├── objectDetection.ts       # COCO-SSD detection engine
│   ├── imageClassification.ts   # MobileNet classification
│   ├── ocrExtraction.ts         # Tesseract.js OCR
│   ├── stores/analysisState.ts  # Global Svelte store
│   ├── types/analysis.ts        # TypeScript type definitions
│   ├── errors/                  # Custom error classes
│   └── utils/                   # Utility functions (bboxUtils, memoryMonitor)
├── pages/            # Astro routes
├── layouts/          # Astro layout components
├── styles/           # Global CSS
└── tests/            # Test files (*.test.ts)

.specify/             # SpecKit workflow templates
├── templates/        # Spec, plan, tasks templates
├── scripts/          # Workflow automation
└── memory/           # Project constitution

.claude/commands/     # Claude Code slash commands
```

**Naming Convention**: Detection-related files must be prefixed with "object" or "detection".

## Critical Development Rules

### 1. Performance First

- Video detection FPS capped at 5-10 (set via `startVideoStream()`)
- Large images scaled via CSS `max-height: 400px`
- Always use WebGL backend for TensorFlow.js
- Include `dispose()` methods for memory cleanup

### 2. Memory Management

Required cleanup patterns:

- Call `detector.dispose()` when switching contexts
- Stop video streams via `MediaStreamTrack.stop()`
- Remove dynamically created canvas elements
- Remove event listeners on unmount
- Use `resetAnalysisState()` to clear intervals

### 3. TypeScript Strictness

- Explicit `any` allowed ONLY for TensorFlow.js model returns and prediction types
- All public functions need explicit return types
- Type assertions should include explanatory comments
- ESLint allows `any` as warnings (see `eslint.config.js:44`)

### 4. Graceful Degradation

All failures must be user-friendly:

- Model loading errors → clear error states
- Camera permission denials → actionable guidance
- Detection failures → UI remains functional
- Check WebGL availability before ML operations

## Testing Patterns

Tests use **Vitest** with **happy-dom** and **@testing-library/svelte**:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import MyComponent from './MyComponent.svelte';

// Mock external dependencies
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
```

Test files are co-located with components (e.g., `Button.svelte` → `Button.test.ts`).

## ESLint Configuration

- Custom flat config for Astro + TypeScript
- Svelte files temporarily ignored (see `eslint.config.js:18`)
- Unused vars with `_` prefix are ignored
- `no-console` is warning-level (not error)

## Browser Requirements

- WebGL support (required for TensorFlow.js)
- HTTPS in production (required for camera access via `getUserMedia()`)
- Modern browser: ES2020+, async/await, Canvas API

## SpecKit Workflow Integration

This project uses SpecKit for feature development. Available slash commands:

- `/speckit.specify` - Create/update feature specification
- `/speckit.plan` - Generate implementation plan
- `/speckit.tasks` - Generate task breakdown
- `/speckit.clarify` - Ask targeted clarification questions
- `/speckit.implement` - Execute implementation plan
- `/speckit.analyze` - Cross-artifact consistency analysis
- `/speckit.constitution` - Manage project constitution
- `/speckit.checklist` - Generate custom checklists
- `/speckit.taskstoissues` - Convert tasks to GitHub issues

The project constitution (`.specify/memory/constitution.md`) defines 5 core principles that must be followed. Review it before making architectural changes.

## Path Aliases

TypeScript path mapping configured:

- `@/*` maps to `./src/*`

Example: `import { cn } from '@/lib/utils'`

## Common Gotchas

1. **TensorFlow.js uses npm imports** - Not CDN; see `astro.config.mjs` for Vite optimizations
2. **First detection takes ~13MB** - COCO-SSD model downloads on first load
3. **Camera needs HTTPS** - Local dev works, production requires SSL
4. **Canvas sizing** - Must match media element's `getBoundingClientRect()`, not natural dimensions
5. **Husky pre-commit** - Runs lint-staged automatically (see `.lintstagedrc.json`)
6. **Svelte 5 runes** - Use `$state`, `$derived`, `$effect` for reactivity in `.svelte` files

## Performance Targets

- Video detection: 5-10 FPS
- Model load time: <5s on broadband
- Memory growth: <50MB over 10 minutes
- Time to first detection: <8s from page load

Use browser DevTools Memory panel to verify no leaks during development.
