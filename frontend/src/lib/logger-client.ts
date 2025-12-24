/**
 * Frontend Logger
 *
 * Unified logging for frontend with optional backend submission.
 * - Dev: console only
 * - Prod: optionally sends to `/api/logs` (controlled by window.__ENABLE_REMOTE_LOGGING__)
 *
 * Usage:
 *   import { logger } from "@/lib/logger-client";
 *
 *   // Standalone log (auto page from location.pathname, each gets unique traceId)
 *   logger.info("[App][init]", "App started");
 *
 *   // Traced flow (page passed once at start, all logs share same traceId)
 *   const trace = logger.startTrace("/library");
 *   trace.info("[Upload][start]", "Starting upload", { raw: { fileName } });
 *   trace.error("[Upload][fail]", "Upload failed", err);
 *   trace.end();
 */

import { API_BASE_URL } from "./api/config";
import { useAuthStore } from "@/stores/authStore";

// ============================================================================
// Configuration
// ============================================================================

const isDev = typeof window !== "undefined" && import.meta.env.DEV;
const SERVICE = "m3w-frontend";
const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 10;

/**
 * Check if remote logging is enabled (runtime injection)
 * Reads from window.__ENABLE_REMOTE_LOGGING__ (injected by docker-entrypoint or build)
 * Default: false
 */
function isRemoteLoggingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runtimeFlag = (window as any).__ENABLE_REMOTE_LOGGING__;
  // Check if it's explicitly set to true (string "true" or boolean true)
  return runtimeFlag === "true" || runtimeFlag === true;
}

// ============================================================================
// Types
// ============================================================================

type LogLevel = "debug" | "info" | "warn" | "error";

/** Optional fields for log calls */
export interface LogOptions {
  /** External traceId (if not provided, generates new one) */
  traceId?: string;
  col1?: string;
  col2?: string;
  col3?: string;
  raw?: object;
}

/** Internal log entry for backend submission */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  traceId: string;
  sessionId: string;
  userId?: string;
  page: string;
  source: string;
  message: string;
  col1?: string;
  col2?: string;
  col3?: string;
  raw?: string;
  error?: string;
  errorStack?: string;
  // Client context (frontend-collected)
  language?: string;
  timezone?: string;
  screen?: string;
  pixelRatio?: number;
  networkType?: string;
  isOnline?: boolean;
  referrer?: string;
}

/** Trace instance for tracking a flow - page is fixed at creation */
export interface Trace {
  readonly traceId: string;
  readonly page: string;
  debug(source: string, message: string, options?: LogOptions): void;
  info(source: string, message: string, options?: LogOptions): void;
  warn(source: string, message: string, options?: LogOptions): void;
  error(source: string, message: string, err?: unknown, options?: LogOptions): void;
  end(): void;
}

/** Main logger interface - page auto-detected from location.pathname */
export interface Logger {
  startTrace(page: string): Trace;
  initialize(): void;
  destroy(): void;
  debug(source: string, message: string, options?: LogOptions): void;
  info(source: string, message: string, options?: LogOptions): void;
  warn(source: string, message: string, options?: LogOptions): void;
  error(source: string, message: string, err?: unknown, options?: LogOptions): void;
}

// ============================================================================
// Implementation
// ============================================================================

/** Generate UUID with fallback for non-secure contexts (LAN HTTP) */
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Falls through to fallback
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Parse error to extract message and stack */
function parseError(err: unknown): { error?: string; errorStack?: string } {
  if (!err) return {};
  if (err instanceof Error) {
    return { error: err.message, errorStack: err.stack };
  }
  return { error: String(err) };
}

/** Shared buffer and flush logic */
class LogBuffer {
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;
  private staticContext: {
    language?: string;
    timezone?: string;
    screen?: string;
    pixelRatio?: number;
    referrer?: string;
  };

  constructor() {
    // Generate session ID on page load, not persisted
    this.sessionId = "sess_" + Math.random().toString(36).substring(2, 10);
    
    // Collect static context once (won't change during session)
    this.staticContext = {};
    if (typeof window !== "undefined") {
      this.staticContext.language = navigator.language;
      this.staticContext.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      this.staticContext.screen = `${window.innerWidth}x${window.innerHeight}`;
      this.staticContext.pixelRatio = window.devicePixelRatio;
      this.staticContext.referrer = document.referrer || undefined;
    }
  }

  /** Get userId from auth store (may change during session) */
  private getUserId(): string | undefined {
    try {
      return useAuthStore.getState().user?.id;
    } catch {
      return undefined;
    }
  }

  initialize(): void {
    if (this.flushTimer) return;

    if (!isRemoteLoggingEnabled()) return;

    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flush());
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flush();
      });
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  add(
    level: LogLevel,
    traceId: string,
    source: string,
    message: string,
    page: string,
    options?: LogOptions,
    err?: unknown
  ): void {
    const { error, errorStack } = parseError(err);
    
    // Collect dynamic context (may change during session)
    const dynamicContext: { networkType?: string; isOnline?: boolean } = {};
    if (typeof window !== "undefined") {
      dynamicContext.isOnline = navigator.onLine;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection?.effectiveType) {
        dynamicContext.networkType = connection.effectiveType;
      }
    }

    const userId = this.getUserId();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE,
      traceId,
      sessionId: this.sessionId,
      ...(userId && { userId }),
      page,
      source,
      message,
      ...(options?.col1 && { col1: options.col1 }),
      ...(options?.col2 && { col2: options.col2 }),
      ...(options?.col3 && { col3: options.col3 }),
      ...(options?.raw && { raw: JSON.stringify(options.raw) }),
      ...(error && { error }),
      ...(errorStack && { errorStack }),
      // Static context
      ...this.staticContext,
      // Dynamic context
      ...dynamicContext,
    };

    this.buffer.push(entry);
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logs = this.buffer.splice(0);
    try {
      const res = await fetch(`${API_BASE_URL}/api/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logs),
        keepalive: true,
      });
      if (!res.ok) {
        this.buffer.unshift(...logs);
      }
    } catch {
      this.buffer.unshift(...logs);
    }
  }
}

/** Trace implementation - page fixed at creation */
class TraceImpl implements Trace {
  readonly traceId: string;
  readonly page: string;
  private buffer: LogBuffer;
  private ended = false;

  constructor(buffer: LogBuffer, page: string) {
    this.traceId = generateId();
    this.page = page;
    this.buffer = buffer;
  }

  debug(source: string, message: string, options?: LogOptions): void {
    if (this.ended) return;
    if (isDev) {
      console.debug(`[Debug] ${source} ${message}`, options?.raw ?? "");
    }
    // debug not sent to backend
  }

  info(source: string, message: string, options?: LogOptions): void {
    if (this.ended) return;
    if (isDev) {
      console.info(`[Info] ${source} ${message}`, options?.raw ?? "");
    }
    if (isRemoteLoggingEnabled()) {
      this.buffer.add("info", this.traceId, source, message, this.page, options);
    }
  }

  warn(source: string, message: string, options?: LogOptions): void {
    if (this.ended) return;
    console.warn(`[Warn] ${source} ${message}`, options?.raw ?? "");
    if (isRemoteLoggingEnabled()) {
      this.buffer.add("warn", this.traceId, source, message, this.page, options);
    }
  }

  error(source: string, message: string, err?: unknown, options?: LogOptions): void {
    if (this.ended) return;
    console.error(`[Error] ${source} ${message}`, err, options?.raw ?? "");
    if (isRemoteLoggingEnabled()) {
      this.buffer.add("error", this.traceId, source, message, this.page, options, err);
    }
  }

  end(): void {
    this.ended = true;
  }
}

/** Main logger implementation - page auto-detected from location.pathname */
class FrontendLogger implements Logger {
  private buffer: LogBuffer;
  private isInitialized = false;

  constructor() {
    this.buffer = new LogBuffer();
  }

  initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.buffer.initialize();
    this.setupGlobalHandlers();
  }

  destroy(): void {
    this.buffer.destroy();
  }

  startTrace(page: string): Trace {
    return new TraceImpl(this.buffer, page);
  }

  private getPage(): string {
    return typeof window !== "undefined" ? window.location.pathname : "/";
  }

  debug(source: string, message: string, options?: LogOptions): void {
    if (isDev) {
      console.debug(`[Debug] ${source} ${message}`, options?.raw ?? "");
    }
    // debug not sent to backend
  }

  info(source: string, message: string, options?: LogOptions): void {
    if (isDev) {
      console.info(`[Info] ${source} ${message}`, options?.raw ?? "");
    }
    if (isRemoteLoggingEnabled()) {
      this.buffer.add("info", options?.traceId || generateId(), source, message, this.getPage(), options);
    }
  }

  warn(source: string, message: string, options?: LogOptions): void {
    console.warn(`[Warn] ${source} ${message}`, options?.raw ?? "");
    if (isRemoteLoggingEnabled()) {
      this.buffer.add("warn", options?.traceId || generateId(), source, message, this.getPage(), options);
    }
  }

  error(source: string, message: string, err?: unknown, options?: LogOptions): void {
    console.error(`[Error] ${source} ${message}`, err, options?.raw ?? "");
    if (isRemoteLoggingEnabled()) {
      this.buffer.add("error", options?.traceId || generateId(), source, message, this.getPage(), options, err);
    }
  }

  private setupGlobalHandlers(): void {
    if (typeof window === "undefined") return;

    window.onerror = (msg, url, line, col, error) => {
      this.error(
        "[Global][onerror]",
        "Uncaught error",
        error || new Error(String(msg)),
        { col1: "js", col2: "uncaught", raw: { url, line, col } }
      );
      return false;
    };

    window.onunhandledrejection = (event) => {
      this.error(
        "[Global][onunhandledrejection]",
        "Unhandled promise rejection",
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { col1: "js", col2: "promise_rejection" }
      );
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const logger: Logger = new FrontendLogger();
