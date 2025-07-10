import type { TRPCLink } from '@trpc/client';
import type { AnyRouter } from '@trpc/server';
import type { ChromeLinkOptions } from '../link/index.js';
import { chromeLink } from '../link/index.js';

/**
 * Create a type-safe port name system for Chrome extensions
 *
 * @example
 * ```typescript
 * // Define your port names
 * const PortNames = createPortNames([
 *   'content-to-background',
 *   'popup-to-background',
 *   'devtools-to-background',
 *   'options-to-background',
 * ] as const);
 *
 * // Type-safe port creation
 * const contentPort = chrome.runtime.connect({ name: PortNames.contentToBackground });
 *
 * // Type-safe link creation
 * const link = createTypedChromeLink(PortNames.contentToBackground, { transformer: superjson });
 * ```
 */
export function createPortNames<T extends readonly string[]>(names: T) {
  type PortName = T[number];

  const portNames = {} as Record<CamelCase<PortName>, PortName>;

  for (const name of names) {
    const camelCaseName = toCamelCase(name) as CamelCase<PortName>;
    (portNames as Record<string, string>)[camelCaseName] = name;
  }

  return portNames;
}

/**
 * Create a typed chrome link with enforced port name
 */
export function createTypedChromeLink<TRouter extends AnyRouter, TPortName extends string>(
  portName: TPortName,
  options?: Omit<ChromeLinkOptions, 'port' | 'portName'>,
): TRPCLink<TRouter> {
  return chromeLink({
    ...options,
    portName,
  });
}

/**
 * Type-safe port connection helper
 */
export function connectToTypedPort<TPortName extends string>(
  portName: TPortName,
  options?: chrome.runtime.ConnectInfo,
): chrome.runtime.Port {
  return chrome.runtime.connect({
    ...options,
    name: portName,
  });
}

/**
 * Create a port name validator for runtime checks
 */
export function createPortValidator<T extends readonly string[]>(validPortNames: T) {
  type ValidPortName = T[number];

  const validSet = new Set(validPortNames);

  return {
    isValid: (portName: string): portName is ValidPortName => {
      return validSet.has(portName);
    },

    assert: (portName: string): asserts portName is ValidPortName => {
      if (!validSet.has(portName)) {
        throw new Error(
          `Invalid port name: ${portName}. Valid names are: ${[...validSet].join(', ')}`,
        );
      }
    },

    validate: (portName: string): ValidPortName => {
      if (!validSet.has(portName)) {
        throw new Error(
          `Invalid port name: ${portName}. Valid names are: ${[...validSet].join(', ')}`,
        );
      }
      return portName as ValidPortName;
    },
  };
}

/**
 * Create a typed port registry for managing multiple port types
 */
export class TypedPortRegistry<TPortNames extends Record<string, string>> {
  private ports = new Map<keyof TPortNames, chrome.runtime.Port>();
  private portNames: TPortNames;

  constructor(portNames: TPortNames) {
    this.portNames = portNames;
  }

  connect<K extends keyof TPortNames>(
    portKey: K,
    options?: Omit<chrome.runtime.ConnectInfo, 'name'>,
  ): chrome.runtime.Port {
    const existingPort = this.ports.get(portKey);
    if (existingPort) {
      return existingPort;
    }

    const port = chrome.runtime.connect({
      ...options,
      name: this.portNames[portKey],
    });

    this.ports.set(portKey, port);

    // Clean up on disconnect
    port.onDisconnect.addListener(() => {
      this.ports.delete(portKey);
    });

    return port;
  }

  getPort<K extends keyof TPortNames>(portKey: K): chrome.runtime.Port | undefined {
    return this.ports.get(portKey);
  }

  disconnect<K extends keyof TPortNames>(portKey: K): void {
    const port = this.ports.get(portKey);
    if (port) {
      port.disconnect();
      this.ports.delete(portKey);
    }
  }

  disconnectAll(): void {
    for (const port of this.ports.values()) {
      port.disconnect();
    }
    this.ports.clear();
  }

  createLink<TRouter extends AnyRouter, K extends keyof TPortNames>(
    portKey: K,
    options?: Omit<ChromeLinkOptions, 'port' | 'portName'>,
  ): TRPCLink<TRouter> {
    return chromeLink({
      ...options,
      port: this.connect(portKey),
    });
  }
}

// Utility types
type CamelCase<S extends string> = S extends `${infer P1}-${infer P2}`
  ? `${Lowercase<P1>}${Capitalize<CamelCase<P2>>}`
  : Lowercase<S>;

// Utility function
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
