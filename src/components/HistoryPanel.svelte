<script lang="ts">
  import type { HistoryEntry } from '../lib/types/history';
  import { isDetectionResult, isClassificationResult, isOCRResult } from '../lib/types/history';
  import {
    historyEntries,
    hasHistory,
    historyCount,
    selectedEntry,
    selectEntry,
    clearSelection,
    deleteHistoryEntry,
    clearAllHistory,
  } from '../lib/stores/historyStore';

  // Props
  interface Props {
    onRestoreEntry?: ((entry: HistoryEntry) => void) | undefined;
    className?: string;
  }

  let {
    onRestoreEntry = undefined,
    className = '',
  }: Props = $props();

  // UI State
  let isPanelOpen = $state(false);
  let confirmClearOpen = $state(false);

  // Toggle panel
  function togglePanel(): void {
    isPanelOpen = !isPanelOpen;
    if (!isPanelOpen) {
      confirmClearOpen = false;
    }
  }

  // Close panel
  function closePanel(): void {
    isPanelOpen = false;
    confirmClearOpen = false;
  }

  // Handle entry click
  function handleEntryClick(entry: HistoryEntry): void {
    selectEntry(entry.id);
    onRestoreEntry?.(entry);
    closePanel();
  }

  // Handle delete entry
  function handleDeleteEntry(event: MouseEvent, id: string): void {
    event.stopPropagation();
    deleteHistoryEntry(id);
  }

  // Handle clear all
  function handleClearAll(): void {
    clearAllHistory();
    confirmClearOpen = false;
  }

  // Get mode label
  function getModeLabel(entry: HistoryEntry): string {
    switch (entry.analysisType) {
      case 'detection':
        return 'Detection';
      case 'classification':
        return 'Classification';
      case 'ocr':
        return 'OCR';
      default:
        return 'Analysis';
    }
  }

  // Get mode color
  function getModeColor(entry: HistoryEntry): string {
    switch (entry.analysisType) {
      case 'detection':
        return 'detection';
      case 'classification':
        return 'classification';
      case 'ocr':
        return 'ocr';
      default:
        return '';
    }
  }

  // Get result summary
  function getResultSummary(entry: HistoryEntry): string {
    if (isDetectionResult(entry.results)) {
      const count = entry.results.objects.length;
      return `${count} object${count !== 1 ? 's' : ''} detected`;
    }
    if (isClassificationResult(entry.results)) {
      const top = entry.results.predictions[0];
      if (top) {
        return `${top.label} (${(top.confidence * 100).toFixed(0)}%)`;
      }
      return 'No predictions';
    }
    if (isOCRResult(entry.results)) {
      const wordCount = entry.results.textRegions.length;
      return `${wordCount} word${wordCount !== 1 ? 's' : ''} found`;
    }
    return '';
  }

  // Format timestamp
  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  // Handle escape key
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && isPanelOpen) {
      closePanel();
    }
  }

  // Add keydown listener
  $effect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeydown);
      return () => {
        window.removeEventListener('keydown', handleKeydown);
      };
    }
  });
</script>

<!-- Toggle Button (Bottom Left) -->
<button
  data-testid="history-toggle"
  class="history-toggle {$hasHistory ? 'has-items' : ''}"
  onclick={togglePanel}
  aria-label="Toggle history panel"
  aria-expanded={isPanelOpen}
>
  <div class="toggle-icon {isPanelOpen ? 'open' : ''}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" stroke-width="2"/>
      <polyline points="12 6 12 12 16 14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  {#if $historyCount > 0}
    <span class="toggle-badge">{$historyCount}</span>
  {/if}
</button>

<!-- Backdrop -->
{#if isPanelOpen}
  <button
    class="history-backdrop"
    onclick={closePanel}
    aria-label="Close history panel"
  ></button>
{/if}

<!-- Panel -->
<div class="history-panel {className} {isPanelOpen ? 'open' : ''}" data-testid="history-panel" data-history-count={$historyCount}>
  <!-- Header -->
  <div class="panel-header">
    <div class="header-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" stroke-width="2"/>
        <polyline points="12 6 12 12 16 14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h2>History</h2>
      <span class="entry-count">{$historyCount}/10</span>
    </div>
    <button data-testid="close-button" class="close-button" onclick={closePanel} aria-label="Close panel">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>

  <!-- Content -->
  <div class="panel-content">
    {#if $hasHistory}
      <!-- Entry List -->
      <div class="entry-list" data-testid="history-entry-list">
        {#each $historyEntries as entry (entry.id)}
          <div
            data-testid="entry-item"
            class="entry-item {$selectedEntry?.id === entry.id ? 'selected' : ''}"
            onclick={() => handleEntryClick(entry)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEntryClick(entry); } }}
            role="button"
            tabindex="0"
          >
            <div class="entry-thumbnail">
              <img src={entry.imageDataURL} alt="Analysis thumbnail" />
              <span class="mode-badge {getModeColor(entry)}">{getModeLabel(entry)}</span>
            </div>
            <div class="entry-info">
              <span data-testid="entry-summary" class="entry-summary">{getResultSummary(entry)}</span>
              <span class="entry-time">{formatTimestamp(entry.timestamp)}</span>
              <span class="entry-dimensions">{entry.imageDimensions.width}×{entry.imageDimensions.height}</span>
            </div>
            <button
              data-testid="entry-delete"
              class="entry-delete"
              onclick={(e) => handleDeleteEntry(e, entry.id)}
              aria-label="Delete entry"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        {/each}
      </div>

      <!-- Clear All -->
      <div class="panel-footer">
        {#if confirmClearOpen}
          <div data-testid="confirm-clear" class="confirm-clear">
            <span>Clear all history?</span>
            <div class="confirm-buttons">
              <button data-testid="confirm-yes" class="confirm-yes" onclick={handleClearAll}>Yes, clear</button>
              <button data-testid="confirm-no" class="confirm-no" onclick={() => confirmClearOpen = false}>Cancel</button>
            </div>
          </div>
        {:else}
          <button data-testid="clear-all-button" class="clear-all-button" onclick={() => confirmClearOpen = true}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Clear All History</span>
          </button>
        {/if}
      </div>
    {:else}
      <!-- Empty State -->
      <div class="empty-state" data-testid="history-empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="1.5"/>
            <polyline points="12 6 12 12 16 14" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p data-testid="empty-title" class="empty-title">No History Yet</p>
        <p class="empty-text">Your analysis results will appear here automatically.</p>
      </div>
    {/if}
  </div>
</div>

<style>
/* Toggle Button */
.history-toggle {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 48px;
  height: 48px;
  background: rgba(10, 14, 39, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.history-toggle:hover {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.5);
  color: white;
  transform: scale(1.05);
}

.history-toggle.has-items {
  border-color: rgba(139, 92, 246, 0.5);
}

.toggle-icon {
  width: 24px;
  height: 24px;
  transition: transform 0.3s ease;
}

.toggle-icon.open {
  transform: rotate(180deg);
}

.toggle-icon svg {
  width: 100%;
  height: 100%;
  stroke-width: 2;
}

.toggle-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: linear-gradient(135deg, var(--cosmic-purple, #8b5cf6), var(--cosmic-cyan, #06b6d4));
  border-radius: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  font-weight: 700;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Backdrop */
.history-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 997;
  border: none;
  cursor: pointer;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Panel */
.history-panel {
  position: fixed;
  top: 0;
  left: 0;
  width: 380px;
  max-width: 90vw;
  height: 100vh;
  background: rgba(10, 14, 39, 0.98);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(139, 92, 246, 0.3);
  z-index: 998;
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  visibility: hidden;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.4s;
  transition-delay: visibility 0.4s, transform 0s;
  box-shadow: 10px 0 40px rgba(0, 0, 0, 0.5);
}

.history-panel.open {
  transform: translateX(0);
  visibility: visible;
  transition-delay: visibility 0s, transform 0s;
}

/* Header */
.panel-header {
  padding: 1.5rem;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1));
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-title svg {
  width: 24px;
  height: 24px;
  color: var(--cosmic-purple, #8b5cf6);
  stroke-width: 2;
}

.header-title h2 {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, white, var(--cosmic-purple, #8b5cf6));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.entry-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.25rem;
}

.close-button {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.close-button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

/* Content */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

/* Entry List */
.entry-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.entry-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}

.entry-item:hover {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.3);
}

.entry-item.selected {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.4);
}

.entry-thumbnail {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 0.5rem;
  overflow: hidden;
  flex-shrink: 0;
}

.entry-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mode-badge {
  position: absolute;
  bottom: 2px;
  left: 2px;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
}

.mode-badge.detection {
  background: rgba(236, 72, 153, 0.8);
  color: white;
}

.mode-badge.classification {
  background: rgba(245, 158, 11, 0.8);
  color: white;
}

.mode-badge.ocr {
  background: rgba(16, 185, 129, 0.8);
  color: white;
}

.entry-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.entry-summary {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);
}

.entry-dimensions {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.4);
}

.entry-delete {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s ease;
  flex-shrink: 0;
  align-self: center;
}

.entry-item:hover .entry-delete {
  opacity: 1;
}

.entry-delete:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.entry-delete svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

/* Footer */
.panel-footer {
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.clear-all-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.5rem;
  color: #fca5a5;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-all-button:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.clear-all-button svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.confirm-clear {
  text-align: center;
}

.confirm-clear span {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 0.75rem;
}

.confirm-buttons {
  display: flex;
  gap: 0.5rem;
}

.confirm-yes,
.confirm-no {
  flex: 1;
  padding: 0.5rem;
  border-radius: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.confirm-yes {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}

.confirm-yes:hover {
  background: rgba(239, 68, 68, 0.3);
}

.confirm-no {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
}

.confirm-no:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 2rem;
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: rgba(255, 255, 255, 0.2);
  margin-bottom: 1rem;
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0.5rem;
}

.empty-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.5;
}

/* Custom Scrollbar */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.3);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.5);
}

/* Responsive */
@media (max-width: 480px) {
  .history-panel {
    width: 100%;
    max-width: 100%;
  }

  .history-toggle {
    bottom: 80px;
  }
}
</style>
