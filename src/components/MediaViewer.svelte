<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ObjectDetectionOverlay from './ObjectDetectionOverlay.svelte';
  import ClassificationResults from './ClassificationResults.svelte';
  import OCRResults from './OCRResults.svelte';
  import AnalysisModeTabs from './AnalysisModeTabs.svelte';
  import PerformanceMonitor from './PerformanceMonitor.svelte';
  import type { AnalysisMode, ProcessingState, ClassificationAnalysis, OCRAnalysis, DetectionResult } from '../lib/types/analysis';

  // Type for window.detectionOverlay
  interface DetectionOverlayGlobal {
    setMediaElement: (el: HTMLImageElement | HTMLVideoElement, container: HTMLElement) => void;
    getDetector: () => any;
    isReady: () => boolean;
    dispose: () => void;
  }

  // State
  let currentMode = $state<'video' | 'image'>('video');
  let currentStream = $state<MediaStream | null>(null);
  let stopVideoDetection = $state<(() => void) | null>(null);
  let stopVideoClassification = $state<(() => void) | null>(null);
  let stopVideoOCR = $state<(() => void) | null>(null);

  // Analysis Mode State
  let activeAnalysisMode = $state<AnalysisMode>('detection');
  let classificationProcessing = $state<ProcessingState>({ status: 'idle' });
  let ocrProcessing = $state<ProcessingState>({ status: 'idle' });
  let classificationResults = $state<ClassificationAnalysis | null>(null);
  let ocrResults = $state<OCRAnalysis | null>(null);
  let detectionResults = $state<DetectionResult | null>(null);

  // Service instances (loaded dynamically as singletons)
  let imageClassifier = $state<typeof import('../lib/imageClassification.js').imageClassifier | null>(null);
  let ocrExtractor = $state<typeof import('../lib/ocrExtraction.js').ocrExtractor | null>(null);

  // Element bindings
  let cameraVideo = $state<HTMLVideoElement>();
  let videoContainer = $state<HTMLElement>();
  let imageContainer = $state<HTMLElement>();
  let uploadedImage = $state<HTMLImageElement>();
  let imageInput = $state<HTMLInputElement>();

  // UI State
  let isCameraRunning = $state(false);
  let isDetectionRunning = $state(false);
  let isClassificationRunning = $state(false);
  let isOCRRunning = $state(false);
  let videoErrorMessage = $state('');
  let showVideoError = $state(false);
  let showImageDisplay = $state(false);
  let isDragOver = $state(false);
  let copyFeedbackMessage = $state('');
  let showCopyFeedback = $state(false);

  // Helper to get detection overlay from window
  function getDetectionOverlay(): DetectionOverlayGlobal | undefined {
    return (window as any).detectionOverlay;
  }

  // Initialize classification and OCR services
  async function initializeServices(): Promise<void> {
    try {
      // Dynamically import to avoid SSR issues - use exported singletons
      const classificationModule = await import('../lib/imageClassification.js');
      const ocrModule = await import('../lib/ocrExtraction.js');
      
      // Reuse the already-exported singleton instances
      imageClassifier = classificationModule.imageClassifier;
      ocrExtractor = ocrModule.ocrExtractor;
    } catch (error) {
      console.error('Failed to initialize analysis services:', error);
    }
  }

  onMount(() => {
    initializeServices();
  });

  function handleAnalysisModeChange(mode: AnalysisMode): void {
    // T034: Do NOT clear results when switching tabs - only change the active mode
    // Results are only cleared when a new image is loaded (FR-010 compliance)
    if (mode !== activeAnalysisMode) {
      activeAnalysisMode = mode;
    }
  }

  function clearAllAnalysisResults(): void {
    classificationResults = null;
    ocrResults = null;
    classificationProcessing = { status: 'idle' };
    ocrProcessing = { status: 'idle' };
    
    // Clear detection overlay
    if (imageContainer) {
      const overlay = imageContainer.querySelector('.detection-overlay');
      if (overlay) {
        overlay.remove();
      }
    }
  }

  function switchToVideoMode() {
    currentMode = 'video';
    stopCamera();
    stopVideoObjectDetection();
    stopAllVideoAnalysis();
  }

  function switchToImageMode() {
    currentMode = 'image';
    stopCamera();
    stopVideoObjectDetection();
    stopAllVideoAnalysis();
  }

  function stopAllVideoAnalysis(): void {
    stopVideoClassification?.();
    stopVideoClassification = null;
    stopVideoOCR?.();
    stopVideoOCR = null;
    isClassificationRunning = false;
    isOCRRunning = false;
    
    // Reset processing states to prevent stale loading UI when switching modes
    classificationProcessing = { status: 'idle' };
    ocrProcessing = { status: 'idle' };
  }

  async function startCamera() {
    try {
      showVideoError = false;
      currentStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false 
      });
      
      if (cameraVideo) {
        cameraVideo.srcObject = currentStream;
      }
      isCameraRunning = true;
      
      // Wait for video to be ready before setting up detection
      cameraVideo?.addEventListener('loadedmetadata', () => {
        const overlay = getDetectionOverlay();
        if (overlay && cameraVideo && videoContainer) {
          overlay.setMediaElement(cameraVideo, videoContainer);
        }
      });
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      displayVideoError('Unable to access camera. Please make sure you have given permission.');
    }
  }

  function stopCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      currentStream = null;
      if (cameraVideo) {
        cameraVideo.srcObject = null;
      }
    }
    isCameraRunning = false;
    stopVideoObjectDetection();
  }

  function startVideoObjectDetection() {
    const overlay = getDetectionOverlay();
    if (!currentStream || !overlay || !overlay.isReady()) {
      displayVideoError('Camera not ready or object detection model not loaded');
      return;
    }

    if (!cameraVideo || !videoContainer) {
      displayVideoError('Video elements not ready');
      return;
    }

    isDetectionRunning = true;

    // Start continuous detection on video stream
    stopVideoDetection = overlay.getDetector().startVideoDetection(
      cameraVideo,
      videoContainer,
      (result: any) => {
        console.log('Video detection result:', result);
      },
      5 // 5 FPS for better performance
    );
  }

  function stopVideoObjectDetection() {
    if (stopVideoDetection) {
      stopVideoDetection();
      stopVideoDetection = null;
    }
    
    isDetectionRunning = false;
    
    // Clear any detection overlay
    if (videoContainer) {
      const overlay = videoContainer.querySelector('.detection-overlay');
      if (overlay) {
        overlay.remove();
      }
    }
  }

  // Classification handlers
  async function handleClassifyImage(): Promise<void> {
    if (!imageClassifier || !uploadedImage) {
      displayVideoError('Classification not ready or no image loaded');
      return;
    }

    try {
      classificationProcessing = { status: 'loading', message: 'Loading classification model...' };
      await imageClassifier.initialize();
      
      // Check status after initialization
      let status = imageClassifier.getStatus();
      
      if (status === 'loading') {
        // Set loading state and poll until idle or error
        classificationProcessing = { status: 'loading', message: 'Waiting for model to be ready...' };
        
        // Poll for status change
        const maxWaitTime = 30000; // 30 seconds max
        const pollInterval = 100; // 100ms intervals
        let waitedTime = 0;
        
        while (status === 'loading' && waitedTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          waitedTime += pollInterval;
          const newStatus = imageClassifier.getStatus();
          
          if (newStatus !== 'loading') {
            // Status changed, update and break
            status = newStatus;
            break;
          }
        }
        
        // Check if we timed out
        if (status === 'loading') {
          classificationProcessing = {
            status: 'error',
            message: 'Model initialization timed out after 30 seconds'
          };
          return;
        }
      }
      
      // Now check if status is idle (ready for classification)
      if (status !== 'idle') {
        classificationProcessing = {
          status: 'error',
          message: `Model not ready for classification. Current status: ${status}`
        };
        return;
      }
      
      classificationProcessing = { status: 'processing', message: 'Classifying image...' };
      const result = await imageClassifier.classify({ imageElement: uploadedImage });
      
      classificationResults = result;
      classificationProcessing = { status: 'complete' };
    } catch (error) {
      console.error('Classification failed:', error);
      classificationProcessing = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Classification failed'
      };
    }
  }

  async function startVideoClassification(): Promise<void> {
    if (!imageClassifier || !cameraVideo) {
      displayVideoError('Classification not ready or camera not started');
      return;
    }

    try {
      classificationProcessing = { status: 'loading', message: 'Loading classification model...' };
      await imageClassifier.initialize();

      // Wait for model to be idle before starting continuous classification
      let status = imageClassifier.getStatus();

      if (status === 'loading') {
        classificationProcessing = { status: 'loading', message: 'Waiting for model to be ready...' };

        const maxWaitTime = 30000; // 30 seconds max
        const pollInterval = 100; // 100ms intervals
        let waitedTime = 0;

        while (status === 'loading' && waitedTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          waitedTime += pollInterval;
          const newStatus = imageClassifier.getStatus();

          if (newStatus !== 'loading') {
            status = newStatus;
            break;
          }
        }

        if (status === 'loading') {
          throw new Error('Model initialization timed out after 30 seconds');
        }
      }

      if (status !== 'idle') {
        throw new Error(`Model not ready for classification. Current status: ${status}`);
      }

      classificationProcessing = { status: 'processing', message: 'Running continuous classification...' };
      isClassificationRunning = true;

      stopVideoClassification = imageClassifier.startVideoClassification(
        cameraVideo,
        (result) => {
          classificationResults = result;
          classificationProcessing = { status: 'complete' };
        },
        5 // 5 FPS
      );
    } catch (error) {
      console.error('Video classification failed:', error);
      classificationProcessing = { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Classification failed' 
      };
      isClassificationRunning = false;
    }
  }

  function stopClassification(): void {
    stopVideoClassification?.();
    stopVideoClassification = null;
    isClassificationRunning = false;
    // Keep status as 'complete' if we have results to show, otherwise reset to idle
    if (classificationResults) {
      classificationProcessing = { status: 'complete' };
    } else {
      classificationProcessing = { status: 'idle' };
    }
  }

  // OCR handlers
  async function handleExtractText(): Promise<void> {
    if (!ocrExtractor || !uploadedImage) {
      displayVideoError('OCR not ready or no image loaded');
      return;
    }

    try {
      ocrProcessing = { status: 'loading', message: 'Loading OCR engine...' };
      await ocrExtractor.initialize();

      // Wait for OCR worker to be idle before extraction
      let status = ocrExtractor.getStatus();

      if (status === 'loading') {
        ocrProcessing = { status: 'loading', message: 'Waiting for OCR engine to be ready...' };

        const maxWaitTime = 30000; // 30 seconds max
        const pollInterval = 100; // 100ms intervals
        let waitedTime = 0;

        while (status === 'loading' && waitedTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          waitedTime += pollInterval;
          const newStatus = ocrExtractor.getStatus();

          if (newStatus !== 'loading') {
            status = newStatus;
            break;
          }
        }

        if (status === 'loading') {
          ocrProcessing = {
            status: 'error',
            message: 'OCR initialization timed out after 30 seconds'
          };
          return;
        }
      }

      if (status !== 'idle') {
        ocrProcessing = {
          status: 'error',
          message: `OCR engine not ready. Current status: ${status}`
        };
        return;
      }

      ocrProcessing = { status: 'processing', message: 'Extracting text...' };
      const result = await ocrExtractor.extractText({ imageElement: uploadedImage });
      
      ocrResults = result;
      ocrProcessing = { status: 'complete' };
    } catch (error) {
      console.error('OCR failed:', error);
      ocrProcessing = { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Text extraction failed' 
      };
    }
  }

  async function startVideoOCR(): Promise<void> {
    if (!ocrExtractor || !cameraVideo) {
      displayVideoError('OCR not ready or camera not started');
      return;
    }

    try {
      ocrProcessing = { status: 'loading', message: 'Loading OCR engine...' };
      await ocrExtractor.initialize();

      // Wait for OCR worker to be idle before starting continuous OCR
      let status = ocrExtractor.getStatus();

      if (status === 'loading') {
        ocrProcessing = { status: 'loading', message: 'Waiting for OCR engine to be ready...' };

        const maxWaitTime = 30000; // 30 seconds max
        const pollInterval = 100; // 100ms intervals
        let waitedTime = 0;

        while (status === 'loading' && waitedTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          waitedTime += pollInterval;
          const newStatus = ocrExtractor.getStatus();

          if (newStatus !== 'loading') {
            status = newStatus;
            break;
          }
        }

        if (status === 'loading') {
          ocrProcessing = {
            status: 'error',
            message: 'OCR initialization timed out after 30 seconds'
          };
          return;
        }
      }

      if (status !== 'idle') {
        ocrProcessing = {
          status: 'error',
          message: `OCR engine not ready. Current status: ${status}`
        };
        return;
      }

      ocrProcessing = { status: 'processing', message: 'Running continuous OCR...' };
      isOCRRunning = true;
      
      stopVideoOCR = ocrExtractor.startVideoOCR(
        cameraVideo,
        (result) => {
          ocrResults = result;
          ocrProcessing = { status: 'complete' };
        },
        5 // 5 FPS
      );
    } catch (error) {
      console.error('Video OCR failed:', error);
      ocrProcessing = { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'OCR failed' 
      };
      isOCRRunning = false;
    }
  }

  function stopOCR(): void {
    stopVideoOCR?.();
    stopVideoOCR = null;
    isOCRRunning = false;
    // Keep status as 'complete' if we have results to show, otherwise reset to idle
    if (ocrResults) {
      ocrProcessing = { status: 'complete' };
    } else {
      ocrProcessing = { status: 'idle' };
    }
  }

  async function handleCopyText(text: string): Promise<void> {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        showCopyFeedbackMessage('Text copied to clipboard successfully!');
      } else {
        // Fallback for older browsers or non-secure contexts
        fallbackCopyToClipboard(text);
      }
    } catch (error) {
      console.error('Failed to copy text to clipboard:', error);
      showCopyFeedbackMessage('Failed to copy text. Please try again.', true);
    }
  }

  function fallbackCopyToClipboard(text: string): void {
    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      // Try the older execCommand approach
      const successful = document.execCommand('copy');
      if (successful) {
        showCopyFeedbackMessage('Text copied to clipboard successfully!');
      } else {
        throw new Error('execCommand returned false');
      }
    } catch (error) {
      console.error('Fallback clipboard method failed:', error);
      showCopyFeedbackMessage('Failed to copy text. Please try again.', true);
    } finally {
      // Clean up the temporary element
      document.body.removeChild(textArea);
    }
  }

  function showCopyFeedbackMessage(message: string, isError = false): void {
    copyFeedbackMessage = message;
    showCopyFeedback = true;
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      showCopyFeedback = false;
    }, 3000);
  }

  function displayVideoError(message: string) {
    videoErrorMessage = message;
    showVideoError = true;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      processImageFile(file);
    }
  }

  function handleImageSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  }

  function processImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File size must be less than 10MB.');
      return;
    }

    // Clear previous analysis results (FR-010 compliance)
    clearAllAnalysisResults();
    classificationProcessing = { status: 'idle' };
    ocrProcessing = { status: 'idle' };

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && e.target.result && uploadedImage) {
        uploadedImage.src = e.target.result as string;
        showImageDisplay = true;
        
        // Set up object detection for the uploaded image
        uploadedImage.onload = () => {
          const overlay = getDetectionOverlay();
          if (overlay && uploadedImage && imageContainer) {
            overlay.setMediaElement(uploadedImage, imageContainer);
          }
        };
      }
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    if (uploadedImage) {
      uploadedImage.src = '';
    }
    if (imageInput) {
      imageInput.value = '';
    }
    showImageDisplay = false;
    
    // Clear all analysis results (FR-010 compliance)
    clearAllAnalysisResults();
    classificationProcessing = { status: 'idle' };
    ocrProcessing = { status: 'idle' };
    
    // Clear any detection overlay
    if (imageContainer) {
      const overlay = imageContainer.querySelector('.detection-overlay');
      if (overlay) {
        overlay.remove();
      }
    }
  }

  function triggerFileInput() {
    imageInput?.click();
  }

  onDestroy(() => {
    stopCamera();
    stopAllVideoAnalysis();
    
    // Note: Do NOT dispose singletons here - they are shared across the app
    // and should persist for the lifetime of the application
  });
</script>

<div id="media-viewer" class="media-viewer-container">
  <!-- Mode Toggle -->
  <div class="mode-toggle-wrapper">
    <div class="mode-toggle">
      <button
        onclick={switchToVideoMode}
        class="mode-btn {currentMode === 'video' ? 'active' : ''}"
        aria-label="Live Camera"
      >
        <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="2" y="7" width="20" height="14" rx="2" stroke-width="2"/>
          <circle cx="8" cy="14" r="2" fill="currentColor"/>
        </svg>
        <span>Live Camera</span>
      </button>
      <button
        onclick={switchToImageMode}
        class="mode-btn {currentMode === 'image' ? 'active' : ''}"
        aria-label="Image Upload"
      >
        <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="M21 15l-5-5L5 21" stroke-width="2"/>
        </svg>
        <span>Image Upload</span>
      </button>
      <div class="mode-slider" style="transform: translateX({currentMode === 'video' ? '0' : '100%'})"></div>
    </div>
  </div>

  <!-- Video Mode -->
  {#if currentMode === 'video'}
    <div id="video-mode" class="mode-container">
      <div class="media-card">
        <div class="media-card-header">
          <div class="header-pulse"></div>
          <h2 class="media-title">Live Video Stream</h2>
          <div class="header-indicator {isCameraRunning ? 'active' : ''}">
            <span class="indicator-dot"></span>
            <span class="indicator-text">{isCameraRunning ? 'ACTIVE' : 'OFFLINE'}</span>
          </div>
        </div>

        <div class="media-content">
          <div id="video-container" bind:this={videoContainer} class="video-wrapper">
            <!-- svelte-ignore a11y_media_has_caption -->
            <!-- Captions not applicable: This is a live camera feed for real-time object detection, not pre-recorded media content -->
            <video
              bind:this={cameraVideo}
              autoplay
              muted
              playsinline
              class="camera-video"
            >
            </video>
            {#if !isCameraRunning}
              <div class="video-placeholder">
                <div class="placeholder-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="2" y="7" width="20" height="14" rx="2" stroke-width="2"/>
                    <circle cx="8" cy="14" r="2" fill="currentColor"/>
                  </svg>
                </div>
                <p class="placeholder-text">Camera Offline</p>
                <p class="placeholder-subtext">Click "Activate Camera" to begin</p>
              </div>
            {/if}
          </div>

          <div class="controls-panel">
            {#if !isCameraRunning}
              <button
                onclick={startCamera}
                class="control-btn primary"
              >
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
                </svg>
                <span>Activate Camera</span>
              </button>
            {:else}
              <button
                onclick={stopCamera}
                class="control-btn danger"
              >
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="6" y="6" width="12" height="12" fill="currentColor"/>
                </svg>
                <span>Stop Camera</span>
              </button>

              {#if !isDetectionRunning}
                <button
                  onclick={startVideoObjectDetection}
                  class="control-btn accent"
                >
                  <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke-width="2"/>
                    <path d="M2 17l10 5 10-5" stroke-width="2"/>
                    <path d="M2 12l10 5 10-5" stroke-width="2"/>
                  </svg>
                  <span>Enable Detection</span>
                </button>
              {:else}
                <button
                  onclick={stopVideoObjectDetection}
                  class="control-btn secondary"
                >
                  <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke-width="2"/>
                    <path d="M15 9l-6 6M9 9l6 6" stroke-width="2"/>
                  </svg>
                  <span>Disable Detection</span>
                </button>
              {/if}

              <!-- Classification Button -->
              {#if !isClassificationRunning}
                <button
                  onclick={startVideoClassification}
                  class="control-btn classify"
                  disabled={classificationProcessing.status === 'loading'}
                >
                  <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M4 5h16M4 12h16M4 19h10" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="19" cy="19" r="3" stroke-width="2"/>
                  </svg>
                  <span>{classificationProcessing.status === 'loading' ? 'Loading...' : 'Classify'}</span>
                </button>
              {:else}
                <button
                  onclick={stopClassification}
                  class="control-btn secondary"
                >
                  <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke-width="2"/>
                    <path d="M15 9l-6 6M9 9l6 6" stroke-width="2"/>
                  </svg>
                  <span>Stop Classify</span>
                </button>
              {/if}

              <!-- OCR Button -->
              {#if !isOCRRunning}
                <button
                  onclick={startVideoOCR}
                  class="control-btn ocr"
                  disabled={ocrProcessing.status === 'loading'}
                >
                  <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="2"/>
                    <polyline points="14 2 14 8 20 8" stroke-width="2"/>
                    <line x1="16" y1="13" x2="8" y2="13" stroke-width="2"/>
                    <line x1="16" y1="17" x2="8" y2="17" stroke-width="2"/>
                    <polyline points="10 9 9 9 8 9" stroke-width="2"/>
                  </svg>
                  <span>{ocrProcessing.status === 'loading' ? 'Loading...' : 'Extract Text'}</span>
                </button>
              {:else}
                <button
                  onclick={stopOCR}
                  class="control-btn secondary"
                >
                  <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke-width="2"/>
                    <path d="M15 9l-6 6M9 9l6 6" stroke-width="2"/>
                  </svg>
                  <span>Stop OCR</span>
                </button>
              {/if}
            {/if}
          </div>

          {#if showVideoError}
            <div class="error-alert">
              <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="2"/>
                <path d="M12 8v4M12 16h.01" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <p>{videoErrorMessage}</p>
            </div>
          {/if}

          {#if showCopyFeedback}
            <div class="copy-feedback {copyFeedbackMessage.includes('Failed') ? 'error' : 'success'}">
              <svg class="feedback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                {#if copyFeedbackMessage.includes('Failed')}
                  <circle cx="12" cy="12" r="10" stroke-width="2"/>
                  <path d="M12 8v4M12 16h.01" stroke-width="2" stroke-linecap="round"/>
                {:else}
                  <path d="M9 12l2 2 4-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="12" r="10" stroke-width="2"/>
                {/if}
              </svg>
              <p>{copyFeedbackMessage}</p>
            </div>
          {/if}

          <!-- Analysis Results for Video Mode -->
          <div class="analysis-results">
            <!-- Analysis Mode Tabs -->
            <AnalysisModeTabs
              activeMode={activeAnalysisMode}
              onModeChange={handleAnalysisModeChange}
              hasDetectionResults={isDetectionRunning}
              hasClassificationResults={classificationResults !== null}
              hasOCRResults={ocrResults !== null}
            />

            <!-- Conditional Results Display based on Active Mode (T033) -->
            {#if activeAnalysisMode === 'detection'}
              <!-- Detection results shown via ObjectDetectionOverlay -->
              <div class="mode-hint">
                <span>Object detection overlay is displayed on the video</span>
              </div>
            {:else if activeAnalysisMode === 'classification'}
              <ClassificationResults
                analysis={classificationResults}
                processing={classificationProcessing}
              />
            {:else if activeAnalysisMode === 'ocr'}
              <OCRResults
                analysis={ocrResults}
                processing={ocrProcessing}
                onCopyText={handleCopyText}
              />
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Image Mode -->
  {#if currentMode === 'image'}
    <div id="image-mode" class="mode-container">
      <div class="media-card">
        <div class="media-card-header">
          <div class="header-pulse"></div>
          <h2 class="media-title">Image Analysis</h2>
          <div class="header-indicator {showImageDisplay ? 'active' : ''}">
            <span class="indicator-dot"></span>
            <span class="indicator-text">{showImageDisplay ? 'LOADED' : 'WAITING'}</span>
          </div>
        </div>

        <div class="media-content">
          <!-- File Upload Area -->
          {#if !showImageDisplay}
            <button
              type="button"
              onclick={triggerFileInput}
              onkeydown={(e) => e.key === 'Enter' && triggerFileInput()}
              ondragover={handleDragOver}
              ondragleave={handleDragLeave}
              ondrop={handleDrop}
              class="upload-zone {isDragOver ? 'drag-active' : ''}"
            >
              <div class="upload-content">
                <div class="upload-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-width="2" stroke-linecap="round"/>
                    <polyline points="17 8 12 3 7 8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="12" y1="3" x2="12" y2="15" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <p class="upload-title">Drop your image here</p>
                <p class="upload-subtitle">or click to browse</p>
                <div class="upload-formats">
                  <span class="format-badge">PNG</span>
                  <span class="format-badge">JPG</span>
                  <span class="format-badge">GIF</span>
                  <span class="format-text">• Max 10MB</span>
                </div>
              </div>
            </button>
          {/if}

          <input
            type="file"
            bind:this={imageInput}
            accept="image/*"
            class="hidden"
            onchange={handleImageSelect}
          >

          <!-- Image Display with Detection Container -->
          {#if showImageDisplay}
            <div class="image-display">
              <div class="image-wrapper" bind:this={imageContainer}>
                <img
                  bind:this={uploadedImage}
                  alt="Uploaded content for object detection"
                  class="uploaded-image"
                >
              </div>

              <div class="controls-panel">
                <button
                  onclick={clearImage}
                  class="control-btn danger"
                >
                  <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span>Remove Image</span>
                </button>
                <button
                  onclick={triggerFileInput}
                  class="control-btn secondary"
                >
                  <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>Upload Different</span>
                </button>
                
                <!-- Classification Button for Images -->
                <button
                  onclick={handleClassifyImage}
                  class="control-btn classify"
                  disabled={classificationProcessing.status === 'loading' || classificationProcessing.status === 'processing'}
                >
                  <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M4 5h16M4 12h16M4 19h10" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="19" cy="19" r="3" stroke-width="2"/>
                  </svg>
                  <span>
                    {#if classificationProcessing.status === 'loading'}
                      Loading...
                    {:else if classificationProcessing.status === 'processing'}
                      Classifying...
                    {:else}
                      Classify
                    {/if}
                  </span>
                </button>

                <!-- OCR Button for Images -->
                <button
                  onclick={handleExtractText}
                  class="control-btn ocr"
                  disabled={ocrProcessing.status === 'loading' || ocrProcessing.status === 'processing'}
                >
                  <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="2"/>
                    <polyline points="14 2 14 8 20 8" stroke-width="2"/>
                    <line x1="16" y1="13" x2="8" y2="13" stroke-width="2"/>
                    <line x1="16" y1="17" x2="8" y2="17" stroke-width="2"/>
                    <polyline points="10 9 9 9 8 9" stroke-width="2"/>
                  </svg>
                  <span>
                    {#if ocrProcessing.status === 'loading'}
                      Loading...
                    {:else if ocrProcessing.status === 'processing'}
                      Extracting...
                    {:else}
                      Extract Text
                    {/if}
                  </span>
                </button>
              </div>

              <!-- Analysis Results for Image Mode -->
              <div class="analysis-results">
                <!-- Analysis Mode Tabs -->
                <AnalysisModeTabs
                  activeMode={activeAnalysisMode}
                  onModeChange={handleAnalysisModeChange}
                  hasDetectionResults={false}
                  hasClassificationResults={classificationResults !== null}
                  hasOCRResults={ocrResults !== null}
                />

                <!-- Conditional Results Display based on Active Mode (T033) -->
                {#if activeAnalysisMode === 'detection'}
                  <!-- Detection results shown via ObjectDetectionOverlay -->
                  <div class="mode-hint">
                    <span>Object detection overlay is displayed on the image</span>
                  </div>
                {:else if activeAnalysisMode === 'classification'}
                  <ClassificationResults
                    analysis={classificationResults}
                    processing={classificationProcessing}
                  />
                {:else if activeAnalysisMode === 'ocr'}
                  <OCRResults
                    analysis={ocrResults}
                    processing={ocrProcessing}
                    onCopyText={handleCopyText}
                  />
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Object Detection Overlay -->
  <ObjectDetectionOverlay 
    showControls={true} 
    showStats={true}
    onDetectionResult={(result) => detectionResults = result}
  />
  
  <!-- Performance Monitor (dev mode only) -->
  <PerformanceMonitor
    classificationResult={classificationResults}
    ocrResult={ocrResults}
    detectionResult={detectionResults}
  />
</div>

<style>
.media-viewer-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  animation: fadeIn 0.8s ease-out 0.6s backwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Mode Toggle */
.mode-toggle-wrapper {
  margin-bottom: 3rem;
  display: flex;
  justify-content: center;
}

.mode-toggle {
  position: relative;
  display: inline-flex;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 1rem;
  padding: 0.5rem;
  gap: 0.5rem;
}

.mode-slider {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  width: calc(50% - 0.5rem);
  height: calc(100% - 1rem);
  background: linear-gradient(135deg, var(--cosmic-cyan), var(--cosmic-purple));
  border-radius: 0.75rem;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
}

.mode-btn {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 0.75rem;
}

.mode-btn.active {
  color: white;
}

.mode-btn:hover:not(.active) {
  color: rgba(255, 255, 255, 0.8);
}

.mode-icon {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

/* Media Card */
.mode-container {
  animation: slideIn 0.5s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

.media-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 1.5rem;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease;
}

.media-card:hover {
  border-color: rgba(139, 92, 246, 0.4);
  box-shadow: 0 20px 80px rgba(139, 92, 246, 0.3);
}

.media-card-header {
  position: relative;
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1));
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-pulse {
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

.media-title {
  position: relative;
  z-index: 1;
  font-family: 'Orbitron', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, white, var(--cosmic-cyan));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-indicator {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.header-indicator.active .indicator-dot {
  background: var(--cosmic-cyan);
  box-shadow: 0 0 10px var(--cosmic-cyan), 0 0 20px var(--cosmic-cyan);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.2); }
}

.header-indicator.active .indicator-text {
  color: var(--cosmic-cyan);
}

.media-content {
  padding: 2rem;
}

/* Video Wrapper */
.video-wrapper {
  position: relative;
  width: 100%;
  min-height: 400px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 1rem;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-video {
  width: 100%;
  max-height: 500px;
  object-fit: contain;
  display: block;
}

.video-placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

.placeholder-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  opacity: 0.3;
}

.placeholder-icon svg {
  width: 100%;
  height: 100%;
  stroke: currentColor;
}

.placeholder-text {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 0.05em;
}

.placeholder-subtext {
  font-size: 0.9rem;
  opacity: 0.7;
  font-family: 'JetBrains Mono', monospace;
}

/* Upload Zone */
.upload-zone {
  position: relative;
  width: 100%;
  min-height: 400px;
  background: rgba(0, 0, 0, 0.3);
  border: 2px dashed rgba(139, 92, 246, 0.3);
  border-radius: 1rem;
  padding: 3rem;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

.upload-zone::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, rgba(139, 92, 246, 0.1), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.upload-zone:hover::before,
.upload-zone.drag-active::before {
  opacity: 1;
}

.upload-zone:hover,
.upload-zone.drag-active {
  border-color: var(--cosmic-purple);
  background: rgba(139, 92, 246, 0.1);
  transform: scale(1.01);
}

.upload-content {
  position: relative;
  z-index: 1;
  text-align: center;
}

.upload-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  color: var(--cosmic-purple);
}

.upload-icon svg {
  width: 100%;
  height: 100%;
  stroke: currentColor;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.upload-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 0.5rem;
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 0.05em;
}

.upload-subtitle {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 2rem;
  font-family: 'JetBrains Mono', monospace;
}

.upload-formats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.format-badge {
  padding: 0.5rem 1rem;
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid rgba(139, 92, 246, 0.4);
  border-radius: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--cosmic-purple);
  letter-spacing: 0.1em;
}

.format-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

/* Image Display */
.image-display {
  width: 100%;
}

.image-wrapper {
  position: relative;
  display: inline-block;
  width: 100%;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 1rem;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.uploaded-image {
  width: 100%;
  max-height: 600px;
  object-fit: contain;
  display: block;
}

/* Controls Panel */
.controls-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  color: white;
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

.control-btn::before {
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

.control-btn:hover::before {
  opacity: 1;
}

.control-btn.primary {
  background: linear-gradient(135deg, var(--cosmic-cyan), var(--cosmic-purple));
  border-color: var(--cosmic-purple);
}

.control-btn.primary:hover {
  box-shadow: 0 8px 30px rgba(139, 92, 246, 0.4);
  transform: translateY(-2px);
}

.control-btn.accent {
  background: linear-gradient(135deg, var(--cosmic-purple), var(--cosmic-pink));
  border-color: var(--cosmic-pink);
}

.control-btn.accent:hover {
  box-shadow: 0 8px 30px rgba(236, 72, 153, 0.4);
  transform: translateY(-2px);
}

.control-btn.danger {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}

.control-btn.danger:hover {
  background: rgba(239, 68, 68, 0.3);
  box-shadow: 0 8px 30px rgba(239, 68, 68, 0.3);
  transform: translateY(-2px);
}

.control-btn.secondary {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.control-btn.secondary:hover {
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

/* Classification Button */
.control-btn.classify {
  background: linear-gradient(135deg, var(--cosmic-gold, #f59e0b), var(--cosmic-cyan));
  border-color: var(--cosmic-gold, #f59e0b);
}

.control-btn.classify:hover:not(:disabled) {
  box-shadow: 0 8px 30px rgba(245, 158, 11, 0.4);
  transform: translateY(-2px);
}

/* OCR Button */
.control-btn.ocr {
  background: linear-gradient(135deg, var(--cosmic-cyan), var(--cosmic-purple));
  border-color: var(--cosmic-cyan);
}

.control-btn.ocr:hover:not(:disabled) {
  box-shadow: 0 8px 30px rgba(6, 182, 212, 0.4);
  transform: translateY(-2px);
}

/* Disabled State */
.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.control-btn:disabled:hover {
  transform: none;
  box-shadow: none;
}

/* Analysis Results Container */
.analysis-results {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Mode Hint */
.mode-hint {
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 0.75rem;
  text-align: center;
}

.mode-hint span {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
}

/* Error Alert */
.error-alert {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.75rem;
  color: #fca5a5;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  margin-top: 1rem;
}

.error-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  stroke-width: 2;
}

/* Copy Feedback Alert */
.copy-feedback {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  color: #86efac;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  margin-top: 1rem;
  animation: slideIn 0.3s ease-out;
}

.copy-feedback.success {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86efac;
}

.copy-feedback.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.feedback-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  stroke-width: 2;
}

.hidden {
  display: none;
}

/* Responsive Design */
@media (max-width: 768px) {
  .media-card-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .media-title {
    font-size: 1.25rem;
  }

  .controls-panel {
    flex-direction: column;
    width: 100%;
  }

  .control-btn {
    width: 100%;
    justify-content: center;
  }

  .mode-btn {
    padding: 0.875rem 1.5rem;
    font-size: 0.8rem;
  }

  .mode-btn span {
    display: none;
  }

  .upload-zone {
    min-height: 300px;
    padding: 2rem 1rem;
  }

  .upload-title {
    font-size: 1.25rem;
  }
}
</style>
