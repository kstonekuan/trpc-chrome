import { type AnyRouter, initTRPC } from '@trpc/server';
import superjson from 'superjson';

/**
 * Creates a tRPC instance with SuperJSON transformer pre-configured
 * for Chrome extension environments.
 */
export const createTRPCForChrome = () => {
  return initTRPC.create({
    transformer: superjson,
    isServer: false,
    allowOutsideOfServer: true,
  });
};

/**
 * Merges multiple routers into a single app router
 */
export const mergeRouters = (first: AnyRouter, ...rest: AnyRouter[]) => {
  const t = createTRPCForChrome();

  return rest.reduce((acc, router) => t.mergeRouters(acc, router), first);
};
