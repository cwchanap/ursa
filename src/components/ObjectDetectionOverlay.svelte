<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ObjectDetection, type DetectionResult } from '../lib/objectDetection.js';

  // Props
  export let showControls: boolean = true;
  export let showStats: boolean = true;
  export let className: string = "";

  // State
  let detector: ObjectDetection | null = null;
  let isInitialized = false;
  let currentMediaElement: HTMLImageElement | HTMLVideoElement | null = null;
  let currentContainer: HTMLElement | null = null;

  // UI State
  let confidenceValue = 50;
  let maxDetectionsValue = 20;
  let showLabels = true;
  let showScores = true;

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
    detector = new ObjectDetection();
    
    try {
      showLoading('Loading object detection model...');
      await detector.initialize();
      isInitialized = true;
      modelStatus = 'Ready';
      modelStatusClass = 'font-medium text-green-600';
      hideLoading();
    } catch (error) {
      showError(`Failed to initialize object detection: ${error}`);
      modelStatus = 'Error';
      modelStatusClass = 'font-medium text-red-600';
    }

    // Expose to window for MediaViewer integration
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

  // Reactive updates for detector options
  $: if (detector) {
    updateDetectorOptions();
  }
</script>

<div class="object-detection-overlay {className}">
  {#if showControls}
    <div id="detection-controls" class="detection-controls bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
      <div class="flex flex-col space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-800">Object Detection</h3>
          <div class="flex space-x-2">
            <button 
              onclick={handleDetection}
              disabled={isDetecting}
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span class="detect-btn-text">Detect Objects</span>
            </button>
            <button 
              onclick={clearDetections}
              class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
            >
              Clear
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label for="confidence-slider" class="block text-sm font-medium text-gray-700">
              Confidence Threshold: <span>{confidenceValue}</span>%
            </label>
            <input 
              type="range" 
              id="confidence-slider" 
              min="10" 
              max="95" 
              bind:value={confidenceValue}
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            >
          </div>
          
          <div class="space-y-2">
            <label for="max-detections-slider" class="block text-sm font-medium text-gray-700">
              Max Detections: <span>{maxDetectionsValue}</span>
            </label>
            <input 
              type="range" 
              id="max-detections-slider" 
              min="1" 
              max="50" 
              bind:value={maxDetectionsValue}
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            >
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <label class="flex items-center space-x-2">
            <input type="checkbox" bind:checked={showLabels} class="rounded">
            <span class="text-sm text-gray-700">Show Labels</span>
          </label>
          <label class="flex items-center space-x-2">
            <input type="checkbox" bind:checked={showScores} class="rounded">
            <span class="text-sm text-gray-700">Show Scores</span>
          </label>
        </div>
      </div>
    </div>
  {/if}

  {#if showStats}
    <div id="detection-stats" class="detection-stats bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg" class:hidden={!showStatsContainer}>
      <h4 class="text-md font-semibold text-gray-800 mb-2">Detection Results</h4>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-600">Objects Found:</span>
          <span class="font-medium">{objectsCount}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Inference Time:</span>
          <span class="font-medium">{inferenceTime}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Model Status:</span>
          <span class={modelStatusClass}>{modelStatus}</span>
        </div>
      </div>
      
      <div class="mt-3">
        <h5 class="text-sm font-medium text-gray-700 mb-1">Detected Objects:</h5>
        <div class="space-y-1 max-h-32 overflow-y-auto">
          {#if detectedObjects.length === 0}
            <p class="text-sm text-gray-500">No objects detected</p>
          {:else}
            {#each detectedObjects as obj}
              <div class="text-xs bg-gray-100 rounded px-2 py-1">
                <span class="font-medium">{obj.class}</span>
                <span class="text-gray-600">({(obj.score * 100).toFixed(1)}%)</span>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Loading Indicator -->
  <div id="detection-loading" class="detection-loading bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg" class:hidden={!isLoading}>
    <div class="flex items-center space-x-3">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      <span class="text-gray-700">
        <span>{loadingText}</span>
      </span>
    </div>
  </div>

  <!-- Error Display -->
  <div id="detection-error" class="detection-error bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg" class:hidden={!hasError}>
    <div class="flex items-start space-x-3">
      <div class="flex-shrink-0">
        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
      </div>
      <div>
        <h4 class="text-sm font-medium text-red-800">Detection Error</h4>
        <p class="text-sm text-red-600 mt-1">{errorMessage}</p>
      </div>
    </div>
  </div>
</div>

<style>
.object-detection-overlay {
  position: relative;
  z-index: 20;
}

.detection-controls,
.detection-stats,
.detection-loading,
.detection-error {
  position: fixed;
  top: 20px;
  right: 20px;
  min-width: 320px;
  max-width: 400px;
  z-index: 30;
}

.detection-stats {
  top: 180px;
}

.detection-loading {
  top: 100px;
}

.detection-error {
  top: 100px;
}

/* Custom slider styling */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
}

/* Loading animation */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .detection-controls,
  .detection-stats,
  .detection-loading,
  .detection-error {
    position: relative;
    top: auto;
    right: auto;
    margin: 10px;
    min-width: auto;
    max-width: none;
  }
}

.hidden {
  display: none;
}
</style>
