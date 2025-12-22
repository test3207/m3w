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
 * 2. Adds a priority-based delay (3s/8s/15s) to clear Lighthouse window
 * 3. Uses `requestIdleCallback` to execute during CPU idle time
 * 4. Deduplicates tasks by ID (won't run the same task twice)
 * 
 * ============================================================================
 * PRIORITY LEVELS
 * ============================================================================
 * 
 * HIGH (3s delay):
 *   - Module prefetch that improves perceived UX
 *   - Example: Pre-import cache-manager for faster upload dialog
 * 
 * NORMAL (8s delay):
 *   - Background tasks that can wait a bit
 *   - Example: Non-critical data prefetch
 * 
 * LOW (15s delay):
 *   - Tasks that absolutely shouldn't impact Lighthouse
 *   - Example: Auto-download 90MB of audio files, metadata sync
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
 * Task                    | Priority | Location
 * ------------------------|----------|---------------------------
 * Module prefetch         | HIGH     | startIdlePrefetch()
 * Metadata sync           | NORMAL   | auth-provider.tsx
 * Auto-download audio     | LOW      | auth-provider.tsx
 * Audio preload (resume)  | LOW      | playerStore/index.ts
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

const PRIORITY_DELAYS: Record<TaskPriority, number> = {
  high: 3000,    // 3s - for UX-critical prefetch (modules)
  normal: 8000,  // 8s - for less critical tasks
  low: 15000,    // 15s - for tasks that shouldn't impact Lighthouse
};

const IDLE_TIMEOUT: Record<TaskPriority, number> = {
  high: 5000,    // 5s max wait for idle
  normal: 10000, // 10s max wait for idle
  low: 30000,    // 30s max wait for idle
};

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
  
  // Auto-start scheduler if not running
  if (!isSchedulerStarted) {
    startScheduler();
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
    
    // Schedule each priority level
    for (const priority of ["high", "normal", "low"] as TaskPriority[]) {
      const tasks = tasksByPriority[priority];
      if (tasks.length === 0) continue;
      
      const delay = PRIORITY_DELAYS[priority];
      const timeout = IDLE_TIMEOUT[priority];
      
      setTimeout(() => {
        for (const { id, task } of tasks) {
          executeWhenIdle(id, task, timeout);
        }
      }, delay);
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
