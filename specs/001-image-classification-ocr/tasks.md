# Tasks: Image Classification and OCR Support

**Input**: Design documents from `/specs/001-image-classification-ocr/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested in feature specification - manual browser testing will be used

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web application**: Single Astro project with `src/` at repository root
- All TypeScript files in `src/lib/` or `src/components/`
- Test files in `tests/unit/` and `tests/integration/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create type definitions for the feature

- [ ] T001 Install @tensorflow-models/mobilenet package via `bun add @tensorflow-models/mobilenet`
- [ ] T002 Install tesseract.js package via `bun add tesseract.js`
- [ ] T003 [P] Create TypeScript type definitions in src/lib/types/analysis.ts based on contracts/analysis-api.ts
- [ ] T004 [P] Add test image assets to public/test-images/ (beach-sunset.jpg, document-receipt.jpg)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core state management and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create Svelte writable store for analysis state in src/lib/stores/analysisState.ts following Svelte store patterns (writable, derived). Export typed store with initial state and action functions (setActiveMode, setProcessingStatus, setResults, clearResults, setMediaElement, startVideoStream, stopVideoStream). Reference existing Svelte components for store subscription patterns.
- [ ] T006 [P] Create custom error classes in src/lib/errors/analysisErrors.ts (AnalysisError, ModelLoadError, InferenceError, WorkerError)
- [ ] T007 [P] Create utility functions in src/lib/utils/bboxUtils.ts for bounding box normalization/denormalization

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Image Classification (Priority: P1) 🎯 MVP

**Goal**: Enable users to upload images and get top-5 classification predictions with confidence scores

**Independent Test**: Upload test-images/beach-sunset.jpg, click "Classify", verify top-5 labels display (expected: beach, sunset, ocean, sand, sky) with confidence percentages sorted descending

### Implementation for User Story 1

- [ ] T008 [P] [US1] Implement ImageClassification service class in src/lib/imageClassification.ts with initialize(), classify(), getStatus(), isReady(), and dispose() methods using @tensorflow-models/mobilenet
- [ ] T009 [P] [US1] Create ClassificationResults component in src/components/ClassificationResults.svelte to display top-5 predictions with labels and confidence percentages
- [ ] T010 [US1] Integrate classification into MediaViewer by modifying src/components/MediaViewer.svelte to add "Classify" button that calls imageClassification.classify() and updates analysisState
  - ⚠️ **File conflict note**: T019 and T030 also modify this file. Complete T010 first, then T019, then T030 to avoid merge conflicts.
- [ ] T011 [US1] Add loading state UI in ClassificationResults.svelte showing spinner when processing.classification.status === 'loading' or 'processing'
- [ ] T012 [US1] Add error handling in ClassificationResults.svelte to display user-friendly error messages when processing.classification.status === 'error'
- [ ] T013 [US1] Implement result clearing in imageClassification.ts when new image loaded (FR-010 compliance)
- [ ] T014 [US1] Add real-time classification for video streams in src/lib/imageClassification.ts with FPS throttling (5-10 FPS using setInterval)
- [ ] T015 [US1] Add performance measurement using Performance Marks API in imageClassification.ts to track inference time and display in dev mode
- [ ] T016 [US1] Implement dispose() method in ImageClassification class to clean up MobileNetV2 model memory (call model.dispose())

**Checkpoint**: At this point, image classification should be fully functional - users can classify static images and video streams with top-5 results

---

## Phase 4: User Story 2 - Optical Character Recognition (Priority: P2)

**Goal**: Enable users to extract text from images containing documents, signs, or labels with copyable results

**Independent Test**: Upload test-images/document-receipt.jpg, click "Extract Text", verify recognized text displays in logical reading order with copy button functional

### Implementation for User Story 2

- [ ] T017 [P] [US2] Implement OCRExtraction service class in src/lib/ocrExtraction.ts with initialize(), extractText(), getStatus(), isReady(), loadLanguage(), and dispose() methods using tesseract.js
- [ ] T018 [P] [US2] Create OCRResults component in src/components/OCRResults.svelte to display extracted text with selectable/copyable text area and copy-to-clipboard button
- [ ] T019 [US2] Integrate OCR into MediaViewer by modifying src/components/MediaViewer.svelte to add "Extract Text" button that calls ocrExtraction.extractText() and updates analysisState
  - ⚠️ **Depends on**: T010 (MediaViewer classification integration must be committed first)
- [ ] T020 [US2] Implement text region sorting by reading order in ocrExtraction.ts (top-to-bottom via bbox.y, then left-to-right via bbox.x per FR-011)
- [ ] T021 [US2] Add loading state UI in OCRResults.svelte showing progress indicator during Tesseract worker initialization and text recognition
- [ ] T022 [US2] Add error handling in OCRResults.svelte for "No text found" case and worker initialization failures with user-friendly messages
- [ ] T023 [US2] Implement copy-to-clipboard functionality in OCRResults.svelte using navigator.clipboard.writeText() with success feedback (FR-012 compliance)
- [ ] T024 [US2] Create dedicated OCR canvas overlay in src/components/OCROverlay.svelte with green bounding boxes (#10B981) and hover tooltip showing extracted text. Reuse bboxUtils.ts for coordinate normalization but keep tooltip logic separate from ObjectDetectionOverlay to avoid coupling detection and OCR behaviors.
- [ ] T025 [US2] Add real-time OCR for video streams in src/lib/ocrExtraction.ts with FPS throttling (5-10 FPS) and bounding box rendering on canvas
- [ ] T026 [US2] Implement OCR result clearing when new image loaded or mode changed (FR-010 compliance)
- [ ] T027 [US2] Add language pack loading UI in OCRResults.svelte with dropdown selector for common languages (English default, Spanish, French optional)
- [ ] T028 [US2] Implement dispose() method in OCRExtraction class to terminate Tesseract worker (await worker.terminate())

**Checkpoint**: At this point, OCR should be fully functional - users can extract text from images, copy results, and see bounding boxes on video

---

## Phase 5: User Story 3 - Combined Detection Mode (Priority: P3)

**Goal**: Enable users to switch between object detection, classification, and OCR modes with a unified tabbed interface

**Independent Test**: Load an image with mixed content (objects + text), run classification and OCR, verify both result sets accessible via tabs without conflict

### Implementation for User Story 3

- [ ] T029 [P] [US3] Create AnalysisModeTabs component in src/components/AnalysisModeTabs.svelte with three tabs (Detection, Classification, OCR) using Tailwind CSS tab styling with active/inactive states
- [ ] T030 [US3] Integrate AnalysisModeTabs into MediaViewer by modifying src/components/MediaViewer.svelte to display tabs below media element and show/hide result components based on activeMode from analysisState
  - ⚠️ **Depends on**: T010, T019 (all button integrations must be complete before tabs integration)
- [ ] T031 [US3] Implement tab switching logic in AnalysisModeTabs.svelte using click handlers that call setActiveMode() from analysisState and update aria-selected attributes for accessibility
- [ ] T032 [US3] Add keyboard navigation to AnalysisModeTabs.svelte (Arrow keys to switch tabs, Tab key to focus content) following ARIA tabs pattern
- [ ] T033 [US3] Modify MediaViewer.svelte to conditionally render ClassificationResults, OCRResults, or ObjectDetectionOverlay based on analysisState.activeMode
- [ ] T034 [US3] Implement result persistence when switching tabs (do not clear results on tab switch, only on new image load per FR-010)
- [ ] T035 [US3] Add visual indicators in AnalysisModeTabs.svelte showing which analyses have completed results (e.g., badge count or checkmark on tab)
- [ ] T036 [US3] Test multiple analyses running concurrently on same image (classification + OCR) and verify results display correctly in separate tabs
- [ ] T037 [US3] Ensure all three analysis modes (detection, classification, OCR) have consistent loading/error state UI across their respective result components

**Checkpoint**: All user stories should now be independently functional - users can seamlessly switch between three analysis modes

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Performance optimization, memory management, and final integration testing

- [ ] T038 [P] Add performance monitoring dashboard in dev mode showing inference times with color-coded indicators (green <60ms, yellow 60-100ms, red >100ms) per research.md
- [ ] T039 [P] Implement memory growth warnings using performance.memory API that log console warnings if growth exceeds 5MB/minute
- [ ] T040 Add manual memory cleanup testing by creating test page at src/pages/memory-test.astro that cycles through all modes for 10 minutes while tracking heap usage
- [ ] T041 Optimize canvas rendering in OCROverlay.svelte to use requestAnimationFrame for smooth video overlay updates
- [ ] T042 [P] Add WebGL backend verification check in imageClassification.ts that logs warning if backend is not 'webgl' (graceful degradation per Constitution Principle II)
- [ ] T043 [P] Add WebAssembly availability check in ocrExtraction.ts before initializing Tesseract worker with user-friendly error if unsupported
- [ ] T044 Implement model preloading on page load in src/pages/index.astro to reduce time-to-first-classification by eagerly loading MobileNetV2 and Tesseract worker
- [ ] T045 Add tooltip hover delay (200ms) for OCR bounding boxes to prevent tooltip flicker during mouse movement
- [ ] T046 Test all edge cases from spec.md: no recognizable content, very large images (>2000px), unsupported OCR languages, blurry images, model load failures, mixed content
- [ ] T047 Run linting via `bun run lint` and fix all errors and warnings
- [ ] T048 Run production build via `bun run build` and verify bundle size increase is ~11MB (9MB MobileNetV2 + 2MB Tesseract)
- [ ] T049 Run manual browser tests in Chrome DevTools following quickstart.md testing guide for all three user stories
- [ ] T050 Verify memory stability over 10-minute session using DevTools Memory panel (target: <50MB growth per Constitution Principle I)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3, 4, 5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independently testable, reuses ObjectDetectionOverlay from existing codebase
- **User Story 3 (P3)**: Depends on User Story 1 and 2 being complete (integrates both result components into tabbed interface)

### Within Each User Story

**User Story 1 (Classification)**:

1. T008 ImageClassification service (foundational for story)
2. T009 ClassificationResults component (parallel with T008)
3. T010 MediaViewer integration (depends on T008, T009)
4. T011-T016 can proceed in any order after T010

**User Story 2 (OCR)**:

1. T017 OCRExtraction service (foundational for story)
2. T018 OCRResults component (parallel with T017)
3. T019 MediaViewer integration (depends on T017, T018)
4. T020-T028 can proceed in any order after T019

**User Story 3 (Combined Mode)**:

1. T029 AnalysisModeTabs component (foundational for story)
2. T030-T037 depend on T029 and completion of US1 + US2

### Parallel Opportunities

- **Setup (Phase 1)**: T003 and T004 can run in parallel
- **Foundational (Phase 2)**: T006 and T007 can run in parallel (T005 must complete first)
- **User Story 1**: T008 and T009 can run in parallel
- **User Story 2**: T017 and T018 can run in parallel
- **User Story 1 & 2**: Can be developed in parallel by different developers after Phase 2
- **Polish (Phase 6)**: T038, T039, T042, T043 can all run in parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, launch core US1 tasks in parallel:
Task: "Implement ImageClassification service in src/lib/imageClassification.ts"
Task: "Create ClassificationResults component in src/components/ClassificationResults.astro"

# After T008 and T009 complete:
Task: "Integrate classification into MediaViewer (T010)"

# After T010 completes, these can run in parallel:
Task: "Add loading state UI (T011)"
Task: "Add error handling (T012)"
Task: "Add performance measurement (T015)"
```

---

## Parallel Example: User Story 2

```bash
# Launch core US2 tasks in parallel:
Task: "Implement OCRExtraction service in src/lib/ocrExtraction.ts"
Task: "Create OCRResults component in src/components/OCRResults.astro"

# After services complete, these can run in parallel:
Task: "Implement text region sorting (T020)"
Task: "Implement canvas overlay for bounding boxes (T024)"
Task: "Add language pack loading UI (T027)"
```

---

## Parallel Example: Multiple User Stories

```bash
# If you have 2 developers, after Phase 2:
Developer A: Work on User Story 1 (T008-T016)
Developer B: Work on User Story 2 (T017-T028)

# After both complete:
Either developer: Work on User Story 3 (T029-T037)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T007) - CRITICAL
3. Complete Phase 3: User Story 1 (T008-T016)
4. **STOP and VALIDATE**: Test classification on beach-sunset.jpg and verify top-5 results
5. Deploy/demo if ready (basic image classification works)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: Image classification!)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP + OCR: Text extraction!)
4. Add User Story 3 → Test independently → Deploy/Demo (Full feature: Tabbed interface!)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T007)
2. Once Foundational is done:
   - Developer A: User Story 1 (T008-T016)
   - Developer B: User Story 2 (T017-T028)
3. After both complete:
   - Either developer: User Story 3 (T029-T037)
4. Team collaborates on Polish (T038-T050)

---

## Task Summary

**Total Tasks**: 50

**By Phase**:

- Phase 1 (Setup): 4 tasks
- Phase 2 (Foundational): 3 tasks
- Phase 3 (US1 - Classification): 9 tasks
- Phase 4 (US2 - OCR): 12 tasks
- Phase 5 (US3 - Combined Mode): 9 tasks
- Phase 6 (Polish): 13 tasks

**By User Story**:

- User Story 1 (Image Classification): 9 tasks
- User Story 2 (OCR): 12 tasks
- User Story 3 (Combined Mode): 9 tasks
- Infrastructure (Setup + Foundational + Polish): 20 tasks

**Parallel Opportunities**: 11 tasks can run in parallel (marked with [P])

**Independent Test Criteria**:

- **US1**: Upload beach-sunset.jpg → Click "Classify" → Verify 5 labels with confidence %
- **US2**: Upload document-receipt.jpg → Click "Extract Text" → Verify text copyable
- **US3**: Load mixed content → Run classification + OCR → Verify tab switching works

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only) = 16 tasks

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- No automated tests requested - manual browser testing per quickstart.md
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution compliance verified throughout: Performance-first, graceful degradation, TypeScript strictness, component architecture, memory management
- Follow existing Astro patterns from objectDetection.ts and MediaViewer.astro
