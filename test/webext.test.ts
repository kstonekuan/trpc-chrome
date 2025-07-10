import { createTRPCProxyClient } from '@trpc/client';
import { initTRPC } from '@trpc/server';
import { observable, type Unsubscribable } from '@trpc/server/observable';
import { afterEach, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { createChromeHandler } from '../src/adapter/index.js';
import { chromeLink } from '../src/link/index.js';
import { resetMocks } from './__setup.js';

afterEach(() => {
  resetMocks();
});

const t = initTRPC.create();

const appRouter = t.router({
  echoQuery: t.procedure
    .input(z.object({ payload: z.string() }))
    .query(({ input }: { input: { payload: string } }) => input),
  echoMutation: t.procedure
    .input(z.object({ payload: z.string() }))
    .mutation(({ input }: { input: { payload: string } }) => input),
  echoSubscription: t.procedure
    .input(z.object({ payload: z.string() }))
    .subscription(({ input }: { input: { payload: string } }) =>
      observable<typeof input>((emit) => {
        emit.next(input);
      }),
    ),
  nestedRouter: t.router({
    echoQuery: t.procedure
      .input(z.object({ payload: z.string() }))
      .query(({ input }: { input: { payload: string } }) => input),
    echoMutation: t.procedure
      .input(z.object({ payload: z.string() }))
      .mutation(({ input }: { input: { payload: string } }) => input),
    echoSubscription: t.procedure
      .input(z.object({ payload: z.string() }))
      .subscription(({ input }: { input: { payload: string } }) =>
        observable((emit) => {
          emit.next(input);
        }),
      ),
  }),
});

test('with query', async () => {
  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error(error),
  });
  expect(chrome.runtime.onConnect.addListener).toHaveBeenCalledTimes(1);

  // content
  const port = chrome.runtime.connect();
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLink({ port })],
  });

  const data1 = await trpc.echoQuery.query({ payload: 'query1' });
  expect(data1).toEqual({ payload: 'query1' });

  const data2 = await trpc.nestedRouter.echoQuery.query({ payload: 'query2' });
  expect(data2).toEqual({ payload: 'query2' });

  const [data3, data4] = await Promise.all([
    trpc.echoQuery.query({ payload: 'query3' }),
    trpc.echoQuery.query({ payload: 'query4' }),
  ]);
  expect(data3).toEqual({ payload: 'query3' });
  expect(data4).toEqual({ payload: 'query4' });
});

test('with mutation', async () => {
  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error(error),
  });
  expect(chrome.runtime.onConnect.addListener).toHaveBeenCalledTimes(1);

  // content
  const port = chrome.runtime.connect();
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLink({ port })],
  });

  const data1 = await trpc.echoMutation.mutate({ payload: 'mutation1' });
  expect(data1).toEqual({ payload: 'mutation1' });

  const data2 = await trpc.nestedRouter.echoMutation.mutate({ payload: 'mutation2' });
  expect(data2).toEqual({ payload: 'mutation2' });

  const [data3, data4] = await Promise.all([
    trpc.echoMutation.mutate({ payload: 'mutation3' }),
    trpc.echoMutation.mutate({ payload: 'mutation4' }),
  ]);
  expect(data3).toEqual({ payload: 'mutation3' });
  expect(data4).toEqual({ payload: 'mutation4' });
});

test('with subscription', async () => {
  // background
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error }: { error: any }) => console.error(error),
  });
  expect(chrome.runtime.onConnect.addListener).toHaveBeenCalledTimes(1);

  // content
  const port = chrome.runtime.connect();
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLink({ port })],
  });

  const onDataMock = vi.fn();
  const onCompleteMock = vi.fn();
  const onErrorMock = vi.fn();
  const onStartedMock = vi.fn();
  const onStoppedMock = vi.fn();
  const subscription = await new Promise<Unsubscribable>((resolve) => {
    const subscription = trpc.echoSubscription.subscribe(
      { payload: 'subscription1' },
      {
        onData: (data) => {
          onDataMock(data);
          resolve(subscription);
        },
        onComplete: onCompleteMock,
        onError: onErrorMock,
        onStarted: onStartedMock,
        onStopped: onStoppedMock,
      },
    );
  });
  expect(onDataMock).toHaveBeenCalledTimes(1);
  expect(onDataMock).toHaveBeenNthCalledWith(1, { payload: 'subscription1' });
  expect(onCompleteMock).toHaveBeenCalledTimes(0);
  expect(onErrorMock).toHaveBeenCalledTimes(0);
  expect(onStartedMock).toHaveBeenCalledTimes(1);
  expect(onStoppedMock).toHaveBeenCalledTimes(0);
  subscription.unsubscribe();
  expect(onDataMock).toHaveBeenCalledTimes(1);
  expect(onCompleteMock).toHaveBeenCalledTimes(1);
  expect(onErrorMock).toHaveBeenCalledTimes(0);
  expect(onStartedMock).toHaveBeenCalledTimes(1);
  expect(onStoppedMock).toHaveBeenCalledTimes(1);
});

// with subscription
// with error
// with createcontext
// with output
// with multiport
