import { createTRPCProxyClient } from '@trpc/client';
import { initTRPC } from '@trpc/server';
import { afterEach, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { createChromeHandler } from '../src/adapter/index.js';
import { chromeLink } from '../src/link/index.js';
import { resetMocks } from './__setup.js';

afterEach(() => {
  resetMocks();
  vi.clearAllMocks();
});

test('accepts connections when acceptPort returns true', async () => {
  const t = initTRPC.create({ isServer: false, allowOutsideOfServer: true });

  const appRouter = t.router({
    greeting: t.procedure
      .input(z.object({ name: z.string() }))
      .query(({ input }: { input: { name: string } }) => `Hello, ${input.name}!`),
  });

  // background - only accept ports with specific name
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    acceptPort: (port: chrome.runtime.Port) => port.name === 'allowed-port',
  });

  // content - connect with allowed port name
  const port = chrome.runtime.connect({ name: 'allowed-port' });
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLink({ port })],
  });

  const greeting = await trpc.greeting.query({ name: 'World' });
  expect(greeting).toBe('Hello, World!');
  expect(port.disconnect).not.toHaveBeenCalled();
});

test('rejects connections when acceptPort returns false', async () => {
  const t = initTRPC.create({ isServer: false, allowOutsideOfServer: true });

  const appRouter = t.router({
    greeting: t.procedure
      .input(z.object({ name: z.string() }))
      .query(({ input }: { input: { name: string } }) => `Hello, ${input.name}!`),
  });

  // Mock to track disconnect calls
  const disconnectSpy = vi.fn();

  // background - only accept ports with specific name
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    acceptPort: (port: chrome.runtime.Port) => port.name === 'allowed-port',
  });

  // Get the onConnect listener that was registered
  // @ts-expect-error - accessing mock
  const onConnectListener = chrome.runtime.onConnect.addListener.mock.calls[0][0];

  // Simulate a connection with disallowed port
  const mockPort = {
    name: 'disallowed-port',
    postMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
    disconnect: disconnectSpy,
  };

  // Call the handler with the mock port
  onConnectListener(mockPort);

  // Port should be disconnected immediately
  expect(disconnectSpy).toHaveBeenCalled();
});

test('accepts all connections when acceptPort is not provided', async () => {
  const t = initTRPC.create({ isServer: false, allowOutsideOfServer: true });

  const appRouter = t.router({
    greeting: t.procedure
      .input(z.object({ name: z.string() }))
      .query(({ input }: { input: { name: string } }) => `Hello, ${input.name}!`),
  });

  // background - no acceptPort filter
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
  });

  // content - connect with any port name
  const port = chrome.runtime.connect({ name: 'any-port-name' });
  const trpc = createTRPCProxyClient<typeof appRouter>({
    links: [chromeLink({ port })],
  });

  const greeting = await trpc.greeting.query({ name: 'World' });
  expect(greeting).toBe('Hello, World!');
  expect(port.disconnect).not.toHaveBeenCalled();
});

test('can filter based on port sender', async () => {
  const t = initTRPC.create({ isServer: false, allowOutsideOfServer: true });

  const appRouter = t.router({
    greeting: t.procedure
      .input(z.object({ name: z.string() }))
      .query(({ input }: { input: { name: string } }) => `Hello, ${input.name}!`),
  });

  // background - only accept ports from specific extensions
  const allowedExtensionId = 'allowed-extension-id';
  createChromeHandler({
    router: appRouter,
    createContext: () => ({}),
    acceptPort: (port: chrome.runtime.Port) => (port.sender as any)?.id === allowedExtensionId,
  });

  // Get the onConnect listener
  // @ts-expect-error - accessing mock
  const onConnectListener = chrome.runtime.onConnect.addListener.mock.calls[0][0];

  // Create port with allowed sender
  const allowedDisconnectSpy = vi.fn();
  const allowedPort = {
    name: 'test-port',
    sender: { id: allowedExtensionId },
    postMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
    disconnect: allowedDisconnectSpy,
  };
  onConnectListener(allowedPort);

  // Should not disconnect allowed port
  expect(allowedDisconnectSpy).not.toHaveBeenCalled();

  // Create port with disallowed sender
  const disallowedDisconnectSpy = vi.fn();
  const disallowedPort = {
    name: 'test-port',
    sender: { id: 'different-extension-id' },
    postMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
    disconnect: disallowedDisconnectSpy,
  };
  onConnectListener(disallowedPort);

  // Should disconnect disallowed port
  expect(disallowedDisconnectSpy).toHaveBeenCalled();
});
