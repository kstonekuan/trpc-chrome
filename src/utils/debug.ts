import type { TRPCChromeRequest, TRPCChromeResponse } from '../types/index.js';

export interface DebugOptions {
  enabled?: boolean;
  logRequests?: boolean;
  logResponses?: boolean;
  logErrors?: boolean;
  logTiming?: boolean;
  customLogger?: (entry: DebugLogEntry) => void;
  filter?: (entry: DebugLogEntry) => boolean;
}

export interface DebugLogEntry {
  timestamp: number;
  type: 'request' | 'response' | 'error' | 'timing';
  portName?: string;
  method?: string;
  path?: string;
  id?: string | number;
  data?: unknown;
  duration?: number;
  error?: unknown;
}

export class ChromeDebugger {
  private options: Required<DebugOptions>;
  private requestTimings = new Map<string | number, number>();

  constructor(options: DebugOptions = {}) {
    this.options = {
      enabled: options.enabled ?? false,
      logRequests: options.logRequests ?? true,
      logResponses: options.logResponses ?? true,
      logErrors: options.logErrors ?? true,
      logTiming: options.logTiming ?? true,
      customLogger: options.customLogger ?? this.defaultLogger,
      filter: options.filter ?? (() => true),
    };
  }

  private defaultLogger(entry: DebugLogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[tRPC-Chrome ${entry.type.toUpperCase()}]`;

    switch (entry.type) {
      case 'request':
        console.log(
          `%c${prefix} ${timestamp}`,
          'color: #4CAF50; font-weight: bold',
          `\n→ ${entry.method} ${entry.path}`,
          entry.data ? `\nInput:` : '',
          entry.data || '',
        );
        break;

      case 'response':
        console.log(
          `%c${prefix} ${timestamp}`,
          'color: #2196F3; font-weight: bold',
          `\n← ${entry.path}`,
          entry.duration ? `(${entry.duration}ms)` : '',
          entry.data ? `\nOutput:` : '',
          entry.data || '',
        );
        break;

      case 'error':
        console.error(
          `%c${prefix} ${timestamp}`,
          'color: #F44336; font-weight: bold',
          `\n✗ ${entry.path}`,
          '\nError:',
          entry.error,
        );
        break;

      case 'timing':
        console.log(
          `%c${prefix} ${timestamp}`,
          'color: #FF9800; font-weight: bold',
          `\n⏱ ${entry.path} completed in ${entry.duration}ms`,
        );
        break;
    }
  }

  logRequest(port: chrome.runtime.Port, request: TRPCChromeRequest): void {
    if (!this.options.enabled || !this.options.logRequests) return;

    const trpc = request.trpc;
    if (!trpc) return;

    // Extract path and input from params if available
    const params = 'params' in trpc ? trpc.params : undefined;
    const path =
      params && typeof params === 'object' && 'path' in params
        ? String((params as Record<string, unknown>).path)
        : undefined;
    const input =
      params && typeof params === 'object' && 'input' in params
        ? (params as Record<string, unknown>).input
        : undefined;

    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      type: 'request',
      portName: port.name,
      method: trpc.method,
      path: path as string | undefined,
      id: trpc.id !== null ? trpc.id : undefined,
      data: input,
    };

    if (this.options.filter(entry)) {
      this.options.customLogger(entry);

      // Track timing
      if (this.options.logTiming && entry.id !== undefined && entry.id !== null) {
        this.requestTimings.set(entry.id, Date.now());
      }
    }
  }

  logResponse(port: chrome.runtime.Port, response: TRPCChromeResponse): void {
    if (!this.options.enabled || !this.options.logResponses) return;

    const trpc = response.trpc;
    if (!trpc) return;

    const id = trpc.id !== null ? trpc.id : undefined;
    const startTime = id !== undefined ? this.requestTimings.get(id) : undefined;
    const duration = startTime ? Date.now() - startTime : undefined;

    if (duration && id !== undefined) {
      this.requestTimings.delete(id);
    }

    // Extract result data
    const data = 'result' in trpc ? trpc.result : undefined;

    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      type: 'response',
      portName: port.name,
      id,
      data,
      duration,
    };

    if (this.options.filter(entry)) {
      this.options.customLogger(entry);
    }
  }

  logError(
    port: chrome.runtime.Port,
    error: unknown,
    context?: { path?: string; method?: string },
  ): void {
    if (!this.options.enabled || !this.options.logErrors) return;

    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      type: 'error',
      portName: port.name,
      path: context?.path,
      method: context?.method,
      error,
    };

    if (this.options.filter(entry)) {
      this.options.customLogger(entry);
    }
  }

  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  clear(): void {
    this.requestTimings.clear();
  }
}

// Global debugger instance
let globalDebugger: ChromeDebugger | undefined;

export function getGlobalDebugger(): ChromeDebugger {
  if (!globalDebugger) {
    globalDebugger = new ChromeDebugger({
      enabled: true,
    });
  }
  return globalDebugger;
}

export function setGlobalDebugger(instance: ChromeDebugger): void {
  globalDebugger = instance;
}

/**
 * Debug middleware for adapter
 */
export function createDebugMiddleware(debugOptions?: DebugOptions) {
  const instance = new ChromeDebugger(debugOptions);

  return {
    onRequest: (port: chrome.runtime.Port, request: TRPCChromeRequest) => {
      instance.logRequest(port, request);
    },
    onResponse: (port: chrome.runtime.Port, response: TRPCChromeResponse) => {
      instance.logResponse(port, response);
    },
    onError: (
      port: chrome.runtime.Port,
      error: unknown,
      context?: { path?: string; method?: string },
    ) => {
      instance.logError(port, error, context);
    },
    debugger: instance,
  };
}

/**
 * Create a debug panel for Chrome DevTools
 */
export function createDebugPanel() {
  if (typeof chrome !== 'undefined' && chrome.devtools) {
    chrome.devtools.panels.create('tRPC Chrome', '', 'trpc-debug.html', (_panel) => {
      // Panel created
      console.log('tRPC Chrome debug panel created');
    });
  }
}

/**
 * Debug utilities for development
 */
export const debugUtils = {
  /**
   * Log all port connections
   */
  logAllPorts(): void {
    chrome.runtime.onConnect.addListener((port) => {
      console.log(`[tRPC-Chrome] Port connected: ${port.name}`);

      port.onDisconnect.addListener(() => {
        console.log(`[tRPC-Chrome] Port disconnected: ${port.name}`);
      });
    });
  },

  /**
   * Enable verbose logging
   */
  enableVerboseLogging(): void {
    const instance = getGlobalDebugger();
    instance.setEnabled(true);
    console.log('[tRPC-Chrome] Verbose logging enabled');
  },

  /**
   * Get performance metrics
   */
  getMetrics(): { averageResponseTime: number; totalRequests: number } {
    // This would need to be implemented with actual metrics collection
    return {
      averageResponseTime: 0,
      totalRequests: 0,
    };
  },

  /**
   * Export debug logs
   */
  exportLogs(): string {
    // This would need to be implemented with actual log storage
    return JSON.stringify([], null, 2);
  },
};
