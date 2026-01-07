<script lang="ts">
  import { videoFPS, updateVideoFPS } from '../lib/stores/settingsStore';
  import { SETTINGS_CONSTRAINTS } from '../lib/types/settings';

  // Props
  interface Props {
    disabled?: boolean;
    className?: string;
  }

  let {
    disabled = false,
    className = '',
  }: Props = $props();

  // Local state synced with store
  let fpsValue = $state($videoFPS);

  // Sync local state when store changes
  $effect(() => {
    fpsValue = $videoFPS;
  });

  // Handle slider change
  function handleChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newValue = parseInt(target.value, 10);
    fpsValue = newValue;
    updateVideoFPS(newValue);
  }

  // Get FPS quality label
  function getFPSLabel(fps: number): string {
    const { low, medium, high } = SETTINGS_CONSTRAINTS.videoFPS.qualityThresholds;
    if (fps <= low) return 'Battery Saver';
    if (fps <= medium) return 'Balanced';
    if (fps <= high) return 'Smooth';
    return 'High Performance';
  }

  // Get FPS color class
  function getFPSColor(fps: number): string {
    const { low, medium, high } = SETTINGS_CONSTRAINTS.videoFPS.qualityThresholds;
    if (fps <= low) return 'low';
    if (fps <= medium) return 'medium';
    if (fps <= high) return 'high';
    return 'ultra';
  }
</script>

<div class="fps-slider {className}">
  <div class="slider-header">
    <label class="slider-label" for="fps-slider">
      <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polygon points="5 3 19 12 5 21 5 3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="label-text">Video FPS</span>
    </label>
    <div class="slider-value {getFPSColor(fpsValue)}">
      <span class="value-number">{fpsValue}</span>
      <span class="value-unit">fps</span>
    </div>
  </div>

  <div class="slider-container">
    <input
      type="range"
      id="fps-slider"
      min={SETTINGS_CONSTRAINTS.videoFPS.min}
      max={SETTINGS_CONSTRAINTS.videoFPS.max}
      value={fpsValue}
      oninput={handleChange}
      class="fps-range {getFPSColor(fpsValue)}"
      {disabled}
      aria-label="Video frames per second"
      aria-valuemin={SETTINGS_CONSTRAINTS.videoFPS.min}
      aria-valuemax={SETTINGS_CONSTRAINTS.videoFPS.max}
      aria-valuenow={fpsValue}
    />
    <div class="slider-markers">
      <span>{SETTINGS_CONSTRAINTS.videoFPS.min}</span>
      <span>{Math.floor((SETTINGS_CONSTRAINTS.videoFPS.min + SETTINGS_CONSTRAINTS.videoFPS.max) / 2)}</span>
      <span>{SETTINGS_CONSTRAINTS.videoFPS.max}</span>
    </div>
  </div>

  <div class="fps-quality-label {getFPSColor(fpsValue)}">
    {getFPSLabel(fpsValue)}
  </div>
</div>

<style>
.fps-slider {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slider-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.label-icon {
  width: 16px;
  height: 16px;
  color: var(--cosmic-cyan, #06b6d4);
  stroke-width: 2;
}

.slider-value {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  transition: all 0.2s ease;
}

.slider-value.low {
  background: rgba(34, 197, 94, 0.15);
  color: #86efac;
}

.slider-value.medium {
  background: rgba(6, 182, 212, 0.15);
  color: #67e8f9;
}

.slider-value.high {
  background: rgba(139, 92, 246, 0.15);
  color: #c4b5fd;
}

.slider-value.ultra {
  background: rgba(236, 72, 153, 0.15);
  color: #f9a8d4;
}

.value-number {
  font-size: 1rem;
  font-weight: 700;
}

.value-unit {
  font-size: 0.7rem;
  opacity: 0.7;
}

.slider-container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.fps-range {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.fps-range:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Webkit (Chrome, Safari, Edge) */
.fps-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  border: 2px solid currentColor;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease;
}

.fps-range::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.fps-range.low::-webkit-slider-thumb {
  border-color: #22c55e;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
}

.fps-range.medium::-webkit-slider-thumb {
  border-color: #06b6d4;
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
}

.fps-range.high::-webkit-slider-thumb {
  border-color: #8b5cf6;
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
}

.fps-range.ultra::-webkit-slider-thumb {
  border-color: #ec4899;
  box-shadow: 0 0 10px rgba(236, 72, 153, 0.5);
}

/* Firefox */
.fps-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  border: 2px solid currentColor;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.fps-range.low::-moz-range-thumb {
  border-color: #22c55e;
}

.fps-range.medium::-moz-range-thumb {
  border-color: #06b6d4;
}

.fps-range.high::-moz-range-thumb {
  border-color: #8b5cf6;
}

.fps-range.ultra::-moz-range-thumb {
  border-color: #ec4899;
}

.slider-markers {
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.4);
}

.fps-quality-label {
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
}

.fps-quality-label.low {
  background: rgba(34, 197, 94, 0.1);
  color: #86efac;
}

.fps-quality-label.medium {
  background: rgba(6, 182, 212, 0.1);
  color: #67e8f9;
}

.fps-quality-label.high {
  background: rgba(139, 92, 246, 0.1);
  color: #c4b5fd;
}

.fps-quality-label.ultra {
  background: rgba(236, 72, 153, 0.1);
  color: #f9a8d4;
}
</style>
