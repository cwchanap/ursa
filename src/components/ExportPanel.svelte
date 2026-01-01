<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { AnalysisMode, DetectionResult, ClassificationAnalysis, OCRAnalysis } from '../lib/types/analysis';
  import type { DetectionSettings } from '../lib/types/settings';
  import { exportService } from '../lib/services/exportService';

  // Props
  interface Props {
    activeMode?: AnalysisMode;
    imageElement?: HTMLImageElement | HTMLVideoElement | null;
    detectionResults?: DetectionResult | null;
    classificationResults?: ClassificationAnalysis | null;
    ocrResults?: OCRAnalysis | null;
    detectionSettings?: Partial<DetectionSettings>;
    className?: string;
  }

  let {
    activeMode = 'detection',
    imageElement = null,
    detectionResults = null,
    classificationResults = null,
    ocrResults = null,
    detectionSettings = {},
    className = '',
  }: Props = $props();

  // UI State
  let isExporting = $state(false);
  let showDropdown = $state(false);
  let feedbackMessage = $state('');
  let feedbackType = $state<'success' | 'error' | ''>('');
  let feedbackTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  // Derived state
  let hasResults = $derived(
    (activeMode === 'detection' && detectionResults !== null) ||
    (activeMode === 'classification' && classificationResults !== null) ||
    (activeMode === 'ocr' && ocrResults !== null)
  );

  let canExport = $derived(hasResults && imageElement !== null);

  // Get current results based on active mode
  function getCurrentResults(): DetectionResult | ClassificationAnalysis | OCRAnalysis | null {
    switch (activeMode) {
      case 'detection':
        return detectionResults;
      case 'classification':
        return classificationResults;
      case 'ocr':
        return ocrResults;
      default:
        return null;
    }
  }

  // Show feedback message
  function showFeedback(message: string, type: 'success' | 'error'): void {
    feedbackMessage = message;
    feedbackType = type;

    if (feedbackTimeout) {
      clearTimeout(feedbackTimeout);
    }

    feedbackTimeout = setTimeout(() => {
      feedbackMessage = '';
      feedbackType = '';
    }, 3000);
  }

  // Export image with overlay
  async function handleExportImage(): Promise<void> {
    if (!canExport || !imageElement) return;

    isExporting = true;
    showDropdown = false;

    try {
      let result;

      switch (activeMode) {
        case 'detection':
          if (detectionResults) {
            result = await exportService.exportDetectionImage(
              imageElement,
              detectionResults,
              detectionSettings
            );
          }
          break;
        case 'classification':
          if (classificationResults) {
            result = await exportService.exportClassificationImage(
              imageElement,
              classificationResults
            );
          }
          break;
        case 'ocr':
          if (ocrResults) {
            const results = await exportService.exportOCRResults(
              imageElement,
              ocrResults
            );
            result = results.imageResult;
          }
          break;
      }

      if (result?.success) {
        showFeedback(`Exported: ${result.filename}`, 'success');
      } else {
        showFeedback(result?.error || 'Export failed', 'error');
      }
    } catch (error) {
      showFeedback('Export failed', 'error');
    } finally {
      isExporting = false;
    }
  }

  // Copy results as JSON
  async function handleCopyJSON(): Promise<void> {
    const results = getCurrentResults();
    if (!results) return;

    showDropdown = false;

    try {
      const { success, error } = await exportService.copyResultsAsJSON(results);

      if (success) {
        showFeedback('Copied to clipboard!', 'success');
      } else {
        showFeedback(error || 'Copy failed', 'error');
      }
    } catch {
      showFeedback('Copy failed', 'error');
    }
  }

  // Export as JSON file
  async function handleExportJSON(): Promise<void> {
    const results = getCurrentResults();
    if (!results) return;

    showDropdown = false;

    try {
      const result = await exportService.exportResultsAsJSON(activeMode, results);

      if (result.success) {
        showFeedback(`Exported: ${result.filename}`, 'success');
      } else {
        showFeedback(result.error || 'Export failed', 'error');
      }
    } catch {
      showFeedback('Export failed', 'error');
    }
  }

  // Handle click outside to close dropdown
  function handleOutsideClick(event: MouseEvent): void {
    if (!showDropdown) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const container = target.closest('.export-panel');
    if (!container) {
      showDropdown = false;
    }
  }

  // Add click listener on mount
  $effect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('click', handleOutsideClick);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('click', handleOutsideClick);
    }
    if (feedbackTimeout) {
      clearTimeout(feedbackTimeout);
    }
  });
</script>

<div class="export-panel {className}" data-testid="export-panel" data-can-export={canExport}>
  <!-- Export Button -->
  <div class="export-button-container">
    <button
      class="export-button"
      onclick={() => showDropdown = !showDropdown}
      disabled={!canExport || isExporting}
      aria-haspopup="true"
      aria-expanded={showDropdown}
      data-testid="export-button"
    >
      {#if isExporting}
        <svg class="export-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2" stroke-opacity="0.2"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>Exporting...</span>
      {:else}
        <svg class="export-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="7 10 12 15 17 10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="12" y1="15" x2="12" y2="3" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>Export</span>
        <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      {/if}
    </button>

    <!-- Dropdown Menu -->
    {#if showDropdown}
      <div class="export-dropdown">
        <button class="dropdown-item" onclick={handleExportImage}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
            <path d="M21 15l-5-5L5 21" stroke-width="2"/>
          </svg>
          <span>Download Image (PNG)</span>
        </button>

        <button class="dropdown-item" onclick={handleCopyJSON}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-width="2"/>
          </svg>
          <span>Copy JSON to Clipboard</span>
        </button>

        <button class="dropdown-item" onclick={handleExportJSON}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="2"/>
            <polyline points="14 2 14 8 20 8" stroke-width="2"/>
            <path d="M12 18v-6M9 15l3 3 3-3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Download JSON</span>
        </button>

        {#if activeMode === 'ocr' && ocrResults}
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" onclick={async () => {
            showDropdown = false;
            if (ocrResults) {
              const result = await exportService.exportOCRText(ocrResults);
              if (result.success) {
                showFeedback(`Exported: ${result.filename}`, 'success');
              }
            }
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="2"/>
              <polyline points="14 2 14 8 20 8" stroke-width="2"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke-width="2"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke-width="2"/>
            </svg>
            <span>Download Text (.txt)</span>
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Feedback Toast -->
  {#if feedbackMessage}
    <div class="feedback-toast {feedbackType}">
      {#if feedbackType === 'success'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M9 12l2 2 4-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
          <path d="M12 8v4M12 16h.01" stroke-width="2" stroke-linecap="round"/>
        </svg>
      {/if}
      <span>{feedbackMessage}</span>
    </div>
  {/if}
</div>

<style>
.export-panel {
  position: relative;
}

.export-button-container {
  position: relative;
}

.export-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2));
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 0.75rem;
  color: #10b981;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.export-button:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(6, 182, 212, 0.3));
  border-color: rgba(16, 185, 129, 0.5);
  transform: translateY(-1px);
}

.export-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-icon {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.export-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.chevron-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2;
  margin-left: 0.25rem;
}

.export-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  min-width: 220px;
  background: rgba(10, 14, 39, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 0.75rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 100;
  overflow: hidden;
  animation: dropdownFadeIn 0.15s ease-out;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dropdown-item:hover {
  background: rgba(16, 185, 129, 0.15);
  color: white;
}

.dropdown-item svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
  color: #10b981;
}

.dropdown-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0.25rem 0;
}

.feedback-toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  background: rgba(10, 14, 39, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  z-index: 1000;
  animation: toastSlideUp 0.3s ease-out;
}

@keyframes toastSlideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.feedback-toast.success {
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86efac;
}

.feedback-toast.error {
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.feedback-toast svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}
</style>
