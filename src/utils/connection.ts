import { TRPCClientError, type TRPCLink } from '@trpc/client';
import type { AnyRouter } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { type ChromeLinkOptions, chromeLink } from '../link/index.js';

export type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface ConnectionOptions extends ChromeLinkOptions {
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  onStateChange?: (state: ConnectionState) => void;
}

export interface ConnectionInfo {
  state: ConnectionState;
  attempts: number;
  lastError?: Error;
  port?: chrome.runtime.Port;
}

export class ChromeConnectionManager {
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer?: number;
  private currentPort?: chrome.runtime.Port;
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private options: ConnectionOptions;

  constructor(options: ConnectionOptions) {
    this.options = options;
    // Start with initial connection attempt
    this.connect();
  }

  private notifyStateChange(newState: ConnectionState) {
    if (this.state !== newState) {
      this.state = newState;
      this.options.onStateChange?.(newState);
      this.stateListeners.forEach((listener) => listener(newState));
    }
  }

  private connect() {
    try {
      this.notifyStateChange('connecting');

      // Create port connection
      const port =
        this.options.port ||
        chrome.runtime.connect(this.options.portName ? { name: this.options.portName } : undefined);

      this.currentPort = port;

      // Set up disconnect handler with auto-reconnect
      port.onDisconnect.addListener(() => {
        this.notifyStateChange('disconnected');
        this.currentPort = undefined;

        // Attempt reconnection if within limits
        const maxAttempts = this.options.maxReconnectAttempts ?? 5;
        if (this.reconnectAttempts < maxAttempts) {
          this.scheduleReconnect();
        } else {
          this.notifyStateChange('error');
        }
      });

      // Reset attempts on successful connection
      this.reconnectAttempts = 0;

      // Consider connected once port is established
      this.notifyStateChange('connected');
    } catch (_error) {
      this.notifyStateChange('error');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const interval = this.options.reconnectInterval ?? 1000;
    this.reconnectTimer = setTimeout(
      () => {
        this.reconnectAttempts++;
        this.connect();
      },
      interval * Math.min(this.reconnectAttempts + 1, 5),
    ) as unknown as number; // Exponential backoff up to 5x
  }

  getState(): ConnectionState {
    return this.state;
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      state: this.state,
      attempts: this.reconnectAttempts,
      port: this.currentPort,
    };
  }

  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.currentPort) {
      this.currentPort.disconnect();
      this.currentPort = undefined;
    }

    this.notifyStateChange('disconnected');
  }

  reconnect() {
    this.reconnectAttempts = 0;
    this.disconnect();
    this.connect();
  }

  /**
   * Create a managed chrome link with auto-reconnect
   */
  createManagedLink(): ChromeLinkOptions {
    return {
      ...this.options,
      port: this.currentPort,
    };
  }
}

/**
 * Create a chrome link with connection state management
 */
export function createManagedChromeLink<TRouter extends AnyRouter>(
  options: ConnectionOptions,
): TRPCLink<TRouter> {
  const manager = new ChromeConnectionManager(options);

  return (runtime) => {
    // Return a link that tracks connection state
    return (ctx) => {
      return observable((observer) => {
        // Subscribe to state changes
        const unsubscribe = manager.onStateChange((state) => {
          if (state === 'error' || state === 'disconnected') {
            observer.error(new TRPCClientError(`Connection ${state}`));
          }
        });

        // Get current connection info
        const connectionInfo = manager.getConnectionInfo();

        if (connectionInfo.state !== 'connected' || !connectionInfo.port) {
          observer.error(new TRPCClientError('Not connected'));
          return () => unsubscribe();
        }

        // Create link with current port
        const linkOptions: ChromeLinkOptions = {
          ...options,
          port: connectionInfo.port,
        };

        const link = chromeLink<TRouter>(linkOptions);
        const subscription = link(runtime)(ctx).subscribe(observer);

        return () => {
          unsubscribe();
          subscription.unsubscribe();
        };
      });
    };
  };
}

/**
 * Create a subscription to monitor connection state
 */
export function createConnectionStateSubscription() {
  return observable<ConnectionState>((observer) => {
    // This would need to be integrated with the manager instance
    // For now, this is a placeholder for the API design
    observer.complete();
    return () => {};
  });
}
