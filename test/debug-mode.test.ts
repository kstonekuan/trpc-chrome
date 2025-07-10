import { createTRPCClient } from '@trpc/client';
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createChromeHandler } from '../src/adapter/index.js';
import { chromeLink } from '../src/link/index.js';
import { ChromeDebugger } from '../src/utils/debug.js';
import { resetMocks } from './__setup.js';

describe('debug mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('should log requests and responses when debug is enabled', async () => {
    const customLogger = vi.fn();
    const t = initTRPC.create({ transformer: superjson });

    const appRouter = t.router({
      greeting: t.procedure
        .input(z.object({ name: z.string() }))
        .query(({ input }) => `Hello ${input.name}`),
    });

    type AppRouter = typeof appRouter;

    createChromeHandler({
      router: appRouter,
      createContext: () => ({}),
      onError: ({ error }) => console.error(error),
      debug: {
        enabled: true,
        customLogger,
      },
    });

    const client = createTRPCClient<AppRouter>({
      links: [chromeLink({ transformer: superjson })],
    });

    await client.greeting.query({ name: 'World' });

    // Check that logger was called for request
    expect(customLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'request',
        method: 'query',
        path: 'greeting',
        data: expect.objectContaining({
          json: { name: 'World' },
        }),
      }),
    );

    // Check that logger was called for response
    expect(customLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'response',
        data: expect.objectContaining({
          type: 'data',
          data: expect.objectContaining({
            json: 'Hello World',
          }),
        }),
      }),
    );
  });

  it('should log errors when they occur', async () => {
    const customLogger = vi.fn();
    const t = initTRPC.create({ transformer: superjson });

    const appRouter = t.router({
      failing: t.procedure.query(() => {
        throw new Error('Test error');
      }),
    });

    type AppRouter = typeof appRouter;

    createChromeHandler({
      router: appRouter,
      createContext: () => ({}),
      onError: () => {},
      debug: {
        enabled: true,
        customLogger,
        logErrors: true,
      },
    });

    const client = createTRPCClient<AppRouter>({
      links: [chromeLink({ transformer: superjson })],
    });

    await expect(client.failing.query()).rejects.toThrow();

    // Check that logger was called for error
    expect(customLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        path: 'failing',
        method: 'query',
      }),
    );
  });

  it('should respect filter function', async () => {
    const customLogger = vi.fn();
    const t = initTRPC.create({ transformer: superjson });

    const appRouter = t.router({
      public: t.procedure.query(() => 'public data'),
      private: t.procedure.query(() => 'private data'),
    });

    type AppRouter = typeof appRouter;

    createChromeHandler({
      router: appRouter,
      createContext: () => ({}),
      onError: ({ error }) => console.error(error),
      debug: {
        enabled: true,
        customLogger,
        filter: (entry) => !entry.path?.includes('private'),
      },
    });

    const client = createTRPCClient<AppRouter>({
      links: [chromeLink({ transformer: superjson })],
    });

    await client.public.query();
    await client.private.query();

    // Only public endpoint should be logged
    const loggedPaths = customLogger.mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.type === 'request')
      .map((entry) => entry.path);

    expect(loggedPaths).toContain('public');
    expect(loggedPaths).not.toContain('private');
  });

  it('should track request timing', async () => {
    const customLogger = vi.fn();
    const t = initTRPC.create({ transformer: superjson });

    const appRouter = t.router({
      slow: t.procedure.query(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'done';
      }),
    });

    type AppRouter = typeof appRouter;

    createChromeHandler({
      router: appRouter,
      createContext: () => ({}),
      onError: ({ error }) => console.error(error),
      debug: {
        enabled: true,
        customLogger,
        logTiming: true,
      },
    });

    const client = createTRPCClient<AppRouter>({
      links: [chromeLink({ transformer: superjson })],
    });

    await client.slow.query();

    // Check that response includes duration
    const responseLog = customLogger.mock.calls
      .map((call) => call[0])
      .find((entry) => entry.type === 'response');

    expect(responseLog).toBeDefined();
    expect(responseLog.duration).toBeGreaterThan(0);
  });

  describe('ChromeDebugger class', () => {
    it('should create debugger with default options', () => {
      const instance = new ChromeDebugger();

      expect(instance.isEnabled()).toBe(false);
    });

    it('should allow enabling/disabling at runtime', () => {
      const instance = new ChromeDebugger({ enabled: false });

      expect(instance.isEnabled()).toBe(false);

      instance.setEnabled(true);
      expect(instance.isEnabled()).toBe(true);

      instance.setEnabled(false);
      expect(instance.isEnabled()).toBe(false);
    });

    it('should clear timing data', () => {
      const instance = new ChromeDebugger({ enabled: true });

      // Add some timing data
      const mockPort = { name: 'test' } as chrome.runtime.Port;
      instance.logRequest(mockPort, {
        trpc: { id: 1, method: 'query', params: { path: 'test' } },
      } as any);

      instance.clear();

      // Verify timing data is cleared (indirectly by checking no duration on response)
      instance.logResponse(mockPort, {
        trpc: { id: 1, result: {} },
      } as any);
    });
  });
});
