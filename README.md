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
import { initTRPC } from '@trpc/server';
import { createChromeHandler } from '@kstonekuan/trpc-chrome/adapter';

const t = initTRPC.create();

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

const port = chrome.runtime.connect();
export const chromeClient = createTRPCClient<AppRouter>({
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

## Example

Please see [full example here](examples/with-plasmo).

_For advanced use-cases, please find examples in our [complete test suite](test)._

## Types

#### ChromeLinkOptions

Please see [full typings here](src/link/index.ts).

| Property      | Type                        | Description                                                      | Required |
| ------------- | --------------------------- | ---------------------------------------------------------------- | -------- |
| `port`        | `chrome.runtime.Port`       | An open web extension port between content & background scripts. | `true`   |
| `transformer` | `CombinedDataTransformer`   | Data transformer for serializing/deserializing data (e.g., superjson). | `false`  |

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
