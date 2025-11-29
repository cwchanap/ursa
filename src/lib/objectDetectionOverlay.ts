import { ObjectDetection, type DetectionResult } from './objectDetection.js';

// DOM type declarations for server-side safety
declare const document: Document;
declare const window: Window & typeof globalThis;

export interface ObjectDetectionOverlayOptions {
  minScore?: number;
  maxDetections?: number;
  showLabels?: boolean;
  showScores?: boolean;
}

export interface UIElements {
  detectBtn: HTMLButtonElement | null;
  clearBtn: HTMLButtonElement | null;
  confidenceSlider: HTMLInputElement | null;
  confidenceValue: HTMLSpanElement | null;
  maxDetectionsSlider: HTMLInputElement | null;
  maxDetectionsValue: HTMLSpanElement | null;
  showLabelsCheckbox: HTMLInputElement | null;
  showScoresCheckbox: HTMLInputElement | null;
  statsContainer: HTMLElement | null;
  objectsCount: HTMLSpanElement | null;
  inferenceTime: HTMLSpanElement | null;
  modelStatus: HTMLSpanElement | null;
  objectsList: HTMLElement | null;
  loadingContainer: HTMLElement | null;
  loadingText: HTMLSpanElement | null;
  errorContainer: HTMLElement | null;
  errorMessage: HTMLParagraphElement | null;
}

export class ObjectDetectionOverlay {
  private detector: ObjectDetection;
  private isInitialized = false;
  private currentMediaElement: HTMLImageElement | HTMLVideoElement | null = null;
  private currentContainer: HTMLElement | null = null;
  
  // UI Elements
  private detectBtn: HTMLButtonElement | null = null;
  private clearBtn: HTMLButtonElement | null = null;
  private confidenceSlider: HTMLInputElement | null = null;
  private confidenceValue: HTMLSpanElement | null = null;
  private maxDetectionsSlider: HTMLInputElement | null = null;
  private maxDetectionsValue: HTMLSpanElement | null = null;
  private showLabelsCheckbox: HTMLInputElement | null = null;
  private showScoresCheckbox: HTMLInputElement | null = null;
  private statsContainer: HTMLElement | null = null;
  private objectsCount: HTMLSpanElement | null = null;
  private inferenceTime: HTMLSpanElement | null = null;
  private modelStatus: HTMLSpanElement | null = null;
  private objectsList: HTMLElement | null = null;
  private loadingContainer: HTMLElement | null = null;
  private loadingText: HTMLSpanElement | null = null;
  private errorContainer: HTMLElement | null = null;
  private errorMessage: HTMLParagraphElement | null = null;

  constructor() {
    this.detector = new ObjectDetection();
    
    // Only initialize DOM elements and events in browser environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      this.initializeElements();
      this.bindEvents();
      this.initializeDetector();
    }
  }

  private initializeElements(): void {
    // Early return if not in browser environment
    if (typeof document === 'undefined') return;
    // Control elements
    this.detectBtn = document.getElementById('detect-btn') as HTMLButtonElement;
    this.clearBtn = document.getElementById('clear-detections-btn') as HTMLButtonElement;
    this.confidenceSlider = document.getElementById('confidence-slider') as HTMLInputElement;
    this.confidenceValue = document.getElementById('confidence-value') as HTMLSpanElement;
    this.maxDetectionsSlider = document.getElementById('max-detections-slider') as HTMLInputElement;
    this.maxDetectionsValue = document.getElementById('max-detections-value') as HTMLSpanElement;
    this.showLabelsCheckbox = document.getElementById('show-labels') as HTMLInputElement;
    this.showScoresCheckbox = document.getElementById('show-scores') as HTMLInputElement;

    // Stats elements
    this.statsContainer = document.getElementById('detection-stats') as HTMLElement;
    this.objectsCount = document.getElementById('objects-count') as HTMLSpanElement;
    this.inferenceTime = document.getElementById('inference-time') as HTMLSpanElement;
    this.modelStatus = document.getElementById('model-status') as HTMLSpanElement;
    this.objectsList = document.getElementById('objects-list') as HTMLElement;

    // Status elements
    this.loadingContainer = document.getElementById('detection-loading') as HTMLElement;
    this.loadingText = document.getElementById('loading-text') as HTMLSpanElement;
    this.errorContainer = document.getElementById('detection-error') as HTMLElement;
    this.errorMessage = document.getElementById('error-message') as HTMLParagraphElement;
  }

  private bindEvents(): void {
    // Early return if not in browser environment
    if (typeof document === 'undefined') return;
    // Detection controls
    this.detectBtn?.addEventListener('click', () => this.handleDetection());
    this.clearBtn?.addEventListener('click', () => this.clearDetections());

    // Slider updates
    this.confidenceSlider?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (this.confidenceValue) this.confidenceValue.textContent = value;
      this.updateDetectorOptions();
    });

    this.maxDetectionsSlider?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (this.maxDetectionsValue) this.maxDetectionsValue.textContent = value;
      this.updateDetectorOptions();
    });

    // Checkbox updates
    this.showLabelsCheckbox?.addEventListener('change', () => this.updateDetectorOptions());
    this.showScoresCheckbox?.addEventListener('change', () => this.updateDetectorOptions());
  }

  private async initializeDetector(): Promise<void> {
    try {
      this.showLoading('Loading object detection model...');
      await this.detector.initialize();
      this.isInitialized = true;
      if (this.modelStatus) {
        this.modelStatus.textContent = 'Ready';
        this.modelStatus.className = 'font-medium text-green-600';
      }
      this.hideLoading();
    } catch (error) {
      this.showError(`Failed to initialize object detection: ${error}`);
      if (this.modelStatus) {
        this.modelStatus.textContent = 'Error';
        this.modelStatus.className = 'font-medium text-red-600';
      }
    }
  }

  private updateDetectorOptions(): void {
    if (!this.detector) return;

    this.detector.updateOptions({
      minScore: parseInt(this.confidenceSlider?.value || '50') / 100,
      maxDetections: parseInt(this.maxDetectionsSlider?.value || '20'),
      showLabels: this.showLabelsCheckbox?.checked ?? true,
      showScores: this.showScoresCheckbox?.checked ?? true,
    });
  }

  public setMediaElement(
    mediaElement: HTMLImageElement | HTMLVideoElement,
    container: HTMLElement
  ): void {
    this.currentMediaElement = mediaElement;
    this.currentContainer = container;
  }

  private async handleDetection(): Promise<void> {
    if (!this.isInitialized || !this.currentMediaElement || !this.currentContainer) {
      this.showError('Detection not ready or no media element set');
      return;
    }

    try {
      this.showLoading('Detecting objects...');
      this.hideError();

      const result = await this.detector.processImage(
        this.currentMediaElement as HTMLImageElement,
        this.currentContainer
      );

      this.displayResults(result);
      this.hideLoading();
    } catch (error) {
      this.showError(`Detection failed: ${error}`);
      this.hideLoading();
    }
  }

  private displayResults(result: DetectionResult): void {
    // Early return if not in browser environment
    if (typeof document === 'undefined') return;
    // Update stats
    if (this.objectsCount) this.objectsCount.textContent = result.objects.length.toString();
    if (this.inferenceTime) this.inferenceTime.textContent = `${Math.round(result.inferenceTime)}ms`;
    this.statsContainer?.classList.remove('hidden');

    // Update objects list
    if (this.objectsList) {
      this.objectsList.innerHTML = '';
      
      if (result.objects.length === 0) {
        this.objectsList.innerHTML = '<p class="text-sm text-gray-500">No objects detected</p>';
      } else {
        result.objects.forEach((obj) => {
          const objectDiv = document.createElement('div');
          objectDiv.className = 'text-xs bg-gray-100 rounded px-2 py-1';
          objectDiv.innerHTML = `
            <span class="font-medium">${obj.class}</span>
            <span class="text-gray-600">(${(obj.score * 100).toFixed(1)}%)</span>
          `;
          this.objectsList!.appendChild(objectDiv);
        });
      }
    }
  }

  private clearDetections(): void {
    if (this.currentContainer) {
      const overlay = this.currentContainer.querySelector('.detection-overlay');
      if (overlay) {
        overlay.remove();
      }
    }
    
    this.statsContainer?.classList.add('hidden');
    this.hideError();
  }

  private showLoading(message: string): void {
    if (this.loadingText) this.loadingText.textContent = message;
    this.loadingContainer?.classList.remove('hidden');
    if (this.detectBtn) {
      this.detectBtn.disabled = true;
    }
  }

  private hideLoading(): void {
    this.loadingContainer?.classList.add('hidden');
    if (this.detectBtn) {
      this.detectBtn.disabled = false;
    }
  }

  private showError(message: string): void {
    if (this.errorMessage) this.errorMessage.textContent = message;
    this.errorContainer?.classList.remove('hidden');
  }

  private hideError(): void {
    this.errorContainer?.classList.add('hidden');
  }

  public getDetector(): ObjectDetection {
    return this.detector;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public dispose(): void {
    this.detector.dispose();
  }
}

// Global initialization function for browser environment
export function initializeObjectDetectionOverlay(): ObjectDetectionOverlay | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const overlay = new ObjectDetectionOverlay();
  
  // Add to window object for global access
  Object.assign(window, {
    ObjectDetectionOverlay: ObjectDetectionOverlay,
    detectionOverlay: overlay
  });

  return overlay;
}