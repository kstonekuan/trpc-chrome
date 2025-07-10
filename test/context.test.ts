import { createTRPCClient } from '@trpc/client';
import { afterEach, expect, test } from 'vitest';
import { createChromeHandler } from '../src/adapter/index.js';
import { chromeLinkWithSuperjson, initTRPCWithSuperjson } from '../src/utils/index.js';
import { resetMocks } from './__setup.js';

afterEach(() => {
  resetMocks();
});

test('initTRPCWithSuperjson supports context', async () => {
  // Define context type
  type Context = {
    userId: string;
    isAdmin: boolean;
  };

  // Create tRPC instance with context
  const t = initTRPCWithSuperjson<Context>();

  const appRouter = t.router({
    // Procedure that uses context
    whoami: t.procedure.query(({ ctx }) => {
      return {
        userId: ctx.userId,
        isAdmin: ctx.isAdmin,
      };
    }),
    // Protected procedure
    adminOnly: t.procedure.query(({ ctx }) => {
      if (!ctx.isAdmin) {
        throw new Error('Unauthorized');
      }
      return 'Secret admin data';
    }),
  });

  // Background script setup
  createChromeHandler({
    router: appRouter,
    createContext: () => {
      // In real app, you'd extract this from port.sender or storage
      return {
        userId: 'user-123',
        isAdmin: true,
      };
    },
    onError: ({ error }) => console.error(error),
  });

  // Content script
  const chromeClient = createTRPCClient<typeof appRouter>({
    links: [chromeLinkWithSuperjson()],
  });

  // Test context is accessible
  const result = await chromeClient.whoami.query();
  expect(result).toEqual({
    userId: 'user-123',
    isAdmin: true,
  });

  // Test admin access works
  const adminResult = await chromeClient.adminOnly.query();
  expect(adminResult).toBe('Secret admin data');
});

test('initTRPCWithSuperjson works without context', async () => {
  // Create tRPC without context (default)
  const t = initTRPCWithSuperjson();

  const appRouter = t.router({
    hello: t.procedure.query(() => 'world'),
  });

  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }) => console.error(error),
  });

  const chromeClient = createTRPCClient<typeof appRouter>({
    links: [chromeLinkWithSuperjson()],
  });

  const result = await chromeClient.hello.query();
  expect(result).toBe('world');
});
