/**
 * Memory Monitor Utility
 *
 * Monitors memory usage and logs warnings if growth exceeds thresholds.
 * Uses performance.memory API (Chrome-only) with graceful degradation.
 *
 * @module lib/utils/memoryMonitor
 */

// Type declaration for Chrome's non-standard memory API
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

export interface MemorySnapshot {
  timestamp: number;
  usedHeapMB: number;
  totalHeapMB: number;
  heapLimitMB: number;
}

export interface MemoryMonitorOptions {
  /** Interval in ms to check memory (default: 60000 = 1 minute) */
  checkInterval?: number;
  /** Memory growth threshold in MB/minute to trigger warning (default: 5) */
  growthThresholdMB?: number;
  /** Enable console logging (default: true in dev mode) */
  logWarnings?: boolean;
  /** Callback when memory warning is triggered */
  onWarning?: (message: string, snapshot: MemorySnapshot) => void;
}

export class MemoryMonitor {
  private options: Required<MemoryMonitorOptions>;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private snapshots: MemorySnapshot[] = [];
  private isSupported: boolean = false;
  private isRunning: boolean = false;

  constructor(options: MemoryMonitorOptions = {}) {
    this.options = {
      checkInterval: options.checkInterval ?? 60000, // 1 minute
      growthThresholdMB: options.growthThresholdMB ?? 5,
      logWarnings: options.logWarnings ?? (typeof import.meta.env !== 'undefined' && import.meta.env.DEV),
      onWarning: options.onWarning ?? (() => {}),
    };

    this.checkSupport();
  }

  /**
   * Check if performance.memory API is available
   */
  private checkSupport(): void {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
      this.isSupported = false;
      return;
    }

    const extPerf = performance as ExtendedPerformance;
    this.isSupported = extPerf.memory !== undefined;

    if (!this.isSupported && this.options.logWarnings) {
      console.info(
        '[MemoryMonitor] performance.memory API not available. Memory monitoring disabled. This API is only available in Chromium-based browsers.'
      );
    }
  }

  /**
   * Take a memory snapshot
   */
  private takeSnapshot(): MemorySnapshot | null {
    if (!this.isSupported) return null;

    const extPerf = performance as ExtendedPerformance;
    const memory = extPerf.memory;

    if (!memory) return null;

    const bytesToMB = (bytes: number): number => bytes / (1024 * 1024);

    return {
      timestamp: Date.now(),
      usedHeapMB: bytesToMB(memory.usedJSHeapSize),
      totalHeapMB: bytesToMB(memory.totalJSHeapSize),
      heapLimitMB: bytesToMB(memory.jsHeapSizeLimit),
    };
  }

  /**
   * Calculate memory growth rate in MB/minute
   */
  private calculateGrowthRate(): number | null {
    if (this.snapshots.length < 2) return null;

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    const timeDiffMinutes = (last.timestamp - first.timestamp) / 60000;

    if (timeDiffMinutes < 0.5) return null; // Need at least 30 seconds of data

    return (last.usedHeapMB - first.usedHeapMB) / timeDiffMinutes;
  }

  /**
   * Check memory and log warnings if threshold exceeded
   */
  private checkMemory(): void {
    const snapshot = this.takeSnapshot();
    if (!snapshot) return;

    // Keep last 10 snapshots for growth calculation
    this.snapshots.push(snapshot);
    if (this.snapshots.length > 10) {
      this.snapshots.shift();
    }

    const growthRate = this.calculateGrowthRate();
    if (growthRate !== null && growthRate > this.options.growthThresholdMB) {
      const message = `[MemoryMonitor] ⚠️ High memory growth detected: ${growthRate.toFixed(2)}MB/min (threshold: ${this.options.growthThresholdMB}MB/min). Current heap: ${snapshot.usedHeapMB.toFixed(2)}MB`;

      if (this.options.logWarnings) {
        console.warn(message);
      }

      this.options.onWarning(message, snapshot);
    }
  }

  /**
   * Start monitoring memory usage
   */
  start(): void {
    if (!this.isSupported || this.isRunning) return;

    // Take initial snapshot
    const initialSnapshot = this.takeSnapshot();
    if (initialSnapshot) {
      this.snapshots.push(initialSnapshot);

      if (this.options.logWarnings) {
        console.info(
          `[MemoryMonitor] Started monitoring. Initial heap: ${initialSnapshot.usedHeapMB.toFixed(2)}MB`
        );
      }
    }

    this.intervalId = setInterval(() => this.checkMemory(), this.options.checkInterval);
    this.isRunning = true;
  }

  /**
   * Stop monitoring memory usage
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.snapshots = [];

    if (this.options.logWarnings) {
      console.info('[MemoryMonitor] Stopped monitoring.');
    }
  }

  /**
   * Get current memory stats
   */
  getStats(): { current: MemorySnapshot | null; growthRate: number | null } {
    return {
      current: this.takeSnapshot(),
      growthRate: this.calculateGrowthRate(),
    };
  }

  /**
   * Check if monitoring is supported
   */
  isSupportedBrowser(): boolean {
    return this.isSupported;
  }

  /**
   * Check if currently monitoring
   */
  isMonitoring(): boolean {
    return this.isRunning;
  }
}

// Singleton instance for global use
let globalMonitor: MemoryMonitor | null = null;

/**
 * Get or create global memory monitor instance
 */
export function getMemoryMonitor(options?: MemoryMonitorOptions): MemoryMonitor {
  if (!globalMonitor) {
    globalMonitor = new MemoryMonitor(options);
  }
  return globalMonitor;
}

/**
 * Start global memory monitoring
 */
export function startMemoryMonitoring(options?: MemoryMonitorOptions): void {
  const monitor = getMemoryMonitor(options);
  monitor.start();
}

/**
 * Stop global memory monitoring
 */
export function stopMemoryMonitoring(): void {
  if (globalMonitor) {
    globalMonitor.stop();
  }
}
