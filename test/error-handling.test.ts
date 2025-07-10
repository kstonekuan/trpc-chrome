import { createTRPCProxyClient } from '@trpc/client';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { createChromeHandler } from '../src/adapter/index.js';
import { chromeLinkWithSuperjson, initTRPCWithSuperjson } from '../src/utils/index.js';
import { resetMocks } from './__setup.js';

// Mock console.error to suppress error output during tests
const originalConsoleError = console.error;

beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  resetMocks();
});

test('handles TRPCError properly', async () => {
  const t = initTRPCWithSuperjson();

  const appRouter = t.router({
    errorQuery: t.procedure.query(() => {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Test error message',
      });
    }),
  });

  const onErrorMock = vi.fn();

  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: onErrorMock,
  });

  // content
  const port = chrome.runtime.connect();
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLinkWithSuperjson({ port })],
  });

  await expect(trpc.errorQuery.query()).rejects.toThrow('Test error message');
  expect(onErrorMock).toHaveBeenCalledWith(
    expect.objectContaining({
      error: expect.objectContaining({
        code: 'BAD_REQUEST',
        message: 'Test error message',
      }),
      type: 'query',
      path: 'errorQuery',
    }),
  );
});

test('handles validation errors', async () => {
  const t = initTRPCWithSuperjson();

  const appRouter = t.router({
    validatedQuery: t.procedure
      .input(z.object({ name: z.string().min(5) }))
      .query(({ input }: { input: { name: string } }) => input),
  });

  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error(error),
  });

  // content
  const port = chrome.runtime.connect();
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLinkWithSuperjson({ port })],
  });

  await expect(trpc.validatedQuery.query({ name: 'hi' })).rejects.toThrow();
});

test('handles observable query errors', async () => {
  const t = initTRPCWithSuperjson();

  const appRouter = t.router({
    errorObservable: t.procedure.query(() => {
      return observable((emit) => {
        // Emit error through the observable
        emit.error(
          new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Observable error',
          }),
        );
      });
    }),
  });

  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error(error),
  });

  // content
  const port = chrome.runtime.connect();
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLinkWithSuperjson({ port })],
  });

  // Observable errors should reject the query promise
  await expect(trpc.errorObservable.query()).rejects.toThrow('Observable error');
});

test('handles port disconnection', async () => {
  const t = initTRPCWithSuperjson();

  const appRouter = t.router({
    testQuery: t.procedure.query(() => 'success'),
  });

  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error(error),
  });

  // content
  const port = chrome.runtime.connect();
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLinkWithSuperjson({ port })],
  });

  // Start query
  const queryPromise = trpc.testQuery.query();

  // Simulate port disconnect immediately
  const disconnectListeners = (port.onDisconnect.addListener as any).mock.calls.map(
    (call: any) => call[0],
  );

  // Trigger disconnect
  disconnectListeners.forEach((listener: any) => listener());

  await expect(queryPromise).rejects.toThrow('Port disconnected prematurely');
});

test('creates default port when none provided', async () => {
  const t = initTRPCWithSuperjson();

  const appRouter = t.router({
    testQuery: t.procedure.query(() => 'success'),
  });

  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error(error),
  });

  // content - no port or portName will create a default port
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLinkWithSuperjson({})],
  });

  // This should work since chromeLink creates a port if none is provided
  const result = await trpc.testQuery.query();
  expect(result).toEqual('success');
});
