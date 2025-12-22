/**
 * Idle Task Scheduler - Unified management for deferred background tasks
 * 
 * ============================================================================
 * PROBLEM
 * ============================================================================
 * Background tasks (auto-download, metadata sync, audio preload) that run
 * immediately on page load compete for network/CPU bandwidth and destroy
 * Lighthouse performance scores. The key insight:
 * 
 *   Lighthouse measures for ~10-15 seconds after navigation starts.
 *   Any heavy task during this window impacts LCP, TBT, and Speed Index.
 * 
 * ============================================================================
 * SOLUTION
 * ============================================================================
 * This module provides a unified scheduler that:
 * 
 * 1. Waits for `window.load` event (critical resources done)
 * 2. Calculates remaining delay from navigation start (adaptive to device speed)
 * 3. Uses `requestIdleCallback` to execute during CPU idle time
 * 4. Deduplicates tasks by ID (won't run the same task twice)
 * 
 * ============================================================================
 * ADAPTIVE DELAY CALCULATION
 * ============================================================================
 * 
 * The delay is measured from **navigation start**, not from load event.
 * This adapts to device performance:
 * 
 *   Fast device (load completes at 2s):
 *   ├── HIGH (3s target): wait 1s more after load
 *   ├── NORMAL (8s target): wait 6s more after load
 *   └── LOW (15s target): wait 13s more after load
 * 
 *   Average device (load completes at 5s):
 *   ├── HIGH (3s target): execute immediately (already past 3s)
 *   ├── NORMAL (8s target): wait 3s more after load
 *   └── LOW (15s target): wait 10s more after load
 * 
 *   Slow device (load completes at 12s):
 *   ├── HIGH (3s target): execute immediately
 *   ├── NORMAL (8s target): execute immediately
 *   └── LOW (15s target): wait 3s more after load
 * 
 *   Very slow device (load completes at 20s):
 *   └── All tasks execute immediately (Lighthouse measurement long over)
 * 
 * ============================================================================
 * PRIORITY LEVELS
 * ============================================================================
 * 
 * HIGH (nav + 3s):
 *   - Module prefetch that improves perceived UX
 *   - Example: Pre-import cache-manager for faster upload dialog
 * 
 * NORMAL (nav + 8s):
 *   - Background tasks that can wait a bit
 *   - Example: Metadata sync from backend
 * 
 * LOW (nav + 15s):
 *   - Tasks that absolutely shouldn't impact Lighthouse
 *   - Example: Auto-download 90MB of audio files, audio preload
 * 
 * ============================================================================
 * EXPORTED API
 * ============================================================================
 * 
 * prefetchModule(loader, name)
 *   - HIGH priority module preloading
 *   - Example: prefetchModule(() => import("./heavy-module"), "heavy")
 * 
 * scheduleLowPriorityTask(id, task)
 *   - LOW priority task scheduling
 *   - Example: scheduleLowPriorityTask("auto-download", downloadAll)
 * 
 * scheduleNormalPriorityTask(id, task)
 *   - NORMAL priority task scheduling  
 *   - Example: scheduleNormalPriorityTask("metadata-sync", syncAll)
 * 
 * startIdlePrefetch()
 *   - Initialize pre-configured prefetch tasks
 *   - Should be called once in AuthProvider
 * 
 * ============================================================================
 * USAGE IN M3W
 * ============================================================================
 * 
 * Task                    | Priority | Min Time    | Location
 * ------------------------|----------|-------------|---------------------------
 * Module prefetch         | HIGH     | nav + 3s    | startIdlePrefetch()
 * Metadata sync           | NORMAL   | nav + 8s    | auth-provider.tsx
 * Auto-download audio     | LOW      | nav + 15s   | auth-provider.tsx
 * Audio preload (resume)  | LOW      | nav + 15s   | playerStore/index.ts
 * 
 * ============================================================================
 * WHY requestIdleCallback?
 * ============================================================================
 * 
 * Unlike setTimeout which only waits for a fixed time, requestIdleCallback
 * waits for the browser to be truly idle:
 * - No pending user input
 * - No pending animation frames
 * - No pending high-priority tasks
 * 
 * This ensures our background tasks don't compete with UI interactions.
 * Safari doesn't support requestIdleCallback, so we fall back to setTimeout.
 * 
 * ============================================================================
 * WHY NOT Web Workers?
 * ============================================================================
 * 
 * Web Workers help with CPU-bound tasks but not network-bound tasks.
 * Our tasks are primarily network I/O (downloads, API calls), so
 * requestIdleCallback + delay is the right approach.
 */

import { logger } from "./logger-client";

// ============================================================================
// Types
// ============================================================================

type TaskPriority = "high" | "normal" | "low";

interface IdleTask {
  id: string;
  task: () => void | Promise<void>;
  priority: TaskPriority;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Minimum time from navigation start before executing tasks.
 * This ensures tasks don't run during Lighthouse measurement window (~10-15s).
 * 
 * Example scenarios:
 * - Fast device (load at 2s): HIGH waits 1s more, NORMAL waits 6s, LOW waits 13s
 * - Slow device (load at 10s): HIGH runs immediately, NORMAL runs immediately, LOW waits 5s
 * - Very slow (load at 20s): All tasks run immediately after load
 */
const MIN_TIME_FROM_NAV_START: Record<TaskPriority, number> = {
  high: 3000,    // 3s from navigation - UX-critical prefetch
  normal: 8000,  // 8s from navigation - background tasks
  low: 15000,    // 15s from navigation - tasks that shouldn't impact Lighthouse
};

const IDLE_TIMEOUT: Record<TaskPriority, number> = {
  high: 5000,    // 5s max wait for idle
  normal: 10000, // 10s max wait for idle
  low: 30000,    // 30s max wait for idle
};

// Navigation start time using Performance API (Level 2)
// performance.timeOrigin: high-resolution timestamp of navigation start
// Fallback to Date.now() if Performance API unavailable (very old browsers)
const navigationStart = typeof performance !== "undefined" && performance.timeOrigin
  ? performance.timeOrigin
  : Date.now();

// ============================================================================
// State
// ============================================================================

const pendingTasks = new Map<string, IdleTask>();
const completedTasks = new Set<string>();
let isSchedulerStarted = false;

// ============================================================================
// Core Scheduler
// ============================================================================

/**
 * Schedule a task to run during browser idle time (internal use)
 * @param id - Unique task identifier (prevents duplicates)
 * @param task - Function to execute
 * @param priority - Execution priority level
 */
function scheduleIdleTask(
  id: string,
  task: () => void | Promise<void>,
  priority: TaskPriority = "normal"
): void {
  // Skip if already completed or pending
  if (completedTasks.has(id) || pendingTasks.has(id)) {
    return;
  }
  
  pendingTasks.set(id, { id, task, priority });
  
  // Start scheduler or process immediately if page already loaded
  if (!isSchedulerStarted) {
    startScheduler();
  } else if (document.readyState === "complete") {
    // Page already loaded and scheduler already started
    // Process this new task immediately with appropriate delay
    processNewTask(id, task, priority);
  }
}

/**
 * Process a single task that was added after page load
 * Calculates the remaining delay from navigation start
 */
function processNewTask(
  id: string,
  task: () => void | Promise<void>,
  priority: TaskPriority
): void {
  const now = Date.now();
  const timeSinceNavStart = now - navigationStart;
  const minTime = MIN_TIME_FROM_NAV_START[priority];
  const timeout = IDLE_TIMEOUT[priority];
  const remainingDelay = Math.max(0, minTime - timeSinceNavStart);
  
  if (remainingDelay === 0) {
    executeWhenIdle(id, task, timeout);
  } else {
    setTimeout(() => executeWhenIdle(id, task, timeout), remainingDelay);
  }
}

/**
 * Start the idle task scheduler
 * Waits for page load, then processes tasks by priority
 */
function startScheduler(): void {
  if (isSchedulerStarted) return;
  isSchedulerStarted = true;
  
  const processQueue = () => {
    // Group tasks by priority
    const tasksByPriority: Record<TaskPriority, IdleTask[]> = {
      high: [],
      normal: [],
      low: [],
    };
    
    for (const task of pendingTasks.values()) {
      tasksByPriority[task.priority].push(task);
    }
    
    // Calculate remaining delay based on time since navigation start
    const now = Date.now();
    const timeSinceNavStart = now - navigationStart;
    
    // Schedule each priority level
    for (const priority of ["high", "normal", "low"] as TaskPriority[]) {
      const tasks = tasksByPriority[priority];
      if (tasks.length === 0) continue;
      
      const minTime = MIN_TIME_FROM_NAV_START[priority];
      const timeout = IDLE_TIMEOUT[priority];
      
      // Calculate remaining delay: if already past minimum time, delay is 0
      const remainingDelay = Math.max(0, minTime - timeSinceNavStart);
      
      if (remainingDelay === 0) {
        // Already past minimum time, execute immediately when idle
        for (const { id, task } of tasks) {
          executeWhenIdle(id, task, timeout);
        }
      } else {
        // Wait for remaining time before executing
        setTimeout(() => {
          for (const { id, task } of tasks) {
            executeWhenIdle(id, task, timeout);
          }
        }, remainingDelay);
      }
    }
  };
  
  // Wait for page load before processing
  if (document.readyState === "complete") {
    processQueue();
  } else {
    window.addEventListener("load", processQueue, { once: true });
  }
}

/**
 * Execute a task when browser is idle
 */
function executeWhenIdle(
  id: string,
  task: () => void | Promise<void>,
  timeout: number
): void {
  // Skip if already completed (could happen with race conditions)
  if (completedTasks.has(id)) return;
  
  const execute = async () => {
    if (completedTasks.has(id)) return;
    
    pendingTasks.delete(id);
    completedTasks.add(id);
    
    try {
      await task();
      logger.debug(`Idle task completed: ${id}`);
    } catch (error) {
      logger.warn(`Idle task failed: ${id}`, error);
    }
  };
  
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => void execute(), { timeout });
  } else {
    // Safari fallback
    setTimeout(() => void execute(), 1000);
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Prefetch a module during idle time
 * @param moduleLoader - Dynamic import function
 * @param name - Module name for identification
 */
export function prefetchModule(
  moduleLoader: () => Promise<unknown>,
  name: string
): void {
  scheduleIdleTask(
    `prefetch:${name}`,
    async () => { await moduleLoader(); },
    "high"
  );
}

/**
 * Schedule a low-priority task (won't impact Lighthouse)
 * Executes 15s+ after page load during browser idle time
 * @param id - Unique task identifier
 * @param task - Function to execute
 */
export function scheduleLowPriorityTask(
  id: string,
  task: () => void | Promise<void>
): void {
  scheduleIdleTask(id, task, "low");
}

/**
 * Schedule a normal-priority task
 * Executes 8s+ after page load during browser idle time
 * @param id - Unique task identifier
 * @param task - Function to execute
 */
export function scheduleNormalPriorityTask(
  id: string,
  task: () => void | Promise<void>
): void {
  scheduleIdleTask(id, task, "normal");
}

// ============================================================================
// Pre-configured Tasks
// ============================================================================

/**
 * Start prefetching commonly used heavy modules
 * Called once after app mounts
 */
export function startIdlePrefetch(): void {
  // cache-manager (contains music-metadata ~100KB)
  // Needed for: upload, library delete
  prefetchModule(
    () => import("@/lib/pwa/cache-manager"),
    "cache-manager"
  );
}
