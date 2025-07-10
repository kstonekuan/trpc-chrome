import type { ChromeLinkOptions } from '../link/index.js';

export interface PortInfo {
  name: string;
  port: chrome.runtime.Port;
  isConnected: boolean;
  metadata?: Record<string, unknown>;
}

export class ChromePortManager {
  private ports = new Map<string, PortInfo>();
  private incomingPorts = new Map<string, PortInfo>();
  private connectionListeners = new Map<string, Set<(port: chrome.runtime.Port) => void>>();
  private disconnectionListeners = new Map<string, Set<(port: chrome.runtime.Port) => void>>();

  constructor() {
    // Listen for incoming connections
    chrome.runtime.onConnect.addListener((port) => {
      this.handleIncomingConnection(port);
    });
  }

  private handleIncomingConnection(port: chrome.runtime.Port) {
    const portName = port.name || 'default';

    // Store port info for incoming connections
    const portInfo: PortInfo = {
      name: portName,
      port,
      isConnected: true,
    };

    this.incomingPorts.set(portName, portInfo);

    // Set up disconnect handler
    port.onDisconnect.addListener(() => {
      this.handleIncomingDisconnection(portName);
    });

    // Notify connection listeners
    const listeners = this.connectionListeners.get(portName);
    if (listeners) {
      listeners.forEach((listener) => listener(port));
    }
  }

  private handleDisconnection(portName: string) {
    const portInfo = this.ports.get(portName);
    if (portInfo) {
      portInfo.isConnected = false;

      // Notify disconnection listeners
      const listeners = this.disconnectionListeners.get(portName);
      if (listeners) {
        listeners.forEach((listener) => listener(portInfo.port));
      }
    }
  }

  private handleIncomingDisconnection(portName: string) {
    const portInfo = this.incomingPorts.get(portName);
    if (portInfo) {
      portInfo.isConnected = false;

      // Notify disconnection listeners
      const listeners = this.disconnectionListeners.get(portName);
      if (listeners) {
        listeners.forEach((listener) => listener(portInfo.port));
      }
    }
  }

  /**
   * Get or create a port connection
   */
  getPort(portName: string): chrome.runtime.Port {
    const existing = this.ports.get(portName);
    if (existing?.isConnected) {
      return existing.port;
    }

    // Create new connection
    const port = chrome.runtime.connect({ name: portName });

    // Store port info
    const portInfo: PortInfo = {
      name: portName,
      port,
      isConnected: true,
    };

    this.ports.set(portName, portInfo);

    // Set up disconnect handler
    port.onDisconnect.addListener(() => {
      this.handleDisconnection(portName);
    });

    return port;
  }

  /**
   * Get all active outgoing ports
   */
  getActivePorts(): PortInfo[] {
    return Array.from(this.ports.values()).filter((info) => info.isConnected);
  }

  /**
   * Get all active incoming ports
   */
  getActiveIncomingPorts(): PortInfo[] {
    return Array.from(this.incomingPorts.values()).filter((info) => info.isConnected);
  }

  /**
   * Check if a port is connected
   */
  isConnected(portName: string): boolean {
    return this.ports.get(portName)?.isConnected ?? false;
  }

  /**
   * Add connection listener for a specific port
   */
  onConnect(portName: string, callback: (port: chrome.runtime.Port) => void): () => void {
    if (!this.connectionListeners.has(portName)) {
      this.connectionListeners.set(portName, new Set());
    }

    const listeners = this.connectionListeners.get(portName);
    if (listeners) {
      listeners.add(callback);
    }

    // Return cleanup function
    return () => {
      this.connectionListeners.get(portName)?.delete(callback);
    };
  }

  /**
   * Add disconnection listener for a specific port
   */
  onDisconnect(portName: string, callback: (port: chrome.runtime.Port) => void): () => void {
    if (!this.disconnectionListeners.has(portName)) {
      this.disconnectionListeners.set(portName, new Set());
    }

    const listeners = this.disconnectionListeners.get(portName);
    if (listeners) {
      listeners.add(callback);
    }

    // Return cleanup function
    return () => {
      this.disconnectionListeners.get(portName)?.delete(callback);
    };
  }

  /**
   * Close a specific port
   */
  closePort(portName: string): void {
    const portInfo = this.ports.get(portName);
    if (portInfo?.isConnected) {
      portInfo.port.disconnect();
    }
  }

  /**
   * Close all ports
   */
  closeAll(): void {
    // Close outgoing ports
    this.ports.forEach((portInfo) => {
      if (portInfo.isConnected) {
        portInfo.port.disconnect();
      }
    });

    // Close incoming ports
    this.incomingPorts.forEach((portInfo) => {
      if (portInfo.isConnected) {
        portInfo.port.disconnect();
      }
    });

    this.ports.clear();
    this.incomingPorts.clear();
  }

  /**
   * Create a chrome link with managed port
   */
  createManagedLink(
    portName: string,
    options?: Omit<ChromeLinkOptions, 'port' | 'portName'>,
  ): ChromeLinkOptions {
    return {
      ...options,
      port: this.getPort(portName),
    };
  }
}

// Singleton instance for background script
let backgroundPortManager: ChromePortManager | undefined;

export function getBackgroundPortManager(): ChromePortManager {
  if (!backgroundPortManager) {
    backgroundPortManager = new ChromePortManager();
  }
  return backgroundPortManager;
}

// Factory for content script port managers
export function createPortManager(): ChromePortManager {
  return new ChromePortManager();
}
