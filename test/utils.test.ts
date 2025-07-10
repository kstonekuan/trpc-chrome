import { createTRPCProxyClient } from '@trpc/client';
import { afterEach, expect, test } from 'vitest';
import { z } from 'zod';
import { createChromeHandler } from '../src/adapter/index.js';
import {
  chromeLinkWithSuperjson,
  createNamespacedRouter,
  initTRPCWithSuperjson,
} from '../src/utils/index.js';
import { resetMocks } from './__setup.js';

afterEach(() => {
  resetMocks();
});

test('initTRPCWithSuperjson creates instance with SuperJSON', () => {
  const t = initTRPCWithSuperjson();

  // Should have transformer configured
  expect(t._config.transformer).toBeDefined();
  expect(t._config.isServer).toBe(false);
  expect(t._config.allowOutsideOfServer).toBe(true);
});

test('namespaced router with perfect type inference', async () => {
  const t = initTRPCWithSuperjson();

  const userRouter = t.router({
    getUser: t.procedure.query(() => ({ name: 'John' })),
    updateUser: t.procedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }: { input: { name: string } }) => input),
  });

  const settingsRouter = t.router({
    getTheme: t.procedure.query(() => 'dark'),
    setTheme: t.procedure
      .input(z.enum(['light', 'dark']))
      .mutation(({ input }: { input: 'light' | 'dark' }) => input),
  });

  // ✅ Recommended approach - perfect type inference
  const appRouter = t.router({
    user: userRouter,
    settings: settingsRouter,
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

  // Test namespaced procedures
  const user = await trpc.user.getUser.query();
  expect(user).toEqual({ name: 'John' });

  const theme = await trpc.settings.getTheme.query();
  expect(theme).toEqual('dark');

  const updatedUser = await trpc.user.updateUser.mutate({ name: 'Jane' });
  expect(updatedUser).toEqual({ name: 'Jane' });

  const updatedTheme = await trpc.settings.setTheme.mutate('light');
  expect(updatedTheme).toEqual('light');
});

test('createNamespacedRouter helper function', async () => {
  const t = initTRPCWithSuperjson();

  const userRouter = t.router({
    getProfile: t.procedure.query(() => ({ name: 'John' })),
  });

  const settingsRouter = t.router({
    getTheme: t.procedure.query(() => 'dark'),
  });

  // ✅ Using helper function
  const appRouter = createNamespacedRouter(t, {
    user: userRouter,
    settings: settingsRouter,
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

  const user = await trpc.user.getProfile.query();
  expect(user).toEqual({ name: 'John' });

  const theme = await trpc.settings.getTheme.query();
  expect(theme).toEqual('dark');
});

test('deeply nested namespaced routers', async () => {
  const t = initTRPCWithSuperjson();

  const authRouter = t.router({
    login: t.procedure
      .input(z.object({ email: z.string() }))
      .mutation(() => ({ token: 'jwt-token' })),
    logout: t.procedure.mutation(() => ({ success: true })),
  });

  const userRouter = t.router({
    auth: authRouter,
    profile: t.procedure.query(() => ({ name: 'John' })),
  });

  const appRouter = t.router({
    user: userRouter,
    health: t.procedure.query(() => 'ok'),
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

  // Test deeply nested procedures
  const loginResult = await trpc.user.auth.login.mutate({ email: 'test@example.com' });
  expect(loginResult).toEqual({ token: 'jwt-token' });

  const logoutResult = await trpc.user.auth.logout.mutate();
  expect(logoutResult).toEqual({ success: true });

  const profile = await trpc.user.profile.query();
  expect(profile).toEqual({ name: 'John' });

  const health = await trpc.health.query();
  expect(health).toEqual('ok');
});
