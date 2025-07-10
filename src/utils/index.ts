import { type AnyRouter, initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { chromeLink } from '../link/index.js';

/**
 * Creates a tRPC instance with SuperJSON transformer pre-configured
 * for Chrome extension environments.
 */
export const initTRPCWithSuperjson = () => {
  return initTRPC.create({
    transformer: superjson,
    isServer: false,
    allowOutsideOfServer: true,
  });
};

/**
 * Creates a Chrome link with SuperJSON transformer pre-configured,
 * matching the behavior of initTRPCWithSuperjson()
 */
export const chromeLinkWithSuperjson = (options: Parameters<typeof chromeLink>[0] = {}) => {
  return chromeLink({
    transformer: superjson,
    ...options,
  });
};

/**
 * Helper for creating namespaced routers with proper type inference
 * @example
 * const t = initTRPCWithSuperjson();
 * const appRouter = createNamespacedRouter(t, {
 *   user: userRouter,
 *   settings: settingsRouter,
 * });
 * // Usage: trpc.user.getProfile.query()
 */
export const createNamespacedRouter = <T extends Record<string, AnyRouter>>(
  t: ReturnType<typeof initTRPCWithSuperjson>,
  routers: T,
) => {
  return t.router(routers);
};

export type { ConnectionInfo, ConnectionOptions, ConnectionState } from './connection.js';
// Re-export connection utilities
export {
  ChromeConnectionManager,
  createConnectionStateSubscription,
  createManagedChromeLink,
} from './connection.js';
export type { DebugLogEntry, DebugOptions } from './debug.js';

// Re-export debug utilities
export {
  ChromeDebugger,
  createDebugMiddleware,
  createDebugPanel,
  debugUtils,
  getGlobalDebugger,
  setGlobalDebugger,
} from './debug.js';
export type { PortInfo } from './port-manager.js';
// Re-export port manager utilities
export { ChromePortManager, createPortManager, getBackgroundPortManager } from './port-manager.js';
// Re-export typed port utilities
export {
  connectToTypedPort,
  createPortNames,
  createPortValidator,
  createTypedChromeLink,
  TypedPortRegistry,
} from './typed-ports.js';
