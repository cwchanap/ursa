<script lang="ts">
  /**
   * Performance Monitor Component
   *
   * Displays inference times for ML analysis with color-coded indicators.
   * Only visible in development mode.
   *
   * @module components/PerformanceMonitor
   */

  import type { ClassificationAnalysis, OCRAnalysis, DetectionResult } from '../lib/types/analysis';

  // Props
  interface Props {
    classificationResult?: ClassificationAnalysis | null;
    ocrResult?: OCRAnalysis | null;
    detectionResult?: DetectionResult | null;
    isVisible?: boolean;
  }

  let {
    classificationResult = null,
    ocrResult = null,
    detectionResult = null,
    isVisible = true,
  }: Props = $props();

  // Dev mode detection
  const isDev = import.meta.env.DEV;

  // Performance thresholds (ms)
  const THRESHOLDS = {
    FAST: 60,
    MEDIUM: 100,
  };

  /**
   * Get CSS class for timing indicator based on thresholds
   */
  function getTimingClass(timeMs: number): string {
    if (timeMs < THRESHOLDS.FAST) return 'timing-fast';
    if (timeMs < THRESHOLDS.MEDIUM) return 'timing-medium';
    return 'timing-slow';
  }

  /**
   * Format time display
   */
  function formatTime(timeMs: number): string {
    return timeMs < 1000 ? `${Math.round(timeMs)}ms` : `${(timeMs / 1000).toFixed(2)}s`;
  }

  // Derived state for performance entries
  let performanceEntries = $derived.by(() => {
    const entries: Array<{ label: string; time: number; class: string }> = [];

    if (detectionResult?.inferenceTime !== undefined) {
      entries.push({
        label: 'Detection',
        time: detectionResult.inferenceTime,
        class: getTimingClass(detectionResult.inferenceTime),
      });
    }

    if (classificationResult?.inferenceTime !== undefined) {
      entries.push({
        label: 'Classification',
        time: classificationResult.inferenceTime,
        class: getTimingClass(classificationResult.inferenceTime),
      });
    }

    if (ocrResult?.processingTime !== undefined) {
      entries.push({
        label: 'OCR',
        time: ocrResult.processingTime,
        class: getTimingClass(ocrResult.processingTime),
      });
    }

    return entries;
  });

  let hasEntries = $derived(performanceEntries.length > 0);
</script>

{#if isDev && isVisible && hasEntries}
  <div class="performance-monitor" role="region" aria-label="Performance metrics">
    <div class="monitor-header">
      <span class="monitor-title">⚡ Performance</span>
      <span class="monitor-legend">
        <span class="legend-item timing-fast">{'<'}60ms</span>
        <span class="legend-item timing-medium">60-100ms</span>
        <span class="legend-item timing-slow">{'>'}100ms</span>
      </span>
    </div>
    <div class="monitor-entries">
      {#each performanceEntries as entry}
        <div class="entry-row">
          <span class="entry-label">{entry.label}</span>
          <span class="entry-time {entry.class}">{formatTime(entry.time)}</span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .performance-monitor {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 8px;
    padding: 12px 16px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 12px;
    color: #e2e8f0;
    z-index: 1000;
    min-width: 180px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  }

  .monitor-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  }

  .monitor-title {
    font-weight: 600;
    color: #f8fafc;
  }

  .monitor-legend {
    display: flex;
    gap: 8px;
    font-size: 10px;
  }

  .legend-item {
    padding: 2px 6px;
    border-radius: 4px;
    opacity: 0.8;
  }

  .monitor-entries {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .entry-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .entry-label {
    color: #94a3b8;
  }

  .entry-time {
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    min-width: 60px;
    text-align: right;
  }

  /* Color-coded timing indicators */
  .timing-fast {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .timing-medium {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  .timing-slow {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  @media (max-width: 640px) {
    .performance-monitor {
      bottom: 10px;
      right: 10px;
      left: 10px;
      min-width: auto;
    }
  }
</style>
