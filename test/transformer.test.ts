import { createTRPCProxyClient } from '@trpc/client';
import { afterEach, expect, test } from 'vitest';
import { z } from 'zod';
import { createChromeHandler } from '../src/adapter/index.js';
import { chromeLinkWithSuperjson, initTRPCWithSuperjson } from '../src/utils/index.js';
import { resetMocks } from './__setup.js';

afterEach(() => {
  resetMocks();
});

test('SuperJSON transformer with complex types', async () => {
  const t = initTRPCWithSuperjson(); // Pre-configured with SuperJSON

  const appRouter = t.router({
    complexQuery: t.procedure
      .input(
        z.object({
          date: z.date(),
          data: z.record(z.any()),
        }),
      )
      .query(({ input }: { input: { date: Date; data: Record<string, any> } }) => ({
        receivedDate: input.date,
        processedAt: new Date('2023-01-01T12:00:00Z'),
        data: input.data,
        map: new Map([['key', 'value']]),
        set: new Set([1, 2, 3]),
        bigInt: BigInt(123),
        undefined: undefined,
        regex: /test/g,
      })),
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

  const testDate = new Date('2023-01-01T00:00:00Z');
  const testData = { nested: { value: 42 } };

  const result = (await trpc.complexQuery.query({
    date: testDate,
    data: testData,
  })) as any;

  // Verify complex types are properly serialized/deserialized
  expect(result.receivedDate).toBeInstanceOf(Date);
  expect(result.receivedDate.getTime()).toBe(testDate.getTime());
  expect(result.processedAt).toBeInstanceOf(Date);
  expect(result.map).toBeInstanceOf(Map);
  expect(result.map.get('key')).toBe('value');
  expect(result.set).toBeInstanceOf(Set);
  expect(result.set.has(1)).toBe(true);
  expect(result.bigInt).toBe(BigInt(123));
  expect(result.undefined).toBeUndefined();
  expect(result.regex).toBeInstanceOf(RegExp);
  expect(result.regex.test('test')).toBe(true);
});

test('transformer works with Date objects', async () => {
  const t = initTRPCWithSuperjson(); // Pre-configured with SuperJSON

  const appRouter = t.router({
    dateQuery: t.procedure.input(z.date()).query(({ input }: { input: Date }) => ({
      received: input,
      processed: new Date('2023-01-01T12:00:00Z'),
    })),
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

  const testDate = new Date('2023-01-01T00:00:00Z');
  const result = (await trpc.dateQuery.query(testDate)) as any;

  expect(result.received).toBeInstanceOf(Date);
  expect(result.received.getTime()).toBe(testDate.getTime());
  expect(result.processed).toBeInstanceOf(Date);
});

test('works with simple types without transformer issues', async () => {
  const t = initTRPCWithSuperjson(); // Pre-configured with SuperJSON

  const appRouter = t.router({
    stringQuery: t.procedure
      .input(z.string())
      .query(({ input }: { input: string }) => `processed: ${input}`),
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

  const result = await trpc.stringQuery.query('test');
  expect(result).toEqual('processed: test');
});
