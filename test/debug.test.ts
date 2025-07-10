import { createTRPCProxyClient } from '@trpc/client';
import { initTRPC } from '@trpc/server';
import { afterEach, expect, test } from 'vitest';
import { z } from 'zod';
import { createChromeHandler } from '../src/adapter/index.js';
import { chromeLink } from '../src/link/index.js';
import { chromeLinkWithSuperjson, initTRPCWithSuperjson } from '../src/utils/index.js';
import { resetMocks } from './__setup.js';

afterEach(() => {
  resetMocks();
});

test('debug simple mutation with regular tRPC', async () => {
  const t = initTRPC.create();

  const appRouter = t.router({
    simpleMutation: t.procedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }: { input: { name: string } }) => {
        return input;
      }),
  });

  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error('Handler error:', error),
  });

  // content
  const port = chrome.runtime.connect();
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLink({ port })],
  });

  const result = await trpc.simpleMutation.mutate({ name: 'test' });
  expect(result).toEqual({ name: 'test' });
});

test('debug simple mutation with SuperJSON', async () => {
  const t = initTRPCWithSuperjson();

  const appRouter = t.router({
    simpleMutation: t.procedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }: { input: { name: string } }) => {
        return input;
      }),
  });

  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error('Handler error:', error),
  });

  // content
  const port = chrome.runtime.connect();
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLinkWithSuperjson({ port })],
  });

  const result = await trpc.simpleMutation.mutate({ name: 'test' });
  expect(result).toEqual({ name: 'test' });
});
