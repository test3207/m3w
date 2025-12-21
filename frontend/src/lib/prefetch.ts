/**
 * Idle Task Scheduler - Unified management for deferred tasks
 * 
 * Uses requestIdleCallback to schedule tasks during browser idle time.
 * Provides different priority levels to control execution order.
 * 
 * Priority levels:
 * - HIGH: Execute ASAP when idle (e.g., module prefetch for UX)
 * - NORMAL: Execute after page is stable (~5s after load)
 * - LOW: Execute well after Lighthouse measurement (~15s after load)
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
 * Schedule a task to run during browser idle time
 * @param id - Unique task identifier (prevents duplicates)
 * @param task - Function to execute
 * @param priority - Execution priority level
 */
export function scheduleIdleTask(
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
 * @param id - Unique task identifier
 * @param task - Function to execute
 */
export function scheduleLowPriorityTask(
  id: string,
  task: () => void | Promise<void>
): void {
  scheduleIdleTask(id, task, "low");
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
