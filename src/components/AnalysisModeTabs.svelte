<script lang="ts">
  import type { AnalysisMode, ProcessingState } from '../lib/types/analysis';

  // Props
  export let activeMode: AnalysisMode = 'detection';
  export let onModeChange: ((mode: AnalysisMode) => void) | undefined = undefined;
  export let className: string = "";
  
  // Optional: Show completion indicators
  export let hasDetectionResults: boolean = false;
  export let hasClassificationResults: boolean = false;
  export let hasOCRResults: boolean = false;

  // Container element for scoped queries
  let container: HTMLDivElement;

  // Tab definitions
  const tabs: Array<{
    mode: AnalysisMode;
    label: string;
    icon: string;
    color: string;
  }> = [
    {
      mode: 'detection',
      label: 'Detection',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      color: '#ef4444',
    },
    {
      mode: 'classification',
      label: 'Classify',
      icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
      color: '#06b6d4',
    },
    {
      mode: 'ocr',
      label: 'OCR',
      icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
      color: '#10b981',
    },
  ];

  function handleTabClick(mode: AnalysisMode): void {
    if (mode !== activeMode) {
      onModeChange?.(mode);
    }
  }

  function handleKeyDown(event: KeyboardEvent, currentIndex: number): void {
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        event.preventDefault();
        break;
      case 'ArrowRight':
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        event.preventDefault();
        break;
      case 'Home':
        newIndex = 0;
        event.preventDefault();
        break;
      case 'End':
        newIndex = tabs.length - 1;
        event.preventDefault();
        break;
      default:
        return;
    }

    const newMode = tabs[newIndex].mode;
    handleTabClick(newMode);

    // Focus the new tab button
    const tabButtons = container.querySelectorAll('[role="tab"]');
    (tabButtons[newIndex] as HTMLElement)?.focus();
  }

  function hasResults(mode: AnalysisMode): boolean {
    switch (mode) {
      case 'detection':
        return hasDetectionResults;
      case 'classification':
        return hasClassificationResults;
      case 'ocr':
        return hasOCRResults;
      default:
        return false;
    }
  }

  function getActiveIndex(): number {
    const index = tabs.findIndex(t => t.mode === activeMode);
    // Return 0 as safe default if activeMode isn't found to prevent undefined access
    return index >= 0 ? index : 0;
  }
</script>

<div bind:this={container} class="analysis-mode-tabs {className}">
  <div 
    class="tabs-container" 
    role="tablist" 
    aria-label="Analysis modes"
  >
    <!-- Animated slider background -->
    <div 
      class="tab-slider"
      style="transform: translateX({getActiveIndex() * 100}%); --tab-color: {tabs[getActiveIndex()].color}"
    ></div>

    {#each tabs as tab, index}
      <button
        role="tab"
        aria-selected={activeMode === tab.mode}
        aria-controls="tabpanel-{tab.mode}"
        tabindex={activeMode === tab.mode ? 0 : -1}
        onclick={() => handleTabClick(tab.mode)}
        onkeydown={(e) => handleKeyDown(e, index)}
        class="tab-button {activeMode === tab.mode ? 'active' : ''}"
        style="--tab-color: {tab.color}"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d={tab.icon} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="tab-label">{tab.label}</span>
        {#if hasResults(tab.mode)}
          <span class="results-indicator" aria-label="Has results">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="5"/>
            </svg>
          </span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
.analysis-mode-tabs {
  width: 100%;
  margin-bottom: 1.5rem;
}

.tabs-container {
  position: relative;
  display: flex;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 1rem;
  padding: 0.375rem;
  gap: 0.25rem;
}

.tab-slider {
  position: absolute;
  top: 0.375rem;
  left: 0.375rem;
  width: calc(33.333% - 0.25rem);
  height: calc(100% - 0.75rem);
  background: linear-gradient(135deg, var(--tab-color), rgba(139, 92, 246, 0.8));
  border-radius: 0.75rem;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
}

.tab-button {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 0.75rem;
}

.tab-button:hover:not(.active) {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.05);
}

.tab-button:focus-visible {
  outline: 2px solid var(--tab-color, #8b5cf6);
  outline-offset: 2px;
}

.tab-button.active {
  color: white;
}

.tab-icon {
  width: 18px;
  height: 18px;
  stroke-width: 2;
  flex-shrink: 0;
}

.tab-label {
  white-space: nowrap;
}

.results-indicator {
  width: 8px;
  height: 8px;
  color: var(--tab-color, #8b5cf6);
  animation: pulse-indicator 2s ease-in-out infinite;
}

.results-indicator svg {
  width: 100%;
  height: 100%;
}

.tab-button.active .results-indicator {
  color: white;
}

@keyframes pulse-indicator {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.2);
  }
}

/* Responsive Design */
@media (max-width: 640px) {
  .tab-button {
    padding: 0.75rem 0.5rem;
    font-size: 0.7rem;
    gap: 0.375rem;
  }

  .tab-icon {
    width: 16px;
    height: 16px;
  }

  .tab-label {
    display: none;
  }

  .tabs-container {
    padding: 0.25rem;
  }

  .tab-slider {
    top: 0.25rem;
    left: 0.25rem;
    height: calc(100% - 0.5rem);
  }
}

@media (min-width: 641px) and (max-width: 768px) {
  .tab-label {
    font-size: 0.7rem;
  }
}
</style>
