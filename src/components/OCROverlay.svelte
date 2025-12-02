<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { OCRResult } from '../lib/types/analysis';

  // Props
  export let textRegions: OCRResult[] = [];
  export let imageElement: HTMLImageElement | HTMLVideoElement | null = null;
  export let visible: boolean = true;
  export let className: string = "";

  // Internal state
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let hoveredRegion: OCRResult | null = null;
  let tooltipPosition = { x: 0, y: 0 };
  let animationFrameId: number | null = null;
  
  // Tooltip hover delay (200ms to prevent flicker)
  const TOOLTIP_DELAY_MS = 200;
  let hoverDelayTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingRegion: OCRResult | null = null;

  // OCR color scheme (green - #10B981)
  const OCR_COLOR = '#10B981';
  const OCR_COLOR_HOVER = '#34D399';
  const OCR_COLOR_BG = 'rgba(16, 185, 129, 0.15)';

  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      updateCanvasSize();
      startRenderLoop();
    }

    // Handle window resize
    window.addEventListener('resize', updateCanvasSize);
  });

  onDestroy(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    if (hoverDelayTimeout) {
      clearTimeout(hoverDelayTimeout);
    }
    window.removeEventListener('resize', updateCanvasSize);
  });

  // Reactive: Update canvas when image element or regions change
  $: if (imageElement && ctx) {
    updateCanvasSize();
  }

  $: if (textRegions && ctx) {
    renderOverlay();
  }

  function updateCanvasSize(): void {
    if (!canvas || !imageElement) return;

    // Get the displayed size of the media element
    const rect = imageElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Position canvas over the image
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    renderOverlay();
  }

  function startRenderLoop(): void {
    const render = () => {
      if (visible && ctx) {
        renderOverlay();
      }
      animationFrameId = requestAnimationFrame(render);
    };
    animationFrameId = requestAnimationFrame(render);
  }

  function renderOverlay(): void {
    if (!ctx || !canvas || !imageElement || !visible) return;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (textRegions.length === 0) return;

    // Get image dimensions for scaling
    const imageWidth = imageElement instanceof HTMLVideoElement
      ? imageElement.videoWidth
      : imageElement.naturalWidth || imageElement.width;
    const imageHeight = imageElement instanceof HTMLVideoElement
      ? imageElement.videoHeight
      : imageElement.naturalHeight || imageElement.height;

    // Calculate scale factors
    const scaleX = canvas.width / imageWidth;
    const scaleY = canvas.height / imageHeight;

    // Draw each text region
    for (const region of textRegions) {
      if (!region.bbox) continue;

      const isHovered = hoveredRegion === region;
      const { x, y, width, height } = region.bbox;

      // Scale coordinates to canvas size
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;

      // Draw filled background
      ctx.fillStyle = isHovered ? 'rgba(52, 211, 153, 0.25)' : OCR_COLOR_BG;
      ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw border
      ctx.strokeStyle = isHovered ? OCR_COLOR_HOVER : OCR_COLOR;
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw confidence indicator (small bar at bottom)
      const confidenceWidth = (region.confidence / 100) * scaledWidth;
      ctx.fillStyle = isHovered ? OCR_COLOR_HOVER : OCR_COLOR;
      ctx.fillRect(scaledX, scaledY + scaledHeight - 2, confidenceWidth, 2);
    }
  }

  function handleMouseMove(event: MouseEvent): void {
    if (!canvas || !imageElement || textRegions.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Get image dimensions for scaling
    const imageWidth = imageElement instanceof HTMLVideoElement
      ? imageElement.videoWidth
      : imageElement.naturalWidth || imageElement.width;
    const imageHeight = imageElement instanceof HTMLVideoElement
      ? imageElement.videoHeight
      : imageElement.naturalHeight || imageElement.height;

    // Calculate scale factors
    const scaleX = canvas.width / imageWidth;
    const scaleY = canvas.height / imageHeight;

    // Check if mouse is over any region
    let foundRegion: OCRResult | null = null;
    
    for (const region of textRegions) {
      if (!region.bbox) continue;

      const { x, y, width, height } = region.bbox;
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;

      if (
        mouseX >= scaledX &&
        mouseX <= scaledX + scaledWidth &&
        mouseY >= scaledY &&
        mouseY <= scaledY + scaledHeight
      ) {
        foundRegion = region;
        tooltipPosition = {
          x: event.clientX,
          y: event.clientY
        };
        break;
      }
    }

    // Handle tooltip with delay to prevent flicker
    if (foundRegion !== pendingRegion) {
      // Clear any pending timeout
      if (hoverDelayTimeout) {
        clearTimeout(hoverDelayTimeout);
        hoverDelayTimeout = null;
      }

      pendingRegion = foundRegion;

      if (foundRegion) {
        // Delay showing tooltip
        hoverDelayTimeout = setTimeout(() => {
          hoveredRegion = foundRegion;
          hoverDelayTimeout = null;
        }, TOOLTIP_DELAY_MS);
      } else {
        // Hide tooltip immediately when moving off a region
        hoveredRegion = null;
      }
    } else if (hoveredRegion) {
      // Update position while hovering over the same region
      tooltipPosition = {
        x: event.clientX,
        y: event.clientY
      };
    }
  }

  function handleMouseLeave(): void {
    // Clear any pending timeout
    if (hoverDelayTimeout) {
      clearTimeout(hoverDelayTimeout);
      hoverDelayTimeout = null;
    }
    pendingRegion = null;
    hoveredRegion = null;
  }
</script>

{#if visible}
  <div class="ocr-overlay-container {className}">
    <canvas
      bind:this={canvas}
      class="ocr-canvas"
      on:mousemove={handleMouseMove}
      on:mouseleave={handleMouseLeave}
    ></canvas>

    <!-- Tooltip -->
    {#if hoveredRegion}
      <div
        class="ocr-tooltip"
        style="left: {tooltipPosition.x + 10}px; top: {tooltipPosition.y + 10}px;"
      >
        <div class="tooltip-content">
          <span class="tooltip-text">{hoveredRegion.text}</span>
          <span class="tooltip-confidence">
            {hoveredRegion.confidence.toFixed(0)}% confidence
          </span>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
.ocr-overlay-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 15;
}

.ocr-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: auto;
  cursor: crosshair;
}

.ocr-tooltip {
  position: fixed;
  z-index: 100;
  max-width: 300px;
  padding: 0.75rem 1rem;
  background: rgba(10, 14, 39, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(16, 185, 129, 0.4);
  border-radius: 0.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.2);
  pointer-events: none;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.tooltip-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: white;
  word-break: break-word;
  line-height: 1.4;
}

.tooltip-confidence {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: #10b981;
  letter-spacing: 0.05em;
}
</style>
