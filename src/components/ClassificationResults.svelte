<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ClassificationAnalysis, ProcessingState } from '../lib/types/analysis';

  // Props
  interface Props {
    analysis?: ClassificationAnalysis | null;
    processing?: ProcessingState;
    className?: string;
  }

  let {
    analysis = null,
    processing = { status: 'idle' },
    className = "",
  }: Props = $props();

  // UI State
  let showResults = $derived(analysis !== null && processing.status === 'complete');

  // Get color class based on confidence level
  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.4) return 'medium';
    return 'low';
  }

  // Get confidence bar width as percentage
  function getConfidenceWidth(confidence: number): string {
    return `${(confidence * 100).toFixed(1)}%`;
  }

  // Get inference time color class
  function getInferenceTimeColor(ms: number): string {
    if (ms < 60) return 'fast';
    if (ms < 100) return 'medium';
    return 'slow';
  }
</script>

<div class="classification-results {className}">
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
          <span class="loading-title">Loading Classification Model</span>
          <span class="loading-text">{processing.message || 'Initializing MobileNetV2...'}</span>
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
        <span class="processing-text">{processing.message || 'Classifying image...'}</span>
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
          <h4 class="error-title">Classification Error</h4>
          <p class="error-message">{processing.message || 'Unable to classify the image. Please try again.'}</p>
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
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke-width="2"/>
            <path d="M12 12l4-4m0 0l-4-4m4 4H3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(0, 6) scale(0.6)"/>
          </svg>
        </div>
        <h3 class="results-title">Classification Results</h3>
        <div class="inference-badge {getInferenceTimeColor(analysis.inferenceTime)}">
          <span class="inference-value">{analysis.inferenceTime.toFixed(0)}ms</span>
        </div>
      </div>

      <div class="results-body">
        <h4 class="predictions-title">Top 5 Predictions</h4>
        {#if analysis.predictions.length === 0}
          <div class="no-predictions">
            <div class="no-predictions-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="2"/>
                <path d="M8 15s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="no-predictions-text">No objects could be classified in this image</p>
            <p class="no-predictions-hint">Try with a clearer image or different content</p>
          </div>
        {:else}
        <ul class="predictions-list">
          {#each analysis.predictions as prediction, index}
            <li class="prediction-item">
              <div class="prediction-rank">#{index + 1}</div>
              <div class="prediction-content">
                <div class="prediction-header">
                  <span class="prediction-label">{prediction.label}</span>
                  <span class="prediction-confidence {getConfidenceColor(prediction.confidence)}">
                    {(prediction.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div class="confidence-bar-container">
                  <div 
                    class="confidence-bar {getConfidenceColor(prediction.confidence)}"
                    style="width: {getConfidenceWidth(prediction.confidence)}"
                  ></div>
                </div>
              </div>
            </li>
          {/each}
        </ul>
        {/if}

        <div class="results-meta">
          <div class="meta-item">
            <span class="meta-label">Image Size</span>
            <span class="meta-value">{analysis.imageDimensions.width} × {analysis.imageDimensions.height}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Analyzed At</span>
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
          <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="M21 15l-5-5L5 21" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <p class="idle-text">Upload an image and click "Classify" to see predictions</p>
    </div>
  {/if}
</div>

<style>
.classification-results {
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
  border-top-color: var(--cosmic-cyan, #06b6d4);
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
  background: linear-gradient(90deg, var(--cosmic-gold, #fbbf24), var(--cosmic-cyan, #06b6d4));
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Processing State */
.results-processing {
  padding: 1.5rem;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
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
  color: var(--cosmic-purple, #8b5cf6);
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
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 1rem;
  overflow: hidden;
}

.results-header {
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(139, 92, 246, 0.1));
  border-bottom: 1px solid rgba(6, 182, 212, 0.2);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  width: 24px;
  height: 24px;
  color: var(--cosmic-cyan, #06b6d4);
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
  background: linear-gradient(135deg, white, var(--cosmic-cyan, #06b6d4));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.inference-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
}

.inference-badge.fast {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.inference-badge.medium {
  background: rgba(251, 191, 36, 0.2);
  color: #fde047;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.inference-badge.slow {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.results-body {
  padding: 1.5rem;
}

.predictions-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.predictions-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.prediction-item {
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  transition: all 0.2s ease;
}

.prediction-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(6, 182, 212, 0.3);
}

.prediction-rank {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--cosmic-purple, #8b5cf6);
}

.prediction-content {
  flex: 1;
  min-width: 0;
}

.prediction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.prediction-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.prediction-confidence {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.prediction-confidence.high {
  color: #86efac;
}

.prediction-confidence.medium {
  color: #fde047;
}

.prediction-confidence.low {
  color: #fca5a5;
}

.confidence-bar-container {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.confidence-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease-out;
}

.confidence-bar.high {
  background: linear-gradient(90deg, #22c55e, #86efac);
}

.confidence-bar.medium {
  background: linear-gradient(90deg, #f59e0b, #fde047);
}

.confidence-bar.low {
  background: linear-gradient(90deg, #ef4444, #fca5a5);
}

.results-meta {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 2rem;
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
  stroke-width: 1.5;
}

.idle-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

/* No Predictions State */
.no-predictions {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  background: rgba(251, 191, 36, 0.05);
  border: 1px dashed rgba(251, 191, 36, 0.3);
  border-radius: 0.75rem;
}

.no-predictions-icon {
  width: 40px;
  height: 40px;
  color: rgba(251, 191, 36, 0.6);
}

.no-predictions-icon svg {
  width: 100%;
  height: 100%;
  stroke-width: 1.5;
}

.no-predictions-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
}

.no-predictions-hint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
}

/* Responsive */
@media (max-width: 480px) {
  .results-meta {
    flex-direction: column;
    gap: 1rem;
  }

  .prediction-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
