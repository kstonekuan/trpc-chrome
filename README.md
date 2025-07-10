![trpc-chrome](assets/trpc-chrome-readme.png)

<div align="center">
  <h1>@kstonekuan/trpc-chrome</h1>
  <a href="https://www.npmjs.com/package/@kstonekuan/trpc-chrome"><img src="https://img.shields.io/npm/v/@kstonekuan/trpc-chrome.svg?style=flat&color=brightgreen" target="_blank" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-black" /></a>
  <a href="https://trpc.io/discord" target="_blank"><img src="https://img.shields.io/badge/chat-discord-blue.svg" /></a>
  <br />
  <hr />
</div>

> **Fork of [trpc-chrome](https://github.com/jlalmes/trpc-chrome) with updated dependencies**
> 
> The original `trpc-chrome` repository is no longer actively maintained. This fork provides:
> - ✅ **tRPC v11 support** - Updated from v10 to latest v11.4.3
> - ✅ **Modern build system** - Vite with dual ESM/CJS output
> - ✅ **Updated dependencies** - All dependencies updated to latest versions
> - ✅ **Biome integration** - Modern linting and formatting
> - ✅ **Better DX** - Watch mode, source maps, improved error handling
> - ✅ **Debug mode** - Chrome DevTools integration for request/response logging
> - ✅ **Connection management** - Auto-reconnect and connection state monitoring
> - ✅ **Port management** - Centralized port handling for complex extensions
> - ✅ **Type-safe ports** - Compile-time and runtime port name validation

## **[Chrome extension](https://developer.chrome.com/docs/extensions/mv3/) support for [tRPC](https://trpc.io/)** 🧩

- Easy communication for web extensions.
- Typesafe messaging between content & background scripts.
- Ready for Manifest V3.

## Usage

**1. Install `@kstonekuan/trpc-chrome`.**

```bash
# npm
npm install @kstonekuan/trpc-chrome
# yarn
yarn add @kstonekuan/trpc-chrome
```

**2. Add `createChromeHandler` in your background script.**

```typescript
// background.ts
import { createChromeHandler } from '@kstonekuan/trpc-chrome/adapter';
import { initTRPCWithSuperjson } from '@kstonekuan/trpc-chrome/utils';

// Define your context type
type Context = {
  userId?: string;
  // Add other context properties as needed
};

const t = initTRPCWithSuperjson<Context>(); // Pre-configured with SuperJSON and context

const appRouter = t.router({
  // ...procedures
});

export type AppRouter = typeof appRouter;

createChromeHandler({
  router: appRouter,
  createContext: ({ req }) => {
    // req is the chrome.runtime.Port
    // You can extract user info, permissions, etc.
    return {
      userId: 'user-123', // Example: get from storage or port sender
    };
  },
  onError: ({ error }) => console.error(error),
});
```

**3. Add a `chromeLinkWithSuperjson` to the client in your content script.**

```typescript
// content.ts
import { createTRPCClient } from '@trpc/client';
import { chromeLinkWithSuperjson } from '@kstonekuan/trpc-chrome/utils';

import type { AppRouter } from './background';

// Option 1: Named port connection (recommended)
export const chromeClient = createTRPCClient<AppRouter>({
  links: [
    chromeLinkWithSuperjson({ 
      portName: 'ui-to-background', // Named port for multi-channel communication
    })
  ],
});

// Option 2: Explicit port connection
const port = chrome.runtime.connect();
export const chromeClient2 = createTRPCClient<AppRouter>({
  links: [
    chromeLinkWithSuperjson({ 
      port,
    })
  ],
});
```

> **Type Safety Note**: When using `initTRPCWithSuperjson()` on the server, always use `chromeLinkWithSuperjson()` on the client. This ensures the transformers match and your Date, Map, Set, and other complex types are properly serialized.

### Using Custom Transformers

If you need to use a different transformer or no transformer at all:

```typescript
// background.ts
import { initTRPC } from '@trpc/server';
import { createChromeHandler } from '@kstonekuan/trpc-chrome/adapter';

const t = initTRPC.create({
  // Custom transformer or none
  transformer: myCustomTransformer, // or omit for no transformer
});

// content.ts
import { chromeLink } from '@kstonekuan/trpc-chrome/link';

const chromeClient = createTRPCClient<AppRouter>({
  links: [
    chromeLink({ 
      portName: 'ui-to-background',
      transformer: myCustomTransformer, // Must match server!
    })
  ],
});
```

## Requirements

Peer dependencies:

- [`tRPC`](https://github.com/trpc/trpc) Server v11 (`@trpc/server`) must be installed.
- [`tRPC`](https://github.com/trpc/trpc) Client v11 (`@trpc/client`) must be installed.

## Advanced Features

### Router Composition

```typescript
// background.ts
import { initTRPCWithSuperjson, createNamespacedRouter } from '@kstonekuan/trpc-chrome/utils';

type Context = {
  userId: string;
  permissions: string[];
};

const t = initTRPCWithSuperjson<Context>(); // Pre-configured with SuperJSON and context

const userRouter = t.router({
  getProfile: t.procedure.query(({ ctx }) => {
    // Access context here
    return { name: 'John', userId: ctx.userId };
  }),
  updateProfile: t.procedure
    .input(z.object({ name: z.string() }))
    .mutation(({ input, ctx }) => {
      // Check permissions from context
      if (!ctx.permissions.includes('edit:profile')) {
        throw new Error('Unauthorized');
      }
      return input;
    }),
});

const settingsRouter = t.router({
  getTheme: t.procedure.query(() => 'dark'),
  setTheme: t.procedure.input(z.enum(['light', 'dark'])).mutation(({ input }) => input),
});

// ✅ Recommended: Namespaced router with perfect type inference
const appRouter = t.router({
  user: userRouter,
  settings: settingsRouter,
});

// ✅ Alternative: Using helper function
const appRouter2 = createNamespacedRouter(t, {
  user: userRouter,
  settings: settingsRouter,
});

// Usage: trpc.user.getProfile.query(), trpc.settings.getTheme.query()
```

### Multi-Channel Communication

```typescript
// Different communication channels for complex extensions
const uiClient = createTRPCClient<AppRouter>({
  links: [chromeLink({ portName: 'ui-to-background' })],
});

const offscreenClient = createTRPCClient<AppRouter>({
  links: [chromeLink({ portName: 'background-to-offscreen' })],
});

const contentClient = createTRPCClient<AppRouter>({
  links: [chromeLink({ portName: 'content-to-background' })],
});
```

### Lazy Loading with Dynamic Imports

```typescript
const heavyProcedure = t.procedure
  .input(z.string())
  .mutation(async ({ input }) => {
    // Lazy-loaded handler
    const { handleHeavyOperation } = await import('./heavy-handler');
    return handleHeavyOperation(input);
  });
```

### Debug Mode with Chrome DevTools Integration

```typescript
// background.ts
import { createChromeHandler } from '@kstonekuan/trpc-chrome/adapter';

// Enable debug mode for development
createChromeHandler({
  router: appRouter,
  createContext: () => ({}),
  onError: ({ error }) => console.error(error),
  debug: true, // Enable debug logging
});

// Or with custom configuration
createChromeHandler({
  router: appRouter,
  createContext: () => ({}),
  onError: ({ error }) => console.error(error),
  debug: {
    enabled: true,
    logStyle: 'detailed', // 'simple' | 'detailed'
    colorize: true,
    measurePerformance: true,
    filter: (entry) => {
      // Filter out specific requests
      return entry.path !== 'heartbeat';
    },
  },
});

// Debug logs appear in Chrome DevTools console with:
// - Request/response timing
// - Procedure paths and methods
// - Input/output data
// - Error stack traces
```

### Port Management

```typescript
import { ChromePortManager } from '@kstonekuan/trpc-chrome/utils';

// Create a port manager for centralized connection handling
const portManager = new ChromePortManager();

// Get or create a port connection
const port = portManager.getPort('main-connection');

// Monitor connection state
portManager.onConnect('main-connection', (port) => {
  console.log('Port connected:', port.name);
});

portManager.onDisconnect('main-connection', (port) => {
  console.log('Port disconnected:', port.name);
});

// Check active connections
const activePorts = portManager.getActivePorts();
console.log(`Active connections: ${activePorts.length}`);
```

### Connection State Management with Auto-Reconnect

```typescript
import { createManagedChromeLink } from '@kstonekuan/trpc-chrome/utils';

// Create a link with automatic reconnection
const managedLink = createManagedChromeLink({
  portName: 'stable-connection',
  transformer: superjson,
  maxReconnectAttempts: 5,
  reconnectInterval: 1000,
  onStateChange: (state) => {
    console.log(`Connection state: ${state}`);
    // Handle UI updates based on connection state
  },
});

const chromeClient = createTRPCClient<AppRouter>({
  links: [managedLink],
});
```

### Type-Safe Port Names

```typescript
import { createPortNames, TypedPortRegistry } from '@kstonekuan/trpc-chrome/utils';

// Define your port names with full type safety
const PortNames = createPortNames([
  'content-to-background',
  'popup-to-background',
  'devtools-to-background',
  'options-to-background',
] as const);

// Use typed port names throughout your extension
const contentPort = chrome.runtime.connect({ 
  name: PortNames.contentToBackground // Type-safe!
});

// Create a typed registry for managing multiple ports
const portRegistry = new TypedPortRegistry(PortNames);

// Connect with type-safe keys
const port = portRegistry.connect('contentToBackground');

// Create typed links
const contentClient = createTRPCClient<AppRouter>({
  links: [portRegistry.createLink('contentToBackground', { transformer: superjson })],
});

const popupClient = createTRPCClient<AppRouter>({
  links: [portRegistry.createLink('popupToBackground', { transformer: superjson })],
});

// Validate port names at runtime
import { createPortValidator } from '@kstonekuan/trpc-chrome/utils';

const validator = createPortValidator(['content-to-background', 'popup-to-background'] as const);

chrome.runtime.onConnect.addListener((port) => {
  if (validator.isValid(port.name)) {
    // Handle known port types
    console.log(`Valid port connected: ${port.name}`);
  }
});
```

### Debug Panel for Development

```typescript
import { createDebugPanel, getGlobalDebugger } from '@kstonekuan/trpc-chrome/utils';

// Create a debug panel (usually in your extension's devtools or popup)
const cleanup = createDebugPanel(document.getElementById('debug-container'));

// Access debug logs programmatically
const debugger = getGlobalDebugger();
const logs = debugger?.getLogs() || [];
console.log('Total requests:', logs.length);

// Filter logs
const errors = logs.filter(log => log.type === 'error');
console.log('Errors:', errors);

// Clear logs
debugger?.clearLogs();

// Cleanup when done
cleanup();
```

### Helper Utilities

For better type safety and consistency, we provide pre-configured helpers:

```typescript
// Server-side: Pre-configured tRPC with SuperJSON
import { initTRPCWithSuperjson } from '@kstonekuan/trpc-chrome/utils';
const t = initTRPCWithSuperjson();

// Client-side: Matching Chrome link with SuperJSON
import { chromeLinkWithSuperjson } from '@kstonekuan/trpc-chrome/utils';
const trpc = createTRPCClient<AppRouter>({
  links: [
    chromeLinkWithSuperjson({ 
      portName: 'my-connection'
      // transformer is already set to superjson
    })
  ],
});
```

These helpers ensure your transformers always match between server and client.

### TypeScript Best Practices

For maximum type safety when using transformers:

1. **Always use matching pairs**:
   - `initTRPCWithSuperjson()` + `chromeLinkWithSuperjson()`
   - `initTRPC.create()` + `chromeLink()` (with same transformer)

2. **Avoid transformer mismatches** which cause runtime errors:
   ```typescript
   // ❌ BAD: Mismatched transformers
   const t = initTRPCWithSuperjson(); // Uses SuperJSON
   // ...
   chromeLink({ portName: 'port' }) // No transformer!
   
   // ✅ GOOD: Matching transformers
   const t = initTRPCWithSuperjson(); // Uses SuperJSON
   // ...
   chromeLinkWithSuperjson({ portName: 'port' }) // Also uses SuperJSON
   ```

## Real-time Data with Observables (tRPC v11)

tRPC v11 allows any procedure (query/mutation) to return observables for real-time data:

```typescript
// background.ts
import { observable } from '@trpc/server/observable';

const appRouter = t.router({
  // Real-time data stream
  watchPrice: t.procedure
    .input(z.object({ symbol: z.string() }))
    .query(({ input }) => {
      return observable<{ price: number; timestamp: Date }>((emit) => {
        // Initial price
        emit.next({ price: 100, timestamp: new Date() });
        
        // Simulate price updates
        const interval = setInterval(() => {
          const price = 100 + Math.random() * 10;
          emit.next({ price, timestamp: new Date() });
        }, 1000);
        
        // Cleanup on unsubscribe
        return () => clearInterval(interval);
      });
    }),
    
  // Long-running operation with progress
  processLargeFile: t.procedure
    .input(z.object({ fileId: z.string() }))
    .mutation(({ input }) => {
      return observable<{ progress: number; status: string }>((emit) => {
        emit.next({ progress: 0, status: 'Starting...' });
        
        // Simulate processing
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          emit.next({ progress, status: `Processing... ${progress}%` });
          
          if (progress >= 100) {
            emit.next({ progress: 100, status: 'Complete!' });
            clearInterval(interval);
            emit.complete();
          }
        }, 500);
        
        return () => clearInterval(interval);
      });
    }),
});

// content.ts - The adapter automatically handles observable streaming
// Just call .query() or .mutate() as normal - the adapter detects observables
const priceData = await client.watchPrice.query({ symbol: 'BTC' });
console.log('Initial price:', priceData);

// For progress tracking
const result = await client.processLargeFile.mutate({ fileId: 'abc123' });
console.log('Processing complete:', result);
```

## Example

Please see [full example here](examples/with-plasmo).

_For advanced use-cases, please find examples in our [complete test suite](test)._

## Types

#### ChromeLinkOptions

Please see [full typings here](src/link/index.ts).

| Property      | Type                  | Description                                                                                       | Required |
| ------------- | --------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| `port`        | `chrome.runtime.Port` | An open web extension port between content & background scripts.                                  | `false`  |
| `portName`    | `string`              | Name for the port connection (e.g., 'ui-to-background'). If provided, a new port will be created. | `false`  |
| `transformer` | `superjson`           | Data transformer for serializing/deserializing data (e.g., superjson).                            | `false`  |

Note: Either `port` or `portName` must be provided, but not both.

#### CreateChromeHandlerOptions

Please see [full typings here](src/adapter/index.ts).

| Property        | Type       | Description                                            | Required |
| --------------- | ---------- | ------------------------------------------------------ | -------- |
| `router`        | `Router`   | Your application tRPC router.                          | `true`   |
| `createContext` | `Function` | Passes contextual (`ctx`) data to procedure resolvers. | `true`   |
| `onError`       | `Function` | Called if error occurs inside handler.                 | `true`   |
| `debug`         | `boolean \| DebugOptions` | Enable debug logging with Chrome DevTools integration. | `false`  |

---

## License

Distributed under the MIT License. See LICENSE for more information.