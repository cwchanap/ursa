<!--
  Sync Impact Report
  ===================
  Version change: N/A → 1.0.0 (initial ratification)

  Modified principles: N/A (initial version)

  Added sections:
  - Core Principles (5 principles)
  - Performance Standards
  - Development Workflow
  - Governance

  Removed sections: N/A (initial version)

  Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (compatible - Constitution Check section exists)
  - .specify/templates/spec-template.md ✅ (compatible - Requirements section supports principles)
  - .specify/templates/tasks-template.md ✅ (compatible - Phase structure aligns with principles)

  Follow-up TODOs: None
-->

# Ursa Constitution

## Core Principles

### I. Performance-First Design

All features involving AI inference or real-time media MUST prioritize performance:

- Detection FPS MUST be capped at 5-10 for video streams to prevent frame drops
- Canvas overlays MUST be cleared and redrawn efficiently on each detection cycle
- Large images MUST be scaled down via CSS constraints (max-height: 400px or equivalent)
- Memory-intensive operations MUST include cleanup patterns (`dispose()` methods)
- WebGL backend MUST be used for TensorFlow.js operations

**Rationale**: Real-time object detection is computationally expensive; unoptimized code directly impacts user experience through dropped frames, browser freezes, or memory leaks.

### II. Graceful Degradation

The application MUST handle capability failures without breaking the UI:

- Model loading failures MUST show user-friendly error states, not technical exceptions
- Camera permission denials MUST display specific guidance for resolution
- Detection failures MUST degrade gracefully—UI remains functional
- WebGL unavailability MUST be detected and communicated before ML operations
- HTTPS warnings for camera access in production MUST be documented

**Rationale**: Browser capabilities (WebGL, camera access, ML models) are not guaranteed; users deserve clear feedback rather than broken states.

### III. TypeScript Strictness

All TypeScript code MUST maintain type safety with documented exceptions:

- Explicit `any` usage MUST be limited to CDN-loaded libraries (TensorFlow.js globals)
- All public functions MUST have explicit return types
- Component props and event handlers MUST be typed
- Type assertions SHOULD include explanatory comments when used

**Rationale**: TypeScript's value is nullified by unconstrained `any` usage; documented exceptions acknowledge pragmatic needs while preserving overall type safety.

### IV. Component Architecture

Astro components MUST follow established patterns:

- Components reside in `/src/components/` using PascalCase naming
- Reusable utilities reside in `/src/lib/` using camelCase naming
- Detection-related files MUST be prefixed with "object" or "detection"
- Global state communication uses `window` object assignment pattern
- Component scripts MUST be self-contained within `<script>` tags

**Rationale**: Consistent architecture patterns enable developers to quickly locate code and understand component boundaries.

### V. Memory Management

ML and media resources MUST implement explicit cleanup:

- `ObjectDetection` instances MUST expose `dispose()` for model cleanup
- Video streams MUST be stopped via `MediaStreamTrack.stop()` when switching contexts
- Canvas elements created dynamically MUST be removed when no longer needed
- Event listeners MUST be removed on component unmount or context switch

**Rationale**: Browser-based ML applications accumulate memory without explicit cleanup; long sessions or context switches will degrade performance.

## Performance Standards

Measurable performance targets for Ursa:

| Metric                  | Target             | Measurement                |
| ----------------------- | ------------------ | -------------------------- |
| Video detection FPS     | 5-10               | Console timing logs        |
| Model load time         | <5s on broadband   | First detection timestamp  |
| Memory growth/session   | <50MB over 10 min  | DevTools Memory panel      |
| Time to first detection | <8s from page load | User-perceived ready state |

All new features involving detection MUST include performance impact analysis.

## Development Workflow

### Quality Gates

1. **Lint**: `bun run lint` MUST pass with zero errors
2. **Build**: `bun run build` MUST complete without errors
3. **Browser Test**: Manual verification in Chrome DevTools for:
   - Memory leaks (Memory panel)
   - Console errors during detection
   - WebGL context status

### Code Review Expectations

- Performance implications MUST be documented for detection-related changes
- New `any` types MUST be justified in PR description
- Canvas/media code MUST include cleanup verification

## Governance

This constitution supersedes ad-hoc practices. All development decisions MUST align with these principles.

### Amendment Process

1. Propose change with rationale
2. Document impact on existing code
3. Update version following semantic versioning:
   - **MAJOR**: Principle removal or incompatible redefinition
   - **MINOR**: New principle or section added
   - **PATCH**: Clarifications, wording improvements
4. Update `LAST_AMENDED_DATE`

### Compliance

- PRs MUST reference relevant principles when applicable
- Architecture deviations MUST be documented with justification
- Use `.github/copilot-instructions.md` for runtime development guidance

**Version**: 1.0.0 | **Ratified**: 2025-11-28 | **Last Amended**: 2025-11-28
