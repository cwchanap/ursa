<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { OCRAnalysis, ProcessingState } from '../lib/types/analysis';
  import { onMount } from 'svelte';

  // Props
  interface Props {
    analysis?: OCRAnalysis | null;
    processing?: ProcessingState;
    onCopyText?: ((text: string) => void) | undefined;
    onLanguageChange?: ((language: string) => void) | undefined;
    currentLanguage?: string;
    className?: string;
  }

  let {
    analysis = null,
    processing = { status: 'idle' },
    onCopyText = undefined,
    onLanguageChange = undefined,
    currentLanguage = 'eng',
    className = ""
  }: Props = $props();

  // Available languages
  const LANGUAGES = [
    { code: 'eng', name: 'English' },
    { code: 'spa', name: 'Spanish' },
    { code: 'fra', name: 'French' },
    { code: 'deu', name: 'German' },
    { code: 'ita', name: 'Italian' },
    { code: 'por', name: 'Portuguese' },
    { code: 'chi_sim', name: 'Chinese (Simplified)' },
    { code: 'jpn', name: 'Japanese' },
    { code: 'kor', name: 'Korean' },
  ];

  // UI State
  let copySuccess = $state(false);
  let copyError = $state(false);
  let copyTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let showLanguageDropdown = $state(false);

  // Reactive: Show results when analysis is available
  let showResults = $derived(analysis !== null && processing.status === 'complete');

  // Get processing time color class
  function getProcessingTimeColor(ms: number): string {
    if (ms < 2000) return 'fast';
    if (ms < 3000) return 'medium';
    return 'slow';
  }

  // Get confidence color class
  function getConfidenceColor(confidence: number): string {
    if (confidence >= 80) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  }

  // Copy text to clipboard
  async function copyToClipboard(): Promise<void> {
    if (!analysis?.fullText) return;

    try {
      await navigator.clipboard.writeText(analysis.fullText);
      copySuccess = true;
      copyError = false;
      
      // Clear previous timeout
      if (copyTimeout) {
        clearTimeout(copyTimeout);
      }
      
      // Reset after 2 seconds
      copyTimeout = setTimeout(() => {
        copySuccess = false;
      }, 2000);

      // Call callback if provided
      onCopyText?.(analysis.fullText);
    } catch (error) {
      console.error('Failed to copy text:', error);
      copyError = true;
      copySuccess = false;
      
      // Clear previous timeout
      if (copyTimeout) {
        clearTimeout(copyTimeout);
      }
      
      // Reset error after 3 seconds
      copyTimeout = setTimeout(() => {
        copyError = false;
      }, 3000);
    }
  }

  // Calculate average confidence
  function getAverageConfidence(): number {
    if (!analysis?.textRegions.length) return 0;
    const sum = analysis.textRegions.reduce((acc, r) => acc + r.confidence, 0);
    return sum / analysis.textRegions.length;
  }

  // Handle language selection
  function handleLanguageSelect(langCode: string): void {
    showLanguageDropdown = false;
    if (langCode !== currentLanguage) {
      onLanguageChange?.(langCode);
    }
  }

  // Get language name from code
  function getLanguageName(code: string): string {
    return LANGUAGES.find(l => l.code === code)?.name || code.toUpperCase();
  }

  function handleOutsideClick(event: MouseEvent): void {
    if (!showLanguageDropdown) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const container = target.closest('.language-dropdown-container');
    if (!container) {
      showLanguageDropdown = false;
    }
  }

  onMount(() => {
    window.addEventListener('click', handleOutsideClick);
  });

  onDestroy(() => {
    window.removeEventListener('click', handleOutsideClick);
    if (copyTimeout) {
      clearTimeout(copyTimeout);
      copyTimeout = null;
    }
  });
</script>

<div class="ocr-results {className}">
  <!-- Loading State -->
  {#if processing.status === 'loading'}
    <div class="results-loading">
      <div class="loading-content">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
        </div>
        <div class="loading-info">
          <span class="loading-title">Loading OCR Engine</span>
          <span class="loading-text">{processing.message || 'Initializing Tesseract.js...'}</span>
        </div>
      </div>
      {#if processing.progress !== undefined}
        <div class="loading-progress">
          <div class="progress-bar" style="width: {processing.progress}%"></div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Processing State -->
  {#if processing.status === 'processing'}
    <div class="results-processing">
      <div class="processing-content">
        <div class="processing-spinner">
          <svg viewBox="0 0 24 24" fill="none" class="spinner-icon">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-opacity="0.2"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="processing-text">{processing.message || 'Extracting text from image...'}</span>
      </div>
    </div>
  {/if}

  <!-- Error State -->
  {#if processing.status === 'error'}
    <div class="results-error">
      <div class="error-content">
        <div class="error-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <path d="M12 8v4M12 16h.01" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="error-info">
          <h4 class="error-title">OCR Error</h4>
          <p class="error-message">{processing.message || 'Unable to extract text. Please try again.'}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Results Display -->
  {#if showResults && analysis}
    <div class="results-container">
      <div class="results-header">
        <div class="header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="2"/>
            <polyline points="14 2 14 8 20 8" stroke-width="2"/>
            <line x1="16" y1="13" x2="8" y2="13" stroke-width="2"/>
            <line x1="16" y1="17" x2="8" y2="17" stroke-width="2"/>
            <polyline points="10 9 9 9 8 9" stroke-width="2"/>
          </svg>
        </div>
        <h3 class="results-title">Extracted Text</h3>
        <div class="processing-badge {getProcessingTimeColor(analysis.processingTime)}">
          <span class="badge-value">{(analysis.processingTime / 1000).toFixed(1)}s</span>
        </div>
      </div>

      <div class="results-body">
        <!-- Extracted Text Area -->
        {#if analysis.fullText.trim()}
          <div class="text-section">
            <div class="text-header">
              <h4 class="section-title">Recognized Text</h4>
              <button 
                onclick={copyToClipboard}
                class="copy-btn {copySuccess ? 'success' : ''} {copyError ? 'error' : ''}"
                aria-label="Copy text to clipboard"
              >
                {#if copySuccess}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="20 6 9 17 4 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>Copied!</span>
                {:else if copyError}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke-width="2"/>
                    <path d="M15 9l-6 6M9 9l6 6" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span>Failed</span>
                {:else}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke-width="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-width="2"/>
                  </svg>
                  <span>Copy</span>
                {/if}
              </button>
            </div>
            <div class="text-content">
              <pre class="extracted-text">{analysis.fullText}</pre>
            </div>
          </div>
        {:else}
          <div class="no-text-found">
            <div class="no-text-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8" stroke-width="2"/>
                <path d="m21 21-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
                <path d="M8 11h6" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="no-text-message">No text found in this image</p>
            <p class="no-text-hint">Try with an image containing clearer text</p>
          </div>
        {/if}

        <!-- Stats -->
        {#if analysis.textRegions.length > 0}
          <div class="stats-section">
            <div class="stat-item">
              <span class="stat-label">Words Found</span>
              <span class="stat-value">{analysis.textRegions.length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Avg Confidence</span>
              <span class="stat-value {getConfidenceColor(getAverageConfidence())}">
                {getAverageConfidence().toFixed(0)}%
              </span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Language</span>
              <span class="stat-value">{analysis.language.toUpperCase()}</span>
            </div>
          </div>
        {/if}

        <!-- Meta Info -->
        <div class="results-meta">
          <div class="meta-item">
            <span class="meta-label">Image Size</span>
            <span class="meta-value">{analysis.imageDimensions.width} × {analysis.imageDimensions.height}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Processed At</span>
            <span class="meta-value">{new Date(analysis.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Idle State (no results yet) -->
  {#if processing.status === 'idle' && !analysis}
    <div class="results-idle">
      <div class="idle-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="1.5"/>
          <polyline points="14 2 14 8 20 8" stroke-width="1.5"/>
          <line x1="9" y1="15" x2="15" y2="15" stroke-width="1.5" stroke-opacity="0.5"/>
          <line x1="9" y1="11" x2="15" y2="11" stroke-width="1.5" stroke-opacity="0.5"/>
        </svg>
      </div>
      <p class="idle-text">Upload an image and click "Extract Text" to recognize text</p>
      
      <!-- Language Selector -->
      <div class="language-selector">
        <span class="language-label">Language:</span>
        <div class="language-dropdown-container">
          <button
            class="language-dropdown-btn"
            onclick={() => showLanguageDropdown = !showLanguageDropdown}
            aria-haspopup="listbox"
            aria-expanded={showLanguageDropdown}
          >
            <span>{getLanguageName(currentLanguage)}</span>
            <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          {#if showLanguageDropdown}
            <ul class="language-dropdown" role="listbox">
              {#each LANGUAGES as lang}
                <li role="option" aria-selected={currentLanguage === lang.code}>
                  <button
                    class="language-option {currentLanguage === lang.code ? 'selected' : ''}"
                    onclick={() => handleLanguageSelect(lang.code)}
                  >
                    {lang.name}
                    {#if currentLanguage === lang.code}
                      <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
.ocr-results {
  width: 100%;
}

/* Loading State */
.results-loading {
  padding: 1.5rem;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 1rem;
}

.loading-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.loading-spinner {
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.spinner-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 3px solid transparent;
  border-top-color: var(--cosmic-gold, #fbbf24);
  border-radius: 50%;
  animation: spin 1.5s linear infinite;
}

.spinner-ring:nth-child(2) {
  border-top-color: #10b981;
  animation-delay: 0.15s;
}

.spinner-ring:nth-child(3) {
  border-top-color: var(--cosmic-purple, #8b5cf6);
  animation-delay: 0.3s;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.loading-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.05em;
}

.loading-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.loading-progress {
  margin-top: 1rem;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--cosmic-gold, #fbbf24), #10b981);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Processing State */
.results-processing {
  padding: 1.5rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 1rem;
}

.processing-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.processing-spinner {
  width: 24px;
  height: 24px;
  color: #10b981;
}

.spinner-icon {
  width: 100%;
  height: 100%;
  animation: spin 1s linear infinite;
}

.processing-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
}

/* Error State */
.results-error {
  padding: 1.5rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 1rem;
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

.error-info {
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

.error-message {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: rgba(252, 165, 165, 0.8);
  line-height: 1.5;
}

/* Results Container */
.results-container {
  background: rgba(10, 14, 39, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 1rem;
  overflow: hidden;
}

.results-header {
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(139, 92, 246, 0.1));
  border-bottom: 1px solid rgba(16, 185, 129, 0.2);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  width: 24px;
  height: 24px;
  color: #10b981;
}

.header-icon svg {
  width: 100%;
  height: 100%;
  stroke-width: 2;
}

.results-title {
  flex: 1;
  font-family: 'Orbitron', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, white, #10b981);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.processing-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
}

.processing-badge.fast {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.processing-badge.medium {
  background: rgba(251, 191, 36, 0.2);
  color: #fde047;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.processing-badge.slow {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.results-body {
  padding: 1.5rem;
}

/* Text Section */
.text-section {
  margin-bottom: 1.5rem;
}

.text-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.section-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 0.5rem;
  color: #10b981;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-btn:hover {
  background: rgba(16, 185, 129, 0.25);
  border-color: rgba(16, 185, 129, 0.5);
}

.copy-btn.success {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.4);
  color: #86efac;
}

.copy-btn.error {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}

.copy-btn svg {
  width: 14px;
  height: 14px;
  stroke-width: 2;
}

.text-content {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  padding: 1rem;
  max-height: 200px;
  overflow-y: auto;
}

/* Custom scrollbar */
.text-content::-webkit-scrollbar {
  width: 8px;
}

.text-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.text-content::-webkit-scrollbar-thumb {
  background: rgba(16, 185, 129, 0.3);
  border-radius: 4px;
}

.text-content::-webkit-scrollbar-thumb:hover {
  background: rgba(16, 185, 129, 0.5);
}

.extracted-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

/* No Text Found */
.no-text-found {
  padding: 2rem;
  text-align: center;
}

.no-text-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  color: rgba(255, 255, 255, 0.3);
}

.no-text-icon svg {
  width: 100%;
  height: 100%;
  stroke-width: 1.5;
}

.no-text-message {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0.5rem;
}

.no-text-hint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

/* Stats Section */
.stats-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.stat-item {
  flex: 1;
  min-width: 100px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 0.5rem;
}

.stat-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.stat-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1rem;
  font-weight: 700;
  color: #10b981;
}

.stat-value.high {
  color: #86efac;
}

.stat-value.medium {
  color: #fde047;
}

.stat-value.low {
  color: #fca5a5;
}

/* Meta Info */
.results-meta {
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.meta-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.meta-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.8);
}

/* Idle State */
.results-idle {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
}

.idle-icon {
  width: 48px;
  height: 48px;
  color: rgba(255, 255, 255, 0.3);
}

.idle-icon svg {
  width: 100%;
  height: 100%;
}

.idle-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

/* Language Selector */
.language-selector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.language-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.05em;
}

.language-dropdown-container {
  position: relative;
}

.language-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 0.5rem;
  color: #10b981;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.language-dropdown-btn:hover {
  background: rgba(16, 185, 129, 0.25);
  border-color: rgba(16, 185, 129, 0.5);
}

.dropdown-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2;
  transition: transform 0.2s ease;
}

.language-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  min-width: 160px;
  max-height: 200px;
  overflow-y: auto;
  background: rgba(10, 14, 39, 0.98);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 0.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 50;
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0.25rem;
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

.language-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.15s ease;
}

.language-option:hover {
  background: rgba(16, 185, 129, 0.15);
  color: white;
}

.language-option.selected {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.check-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2;
}

/* Responsive */
@media (max-width: 480px) {
  .stats-section {
    flex-direction: column;
  }
  
  .results-meta {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
