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

# Testing
bun run test         # Run tests (Vitest)
bun run test:watch   # Watch mode for tests

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
├── MediaViewer.svelte           # Main media display & controls
├── ObjectDetectionOverlay.svelte # Detection bounding boxes
├── ClassificationResults.svelte  # Classification predictions
├── OCROverlay.svelte            # OCR text region highlights
├── OCRResults.svelte            # Extracted text display
├── AnalysisModeTabs.svelte      # Mode switching UI
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

### TensorFlow.js CDN Integration

**Critical**: TensorFlow.js is loaded via CDN, NOT npm imports. This pattern is used throughout:

```typescript
// Global declarations for CDN-loaded libraries
declare const tf: any;
declare const cocoSsd: any;
declare const mobilenet: any;

// Model initialization pattern
await tf.setBackend('webgl');
await tf.ready();
this.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
```

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

- Explicit `any` allowed ONLY for TensorFlow.js globals (`tf`, `cocoSsd`, `mobilenet`)
- All public functions need explicit return types
- Type assertions should include explanatory comments
- ESLint allows `any` as warnings (see `eslint.config.js:44`)

### 4. Graceful Degradation

All failures must be user-friendly:

- Model loading errors → clear error states
- Camera permission denials → actionable guidance
- Detection failures → UI remains functional
- Check WebGL availability before ML operations

## ESLint Configuration

- Custom flat config for Astro + TypeScript
- `MediaViewer.astro` temporarily ignored (see `eslint.config.js:18`)
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

1. **Don't import TensorFlow.js** - It's CDN-loaded, use `declare const` instead
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
