<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { DetectionResult } from '../lib/objectDetection.js';

  // Props
  export let showControls: boolean = true;
  export let showStats: boolean = true;
  export let className: string = "";

  // State - use dynamic import to avoid SSR issues
  let ObjectDetectionClass: typeof import('../lib/objectDetection.js').ObjectDetection | null = null;
  let detector: InstanceType<typeof import('../lib/objectDetection.js').ObjectDetection> | null = null;
  let isInitialized = false;
  let currentMediaElement: HTMLImageElement | HTMLVideoElement | null = null;
  let currentContainer: HTMLElement | null = null;

  // UI State
  let confidenceValue = 50;
  let maxDetectionsValue = 20;
  let showLabels = true;
  let showScores = true;
  let isMenuOpen = false;

  // Stats State
  let objectsCount: string = '-';
  let inferenceTime: string = '-';
  let modelStatus: string = 'Not loaded';
  let modelStatusClass: string = 'font-medium text-gray-500';
  let detectedObjects: Array<{ class: string; score: number }> = [];
  let showStatsContainer = false;

  // Loading/Error State
  let isLoading = false;
  let loadingText = 'Loading model...';
  let hasError = false;
  let errorMessage = 'An error occurred during object detection.';
  let isDetecting = false;

  onMount(async () => {
    // Expose to window for MediaViewer integration immediately
    if (typeof window !== 'undefined') {
      Object.assign(window, {
        detectionOverlay: {
          setMediaElement,
          getDetector: () => detector,
          isReady: () => isInitialized,
          dispose: () => detector?.dispose()
        }
      });
    }

    // Dynamically import ObjectDetection to avoid SSR issues with TensorFlow.js
    try {
      const module = await import('../lib/objectDetection.js');
      ObjectDetectionClass = module.ObjectDetection;
      detector = new ObjectDetectionClass();
      
      showLoading('Loading object detection model...');
      await detector.initialize();
      isInitialized = true;
      modelStatus = 'Ready';
      modelStatusClass = 'font-medium text-green-600';
      hideLoading();
    } catch (error) {
      console.error('Failed to initialize object detection:', error);
      showError(`Failed to initialize object detection: ${error}`);
      modelStatus = 'Error';
      modelStatusClass = 'font-medium text-red-600';
      hideLoading();
    }
  });

  onDestroy(() => {
    detector?.dispose();
  });

  function updateDetectorOptions() {
    if (!detector) return;

    detector.updateOptions({
      minScore: confidenceValue / 100,
      maxDetections: maxDetectionsValue,
      showLabels,
      showScores,
    });
  }

  export function setMediaElement(
    mediaElement: HTMLImageElement | HTMLVideoElement,
    container: HTMLElement
  ): void {
    currentMediaElement = mediaElement;
    currentContainer = container;
  }

  async function handleDetection(): Promise<void> {
    if (!isInitialized || !currentMediaElement || !currentContainer) {
      showError('Detection not ready or no media element set');
      return;
    }

    try {
      showLoading('Detecting objects...');
      hideError();

      const result = await detector!.processImage(
        currentMediaElement as HTMLImageElement,
        currentContainer
      );

      displayResults(result);
      hideLoading();
    } catch (error) {
      showError(`Detection failed: ${error}`);
      hideLoading();
    }
  }

  function displayResults(result: DetectionResult): void {
    objectsCount = result.objects.length.toString();
    inferenceTime = `${Math.round(result.inferenceTime)}ms`;
    showStatsContainer = true;
    detectedObjects = result.objects;
  }

  function clearDetections(): void {
    if (currentContainer) {
      const overlay = currentContainer.querySelector('.detection-overlay');
      if (overlay) {
        overlay.remove();
      }
    }
    
    showStatsContainer = false;
    hideError();
  }

  function showLoading(message: string): void {
    loadingText = message;
    isLoading = true;
    isDetecting = true;
  }

  function hideLoading(): void {
    isLoading = false;
    isDetecting = false;
  }

  function showError(message: string): void {
    errorMessage = message;
    hasError = true;
  }

  function hideError(): void {
    hasError = false;
  }

  function toggleMenu(): void {
    isMenuOpen = !isMenuOpen;
  }

  function closeMenu(): void {
    isMenuOpen = false;
  }

  // Reactive updates for detector options
  $: if (detector) {
    updateDetectorOptions();
  }
</script>

<div class="object-detection-overlay {className}">
  {#if showControls}
    <!-- Hamburger Menu Button -->
    <button
      onclick={toggleMenu}
      class="menu-toggle"
      aria-label="Toggle detection settings"
    >
      <div class="menu-icon {isMenuOpen ? 'open' : ''}">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span class="menu-label">Settings</span>
    </button>

    <!-- Backdrop -->
    {#if isMenuOpen}
      <button
        class="menu-backdrop"
        onclick={closeMenu}
        aria-label="Close menu"
      ></button>
    {/if}

    <!-- Slide-out Menu Panel -->
    <div id="detection-controls" class="detection-controls {isMenuOpen ? 'open' : ''}">
      <div class="controls-header">
        <div class="header-glow"></div>
        <div class="header-content">
          <div class="header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke-width="2"/>
              <path d="M2 17l10 5 10-5" stroke-width="2"/>
              <path d="M2 12l10 5 10-5" stroke-width="2"/>
            </svg>
          </div>
          <h3 class="header-title">Detection Settings</h3>
          <button onclick={closeMenu} class="close-btn" aria-label="Close settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="model-status {modelStatus === 'Ready' ? 'ready' : modelStatus === 'Error' ? 'error' : 'loading'}">
          <span class="status-dot"></span>
          <span class="status-text">{modelStatus}</span>
        </div>
      </div>

      <div class="controls-body">
        <div class="control-actions">
          <button
            onclick={handleDetection}
            disabled={isDetecting}
            class="detect-btn"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="8" stroke-width="2"/>
              <path d="m21 21-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
              <circle cx="11" cy="11" r="3" stroke-width="2"/>
            </svg>
            <span>Analyze Frame</span>
          </button>
          <button
            onclick={clearDetections}
            class="clear-btn"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2"/>
              <path d="M15 9l-6 6M9 9l6 6" stroke-width="2"/>
            </svg>
            <span>Clear</span>
          </button>
        </div>

        <div class="control-section">
          <label class="control-label" for="confidence-slider">
            <span class="label-text">Confidence Threshold</span>
            <span class="label-value">{confidenceValue}%</span>
          </label>
          <input
            type="range"
            id="confidence-slider"
            min="10"
            max="95"
            bind:value={confidenceValue}
            class="cosmic-slider"
            aria-label="Confidence Threshold"
          >
          <div class="slider-markers">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <div class="control-section">
          <label class="control-label" for="max-detections-slider">
            <span class="label-text">Max Detections</span>
            <span class="label-value">{maxDetectionsValue}</span>
          </label>
          <input
            type="range"
            id="max-detections-slider"
            min="1"
            max="50"
            bind:value={maxDetectionsValue}
            class="cosmic-slider"
            aria-label="Max Detections"
          >
          <div class="slider-markers">
            <span>1</span>
            <span>50</span>
          </div>
        </div>

        <div class="control-toggles">
          <label class="toggle-item">
            <input type="checkbox" bind:checked={showLabels} class="cosmic-checkbox">
            <span class="toggle-label">Show Labels</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" bind:checked={showScores} class="cosmic-checkbox">
            <span class="toggle-label">Show Scores</span>
          </label>
        </div>
      </div>
    </div>
  {/if}

  {#if showStats}
    <div id="detection-stats" class="detection-stats" class:hidden={!showStatsContainer}>
      <div class="stats-header">
        <div class="stats-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke-width="2"/>
            <path d="M9 12h6m-6 4h6" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h4 class="stats-title">Detection Results</h4>
      </div>

      <div class="stats-body">
        <div class="stat-grid">
          <div class="stat-item">
            <span class="stat-label">Objects Found</span>
            <span class="stat-value">{objectsCount}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Inference Time</span>
            <span class="stat-value">{inferenceTime}</span>
          </div>
        </div>

        <div class="detected-objects-section">
          <h5 class="section-title">Detected Objects</h5>
          <div class="objects-list">
            {#if detectedObjects.length === 0}
              <p class="empty-state">No objects detected</p>
            {:else}
              {#each detectedObjects as obj}
                <div class="object-tag">
                  <span class="object-name">{obj.class}</span>
                  <span class="object-score">{(obj.score * 100).toFixed(1)}%</span>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Loading Indicator -->
  <div id="detection-loading" class="detection-loading" class:hidden={!isLoading}>
    <div class="loading-content">
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>
      <span class="loading-text">{loadingText}</span>
    </div>
  </div>

  <!-- Error Display -->
  <div id="detection-error" class="detection-error" class:hidden={!hasError}>
    <div class="error-content">
      <div class="error-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
          <path d="M12 8v4M12 16h.01" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="error-message">
        <h4 class="error-title">Detection Error</h4>
        <p class="error-description">{errorMessage}</p>
      </div>
    </div>
  </div>
</div>

<style>
.object-detection-overlay {
  position: relative;
}

/* Hamburger Menu Button */
.menu-toggle {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 3rem;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: fadeIn 0.6s ease-out 0.8s backwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.menu-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(139, 92, 246, 0.5);
  box-shadow: 0 4px 30px rgba(139, 92, 246, 0.4);
  transform: translateY(-2px);
}

.menu-icon {
  width: 24px;
  height: 18px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.menu-icon span {
  width: 100%;
  height: 2px;
  background: linear-gradient(135deg, var(--cosmic-cyan), var(--cosmic-purple));
  border-radius: 2px;
  transition: all 0.3s ease;
  transform-origin: center;
}

.menu-icon.open span:nth-child(1) {
  transform: translateY(8px) rotate(45deg);
}

.menu-icon.open span:nth-child(2) {
  opacity: 0;
  transform: scaleX(0);
}

.menu-icon.open span:nth-child(3) {
  transform: translateY(-8px) rotate(-45deg);
}

.menu-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Menu Backdrop */
.menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 998;
  cursor: pointer;
  border: none;
  animation: fadeInBackdrop 0.3s ease-out;
}

@keyframes fadeInBackdrop {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Detection Controls - Slide-out Panel */
.detection-controls {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 420px;
  max-width: 90vw;
  background: rgba(10, 14, 39, 0.98);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(139, 92, 246, 0.3);
  overflow-y: auto;
  box-shadow: -20px 0 60px rgba(0, 0, 0, 0.7);
  z-index: 999;
  transform: translateX(100%);
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.detection-controls.open {
  transform: translateX(0);
}

/* Custom scrollbar for panel */
.detection-controls::-webkit-scrollbar {
  width: 8px;
}

.detection-controls::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.detection-controls::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.3);
  border-radius: 4px;
}

.detection-controls::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.5);
}

.controls-header {
  position: sticky;
  top: 0;
  padding: 1.5rem 2rem;
  background: rgba(10, 14, 39, 0.98);
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  z-index: 10;
}

.header-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.1), transparent);
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.header-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.close-btn {
  margin-left: auto;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(139, 92, 246, 0.4);
  color: white;
  transform: rotate(90deg);
}

.close-btn svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.header-icon {
  width: 32px;
  height: 32px;
  color: var(--cosmic-cyan);
}

.header-icon svg {
  width: 100%;
  height: 100%;
  stroke-width: 2;
}

.header-title {
  flex: 1;
  font-family: 'Orbitron', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, white, var(--cosmic-cyan));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.model-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
}

.model-status.ready .status-dot {
  background: var(--cosmic-cyan);
  box-shadow: 0 0 10px var(--cosmic-cyan);
  animation: pulse-dot 2s ease-in-out infinite;
}

.model-status.error .status-dot {
  background: #ef4444;
  box-shadow: 0 0 10px #ef4444;
}

.model-status.loading .status-dot {
  background: var(--cosmic-gold);
  animation: pulse-dot 1s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.2); }
}

.status-text {
  color: rgba(255, 255, 255, 0.7);
}

.model-status.ready .status-text {
  color: var(--cosmic-cyan);
}

.model-status.error .status-text {
  color: #fca5a5;
}

.controls-body {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Control Actions */
.control-actions {
  display: flex;
  gap: 1rem;
}

.detect-btn,
.clear-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.875rem 1.5rem;
  border: 1px solid;
  border-radius: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.detect-btn::before,
.clear-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, transparent, rgba(255, 255, 255, 0.1));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.detect-btn:hover::before,
.clear-btn:hover::before {
  opacity: 1;
}

.detect-btn {
  background: linear-gradient(135deg, var(--cosmic-purple), var(--cosmic-pink));
  border-color: var(--cosmic-pink);
  color: white;
}

.detect-btn:hover:not(:disabled) {
  box-shadow: 0 8px 30px rgba(236, 72, 153, 0.4);
  transform: translateY(-2px);
}

.detect-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.clear-btn {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.btn-icon {
  width: 18px;
  height: 18px;
  stroke-width: 2;
  position: relative;
  z-index: 1;
}

/* Control Sections */
.control-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.control-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.label-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--cosmic-cyan), var(--cosmic-purple));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Cosmic Slider */
.cosmic-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  position: relative;
}

.cosmic-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--cosmic-cyan), var(--cosmic-purple));
  cursor: pointer;
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.6), 0 0 20px rgba(139, 92, 246, 0.3);
  transition: all 0.2s ease;
}

.cosmic-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 15px rgba(139, 92, 246, 0.8), 0 0 30px rgba(139, 92, 246, 0.5);
}

.cosmic-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--cosmic-cyan), var(--cosmic-purple));
  cursor: pointer;
  border: none;
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.6), 0 0 20px rgba(139, 92, 246, 0.3);
  transition: all 0.2s ease;
}

.cosmic-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 15px rgba(139, 92, 246, 0.8), 0 0 30px rgba(139, 92, 246, 0.5);
}

.slider-markers {
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.25rem;
}

/* Control Toggles */
.control-toggles {
  display: flex;
  gap: 2rem;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.cosmic-checkbox {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(139, 92, 246, 0.4);
  border-radius: 0.375rem;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.cosmic-checkbox:checked {
  background: linear-gradient(135deg, var(--cosmic-cyan), var(--cosmic-purple));
  border-color: var(--cosmic-purple);
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
}

.cosmic-checkbox:checked::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 6px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.cosmic-checkbox:hover {
  border-color: var(--cosmic-purple);
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
}

.toggle-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.05em;
}

/* Detection Stats */
.detection-stats {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 900;
  max-width: 400px;
  background: rgba(10, 14, 39, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  animation: slideUpStats 0.6s ease-out 1s backwards;
}

@keyframes slideUpStats {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.stats-header {
  position: relative;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(139, 92, 246, 0.1));
  border-bottom: 1px solid rgba(6, 182, 212, 0.2);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stats-icon {
  width: 24px;
  height: 24px;
  color: var(--cosmic-cyan);
}

.stats-icon svg {
  width: 100%;
  height: 100%;
  stroke-width: 2;
}

.stats-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, white, var(--cosmic-cyan));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stats-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

.stat-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(6, 182, 212, 0.4);
}

.stat-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.stat-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--cosmic-cyan), var(--cosmic-purple));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.detected-objects-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.objects-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-height: 150px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

/* Custom scrollbar */
.objects-list::-webkit-scrollbar {
  width: 6px;
}

.objects-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.objects-list::-webkit-scrollbar-thumb {
  background: rgba(6, 182, 212, 0.3);
  border-radius: 3px;
}

.objects-list::-webkit-scrollbar-thumb:hover {
  background: rgba(6, 182, 212, 0.5);
}

.empty-state {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}

.object-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(6, 182, 212, 0.15);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  transition: all 0.2s ease;
}

.object-tag:hover {
  background: rgba(6, 182, 212, 0.25);
  border-color: rgba(6, 182, 212, 0.5);
  transform: translateY(-2px);
}

.object-name {
  color: white;
  font-weight: 600;
  text-transform: capitalize;
}

.object-score {
  color: var(--cosmic-cyan);
  font-weight: 500;
}

/* Loading Indicator */
.detection-loading {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 900;
  background: rgba(10, 14, 39, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 1rem;
  padding: 1rem 1.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.loading-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.loading-spinner {
  position: relative;
  width: 32px;
  height: 32px;
}

.spinner-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 3px solid transparent;
  border-top-color: var(--cosmic-gold);
  border-radius: 50%;
  animation: spin 1.5s linear infinite;
}

.spinner-ring:nth-child(2) {
  border-top-color: var(--cosmic-cyan);
  animation-delay: 0.15s;
}

.spinner-ring:nth-child(3) {
  border-top-color: var(--cosmic-purple);
  animation-delay: 0.3s;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: 0.05em;
}

/* Error Display */
.detection-error {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 900;
  max-width: 500px;
  background: rgba(239, 68, 68, 0.15);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 1rem;
  padding: 1rem 1.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.error-content {
  display: flex;
  gap: 1rem;
}

.error-icon {
  width: 24px;
  height: 24px;
  color: #fca5a5;
  flex-shrink: 0;
}

.error-icon svg {
  width: 100%;
  height: 100%;
  stroke-width: 2;
}

.error-message {
  flex: 1;
}

.error-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: #fca5a5;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.error-description {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: rgba(252, 165, 165, 0.8);
  line-height: 1.5;
}

/* Utilities */
.hidden {
  display: none;
}

/* Responsive Design */
@media (max-width: 768px) {
  .menu-toggle {
    padding: 0.75rem 1.25rem;
    gap: 0.5rem;
  }

  .menu-label {
    font-size: 0.75rem;
  }

  .detection-controls {
    width: 100%;
    max-width: 100vw;
  }

  .control-actions {
    flex-direction: column;
  }

  .stat-grid {
    grid-template-columns: 1fr;
  }

  .control-toggles {
    flex-direction: column;
    gap: 1rem;
  }

  .objects-list {
    max-height: 120px;
  }

  .detection-stats {
    bottom: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }

  .detection-loading,
  .detection-error {
    bottom: 10px;
    left: 10px;
    right: 10px;
    transform: none;
    max-width: none;
  }
}
</style>
