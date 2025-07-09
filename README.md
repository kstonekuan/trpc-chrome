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
import { createTRPCForChrome } from '@kstonekuan/trpc-chrome/utils';

const t = createTRPCForChrome(); // Pre-configured with SuperJSON

const appRouter = t.router({
  // ...procedures
});

export type AppRouter = typeof appRouter;

createChromeHandler({
  router: appRouter,
  createContext: () => ({}), // Required in v11
  onError: ({ error }) => console.error(error), // Required in v11
});
```

**3. Add a `chromeLink` to the client in your content script.**

```typescript
// content.ts
import { createTRPCClient } from '@trpc/client';
import { chromeLink } from '@kstonekuan/trpc-chrome/link';
import superjson from 'superjson'; // Optional: for Date, Map, Set support

import type { AppRouter } from './background';

// Option 1: Named port connection
export const chromeClient = createTRPCClient<AppRouter>({
  links: [
    chromeLink({ 
      portName: 'ui-to-background', // Named port for multi-channel communication
      transformer: superjson, // Optional: must match server transformer
    })
  ],
});

// Option 2: Explicit port connection (legacy)
const port = chrome.runtime.connect();
export const chromeClient2 = createTRPCClient<AppRouter>({
  links: [
    chromeLink({ 
      port,
      transformer: superjson, // Optional: must match server transformer
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
import { createTRPCForChrome, mergeRouters } from '@kstonekuan/trpc-chrome/utils';

const t = createTRPCForChrome(); // Pre-configured with SuperJSON

const userRouter = t.router({
  getProfile: t.procedure.query(() => ({ name: 'John' })),
  updateProfile: t.procedure.input(z.object({ name: z.string() })).mutation(({ input }) => input),
});

const settingsRouter = t.router({
  getTheme: t.procedure.query(() => 'dark'),
  setTheme: t.procedure.input(z.enum(['light', 'dark'])).mutation(({ input }) => input),
});

// Merge multiple routers
const appRouter = mergeRouters(userRouter, settingsRouter);

// Or create namespaced structure
const appRouter2 = t.router({
  user: userRouter,
  settings: settingsRouter,
});

// Usage: trpc.user.getProfile.query()
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

## Example

Please see [full example here](examples/with-plasmo).

_For advanced use-cases, please find examples in our [complete test suite](test)._

## Types

#### ChromeLinkOptions

Please see [full typings here](src/link/index.ts).

| Property      | Type                        | Description                                                      | Required |
| ------------- | --------------------------- | ---------------------------------------------------------------- | -------- |
| `port`        | `chrome.runtime.Port`       | An open web extension port between content & background scripts. | `false`  |
| `portName`    | `string`                    | Name for the port connection (e.g., 'ui-to-background'). If provided, a new port will be created. | `false`  |
| `transformer` | `superjson`                 | Data transformer for serializing/deserializing data (e.g., superjson). | `false`  |

Note: Either `port` or `portName` must be provided, but not both.

#### CreateChromeHandlerOptions

Please see [full typings here](src/adapter/index.ts).

| Property        | Type       | Description                                            | Required |
| --------------- | ---------- | ------------------------------------------------------ | -------- |
| `router`        | `Router`   | Your application tRPC router.                          | `true`   |
| `createContext` | `Function` | Passes contextual (`ctx`) data to procedure resolvers. | `true`   |
| `onError`       | `Function` | Called if error occurs inside handler.                 | `true`   |

---

## License

Distributed under the MIT License. See LICENSE for more information.

## Contact

James Berry - Follow me on Twitter [@jlalmes](https://twitter.com/jlalmes) 💙
