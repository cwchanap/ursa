# Ursa - AI Object Detection with Astro

## Architecture Overview

Ursa is an Astro-based web application that combines AI object detection with modern frontend architecture. The app provides real-time object detection for both images and live video streams using TensorFlow.js.

### Key Components

- **`ObjectDetection` class** (`src/lib/objectDetection.ts`): Core detection engine that handles model loading, inference, and canvas overlay rendering
- **`MediaViewer` component** (`src/components/MediaViewer.astro`): Main UI orchestrating image/video modes with drag-drop and camera access
- **`ObjectDetectionOverlay` component** (`src/components/ObjectDetectionOverlay.astro`): Detection controls, settings, and results visualization

### Tech Stack Specifics

- **Astro 5.14.1** with TypeScript and Tailwind CSS 4.x
- **TensorFlow.js 4.22.0** with WebGL backend via npm packages
- **COCO-SSD model** for 80-class object detection
- **Bun** as package manager and runtime

## Critical Development Patterns

### TensorFlow.js Integration

```typescript
// Uses npm imports with dynamic loading to avoid SSR issues
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// Model initialization pattern
await tf.setBackend('webgl');
await tf.ready();
this.model = await cocoSsd.load({
  base: 'lite_mobilenet_v2', // Performance-optimized model
});
```

### Component Communication Pattern

Components communicate through global window objects and DOM events:

```typescript
// Global singleton pattern used throughout
export const objectDetector = new ObjectDetection();

// Window-based component communication
Object.assign(window, {
  detectionOverlay: new ObjectDetectionOverlay(),
});
```

### Canvas Overlay System

Detection results are rendered using dynamically created canvas overlays:

```typescript
// Canvas positioning pattern - always absolute positioned
canvas.style.position = 'absolute';
canvas.style.pointerEvents = 'none';
canvas.style.zIndex = '10';

// Scale detection coordinates to canvas dimensions
const scaleX = canvas.width / imageWidth;
const scaleY = canvas.height / imageHeight;
```

## Development Workflows

### Commands

- `bun run dev` - Development server (port 4321)
- `bun run build` - Production build
- `bun run lint` - ESLint with Astro/TypeScript support
- `bun run lint:fix` - Auto-fix linting issues

### File Structure Conventions

- `/src/lib/` - Reusable TypeScript utilities and classes
- `/src/components/` - Astro components with embedded `<script>` sections
- Components use PascalCase, utilities use camelCase
- Detection-related files prefixed with "object" or "detection"

### Browser Compatibility Requirements

- WebGL support required for TensorFlow.js
- HTTPS needed in production for camera access (`getUserMedia()`)
- Modern browser features: ES2020+, async/await, Canvas API

## Key Integration Points

### Model Loading Strategy

- TensorFlow.js loaded via CDN for better caching
- Model initialization is async and global - check `detector.getStatus()` before use
- First load downloads ~13MB COCO-SSD model

### Video Stream Handling

```typescript
// Camera access pattern
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: { ideal: 1280 }, height: { ideal: 720 } },
});
videoElement.srcObject = stream;

// Continuous detection pattern (5 FPS for performance)
const stopDetection = detector.startVideoDetection(videoElement, container, onResult, 5);
```

### Error Handling Conventions

- Model loading failures show user-friendly error states
- Camera permission errors display specific guidance
- Detection failures gracefully degrade without breaking UI

## Configuration Notes

### ESLint Setup

- Custom config for Astro + TypeScript
- `MediaViewer.astro` temporarily ignored due to complex window object usage
- Allows `@typescript-eslint/no-explicit-any` as warnings for TensorFlow.js globals

### Tailwind Configuration

- Uses Tailwind CSS 4.x with Vite plugin integration
- Fixed positioning for detection overlays (`fixed top-20 right-20`)
- Mobile-responsive breakpoints for overlay repositioning

## Performance Considerations

- Detection FPS limited to 5-10 for video streams
- Canvas overlays cleared and redrawn on each detection
- Memory management: call `detector.dispose()` when switching contexts
- Large images automatically scaled down via CSS `max-height: 400px`

## Testing & Debugging

- Use browser DevTools for TensorFlow.js performance profiling
- Console logs show model loading status and detection timing
- Detection results include inference time for performance monitoring
- Test with various image sizes and object densities for edge cases
