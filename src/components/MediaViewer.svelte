<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ObjectDetectionOverlay from './ObjectDetectionOverlay.svelte';

  // Type for window.detectionOverlay
  interface DetectionOverlayGlobal {
    setMediaElement: (el: HTMLImageElement | HTMLVideoElement, container: HTMLElement) => void;
    getDetector: () => any;
    isReady: () => boolean;
    dispose: () => void;
  }

  // State
  let currentMode: 'video' | 'image' = 'video';
  let currentStream: MediaStream | null = null;
  let stopVideoDetection: (() => void) | null = null;

  // Element bindings
  let cameraVideo: HTMLVideoElement;
  let videoContainer: HTMLElement;
  let imageContainer: HTMLElement;
  let uploadedImage: HTMLImageElement;
  let imageInput: HTMLInputElement;

  // UI State
  let isCameraRunning = false;
  let isDetectionRunning = false;
  let videoErrorMessage = '';
  let showVideoError = false;
  let showImageDisplay = false;
  let isDragOver = false;

  // Helper to get detection overlay from window
  function getDetectionOverlay(): DetectionOverlayGlobal | undefined {
    return (window as any).detectionOverlay;
  }

  function switchToVideoMode() {
    currentMode = 'video';
    stopCamera();
    stopVideoObjectDetection();
  }

  function switchToImageMode() {
    currentMode = 'image';
    stopCamera();
    stopVideoObjectDetection();
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
  });
</script>

<div id="media-viewer" class="media-viewer-container">
  <!-- Mode Toggle -->
  <div class="mode-toggle-wrapper">
    <div class="mode-toggle">
      <button
        onclick={switchToVideoMode}
        class="mode-btn {currentMode === 'video' ? 'active' : ''}"
      >
        <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="2" y="7" width="20" height="14" rx="2" stroke-width="2"/>
          <circle cx="8" cy="14" r="2" fill="currentColor"/>
        </svg>
        <span>Live Camera</span>
      </button>
      <button
        onclick={switchToImageMode}
        class="mode-btn {currentMode === 'image' ? 'active' : ''}"
      >
        <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Object Detection Overlay -->
  <ObjectDetectionOverlay showControls={true} showStats={true} />
</div>

<style>
:root {
  --cosmic-cyan: #06b6d4;
  --cosmic-purple: #8b5cf6;
  --cosmic-pink: #ec4899;
  --cosmic-gold: #fbbf24;
}

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
