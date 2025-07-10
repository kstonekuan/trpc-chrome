import { createTRPCProxyClient } from '@trpc/client';
import { initTRPC } from '@trpc/server';
import { afterEach, expect, test } from 'vitest';
import { z } from 'zod';
import { createChromeHandler } from '../src/adapter/index.js';
import { chromeLink } from '../src/link/index.js';
import { resetMocks } from './__setup.js';

afterEach(() => {
  resetMocks();
});

const t = initTRPC.create();

const appRouter = t.router({
  testQuery: t.procedure
    .input(z.object({ payload: z.string() }))
    .query(({ input }: { input: { payload: string } }) => input),
});

test('named port connection', async () => {
  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error(error),
  });

  // content - using named port
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLink({ portName: 'test-port' })],
  });

  const data = await trpc.testQuery.query({ payload: 'named-port-test' });
  expect(data).toEqual({ payload: 'named-port-test' });

  // Verify chrome.runtime.connect was called with correct name
  expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: 'test-port' });
});

test('named port with undefined name', async () => {
  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error(error),
  });

  // content - using named port with undefined name
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLink({ portName: undefined })],
  });

  const data = await trpc.testQuery.query({ payload: 'unnamed-port-test' });
  expect(data).toEqual({ payload: 'unnamed-port-test' });

  // Verify chrome.runtime.connect was called without name
  expect(chrome.runtime.connect).toHaveBeenCalledWith(undefined);
});

test('explicit port takes precedence over portName', async () => {
  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error(error),
  });

  // content - explicit port should take precedence
  const explicitPort = chrome.runtime.connect();
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLink({ port: explicitPort, portName: 'should-be-ignored' })],
  });

  const data = await trpc.testQuery.query({ payload: 'explicit-port-test' });
  expect(data).toEqual({ payload: 'explicit-port-test' });
});
