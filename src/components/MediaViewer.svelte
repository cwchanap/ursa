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

<div id="media-viewer" class="w-full max-w-4xl mx-auto p-6">
  <!-- Mode Toggle -->
  <div class="mb-6">
    <div class="flex items-center justify-center space-x-4">
      <button 
        onclick={switchToVideoMode}
        class="px-6 py-3 rounded-lg font-medium transition-colors duration-200 {currentMode === 'video' ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
      >
        📹 Video Mode
      </button>
      <button 
        onclick={switchToImageMode}
        class="px-6 py-3 rounded-lg font-medium transition-colors duration-200 {currentMode === 'image' ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
      >
        🖼️ Image Mode
      </button>
    </div>
  </div>

  <!-- Video Mode -->
  {#if currentMode === 'video'}
    <div id="video-mode" class="mode-container">
      <div class="bg-gray-100 rounded-lg p-6">
        <h2 class="text-2xl font-bold mb-4 text-center">Video Mode</h2>
        <div class="flex flex-col items-center space-y-4">
          <div id="video-container" bind:this={videoContainer} class="relative">
            <!-- svelte-ignore a11y_media_has_caption -->
            <video 
              bind:this={cameraVideo}
              autoplay 
              muted 
              playsinline
              class="max-w-full h-auto rounded-lg shadow-lg camera-video"
            >
            </video>
          </div>
          <div class="flex space-x-4">
            {#if !isCameraRunning}
              <button 
                onclick={startCamera}
                class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200"
              >
                Start Camera
              </button>
            {:else}
              <button 
                onclick={stopCamera}
                class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
              >
                Stop Camera
              </button>
              {#if !isDetectionRunning}
                <button 
                  onclick={startVideoObjectDetection}
                  class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors duration-200"
                >
                  Start Detection
                </button>
              {:else}
                <button 
                  onclick={stopVideoObjectDetection}
                  class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
                >
                  Stop Detection
                </button>
              {/if}
            {/if}
          </div>
          {#if showVideoError}
            <div class="text-red-500 text-center">{videoErrorMessage}</div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Image Mode -->
  {#if currentMode === 'image'}
    <div id="image-mode" class="mode-container">
      <div class="bg-gray-100 rounded-lg p-6">
        <h2 class="text-2xl font-bold mb-4 text-center">Image Mode with Object Detection</h2>
        <div class="flex flex-col items-center space-y-4">
          <!-- File Upload Area -->
          {#if !showImageDisplay}
            <button
              type="button"
              onclick={triggerFileInput}
              onkeydown={(e) => e.key === 'Enter' && triggerFileInput()}
              ondragover={handleDragOver}
              ondragleave={handleDragLeave}
              ondrop={handleDrop}
              class="upload-area border-2 border-dashed border-gray-300 rounded-lg p-8 w-full max-w-md text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors duration-200 {isDragOver ? 'border-blue-400 bg-blue-50' : ''}"
            >
              <div class="text-gray-600">
                <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <p class="mt-2">Click to upload an image</p>
                <p class="text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
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
            <div class="w-full">
              <div class="flex flex-col items-center space-y-4">
                <div bind:this={imageContainer} class="relative inline-block">
                  <img 
                    bind:this={uploadedImage}
                    alt="Uploaded content for object detection"
                    class="max-w-full h-auto rounded-lg shadow-lg uploaded-image"
                  >
                </div>
                <div class="flex space-x-4">
                  <button 
                    onclick={clearImage}
                    class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
                  >
                    Clear Image
                  </button>
                </div>
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
.mode-container {
  transition: opacity 0.3s ease-in-out;
}

.upload-area {
  transition: all 0.2s ease-in-out;
}

.upload-area:hover {
  transform: translateY(-1px);
}

.camera-video {
  background-color: #000;
  max-height: 400px;
}

.uploaded-image {
  max-height: 400px;
}
</style>
