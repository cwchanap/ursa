import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryMonitor } from './memoryMonitor';

// Helper to set up a mock performance.memory API
function mockPerformanceMemory(
  usedJSHeapSize = 50 * 1024 * 1024,
  totalJSHeapSize = 100 * 1024 * 1024,
  jsHeapSizeLimit = 2048 * 1024 * 1024
) {
  Object.defineProperty(performance, 'memory', {
    value: { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit },
    configurable: true,
    writable: true,
  });
}

function removePerformanceMemory() {
  Object.defineProperty(performance, 'memory', {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

describe('MemoryMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPerformanceMemory();
  });

  afterEach(() => {
    vi.useRealTimers();
    removePerformanceMemory();
  });

  describe('constructor and support detection', () => {
    it('detects memory API support when available', () => {
      const monitor = new MemoryMonitor({ logWarnings: false });
      expect(monitor.isSupportedBrowser()).toBe(true);
    });

    it('reports unsupported when performance.memory is absent', () => {
      removePerformanceMemory();
      const monitor = new MemoryMonitor({ logWarnings: false });
      expect(monitor.isSupportedBrowser()).toBe(false);
    });

    it('uses default options when none provided', () => {
      const monitor = new MemoryMonitor();
      expect(monitor.isSupportedBrowser()).toBe(true);
    });
  });

  describe('start / stop', () => {
    it('starts monitoring and sets isMonitoring to true', () => {
      const monitor = new MemoryMonitor({ logWarnings: false });
      monitor.start();
      expect(monitor.isMonitoring()).toBe(true);
      monitor.stop();
    });

    it('stops monitoring and sets isMonitoring to false', () => {
      const monitor = new MemoryMonitor({ logWarnings: false });
      monitor.start();
      monitor.stop();
      expect(monitor.isMonitoring()).toBe(false);
    });

    it('does nothing when start called on unsupported browser', () => {
      removePerformanceMemory();
      const monitor = new MemoryMonitor({ logWarnings: false });
      monitor.start();
      expect(monitor.isMonitoring()).toBe(false);
    });

    it('does not start twice when called again while running', () => {
      const monitor = new MemoryMonitor({ logWarnings: false, checkInterval: 1000 });
      monitor.start();
      monitor.start(); // second call should be a no-op
      expect(monitor.isMonitoring()).toBe(true);
      monitor.stop();
    });
  });

  describe('getStats', () => {
    it('returns current snapshot when memory API available', () => {
      mockPerformanceMemory(50 * 1024 * 1024, 100 * 1024 * 1024, 2048 * 1024 * 1024);
      const monitor = new MemoryMonitor({ logWarnings: false });
      const { current } = monitor.getStats();
      expect(current).not.toBeNull();
      expect(current!.usedHeapMB).toBeCloseTo(50, 1);
      expect(current!.totalHeapMB).toBeCloseTo(100, 1);
      expect(current!.heapLimitMB).toBeCloseTo(2048, 0);
    });

    it('returns null snapshot when memory API not available', () => {
      removePerformanceMemory();
      const monitor = new MemoryMonitor({ logWarnings: false });
      const { current } = monitor.getStats();
      expect(current).toBeNull();
    });

    it('returns null growth rate before sufficient data', () => {
      const monitor = new MemoryMonitor({ logWarnings: false });
      monitor.start();
      const { growthRate } = monitor.getStats();
      // Only one snapshot (initial), not enough for growth rate
      expect(growthRate).toBeNull();
      monitor.stop();
    });
  });

  describe('warning callbacks', () => {
    it('calls onWarning when growth rate exceeds threshold', () => {
      const onWarning = vi.fn();
      // Use 60s interval so two snapshots are far enough apart for growth calc
      const monitor = new MemoryMonitor({
        logWarnings: false,
        checkInterval: 60000,
        growthThresholdMB: 5,
        onWarning,
      });

      // Start monitoring - takes initial snapshot at 50MB (T=0)
      monitor.start();

      // Simulate high memory usage - jump to 200MB
      mockPerformanceMemory(200 * 1024 * 1024);

      // Advance past one interval (60s): checkMemory fires at T=60000
      // Growth rate = (200-50)MB / 1.0min = 150 MB/min > threshold of 5
      vi.advanceTimersByTime(61000);

      expect(onWarning).toHaveBeenCalled();
      monitor.stop();
    });

    it('does not call onWarning when growth is below threshold', () => {
      const onWarning = vi.fn();
      // Use 60s interval so growthRate is computed over a ≥30s window,
      // ensuring the threshold logic is actually exercised (not bypassed by null growthRate)
      const monitor = new MemoryMonitor({
        logWarnings: false,
        checkInterval: 60000,
        growthThresholdMB: 100, // very high threshold
        onWarning,
      });

      monitor.start();

      // Small memory increase (~5MB/min growth rate, well below 100MB/min threshold)
      mockPerformanceMemory(55 * 1024 * 1024);

      // Advance past one interval (60s): growth ~= 5MB/min < 100MB/min threshold
      vi.advanceTimersByTime(61000);

      expect(onWarning).not.toHaveBeenCalled();
      monitor.stop();
    });
  });
});

describe('singleton functions', () => {
  // Dynamic import reference, reset between tests so each test gets a fresh module instance
  let memoryModule: typeof import('./memoryMonitor');

  beforeEach(async () => {
    vi.useFakeTimers();
    mockPerformanceMemory();
    // Reset the module registry so the singleton is cleared for each test
    vi.resetModules();
    memoryModule = await import('./memoryMonitor');
    memoryModule.stopMemoryMonitoring();
  });

  afterEach(() => {
    memoryModule?.stopMemoryMonitoring();
    vi.useRealTimers();
    removePerformanceMemory();
  });

  it('getMemoryMonitor returns a MemoryMonitor instance', () => {
    const monitor = memoryModule.getMemoryMonitor({ logWarnings: false });
    expect(monitor).toBeInstanceOf(memoryModule.MemoryMonitor);
  });

  it('getMemoryMonitor returns the same instance on repeated calls', () => {
    const m1 = memoryModule.getMemoryMonitor({ logWarnings: false });
    const m2 = memoryModule.getMemoryMonitor({ logWarnings: false });
    expect(m1).toBe(m2);
  });

  it('startMemoryMonitoring starts the global monitor', () => {
    memoryModule.startMemoryMonitoring({ logWarnings: false });
    const monitor = memoryModule.getMemoryMonitor();
    expect(monitor.isMonitoring()).toBe(true);
  });

  it('stopMemoryMonitoring stops the global monitor', () => {
    memoryModule.startMemoryMonitoring({ logWarnings: false });
    memoryModule.stopMemoryMonitoring();
    const monitor = memoryModule.getMemoryMonitor();
    expect(monitor.isMonitoring()).toBe(false);
  });
});
