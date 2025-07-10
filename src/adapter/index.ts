import {
  type AnyProcedure,
  type AnyRouter,
  getErrorShape,
  type ProcedureType,
  TRPCError,
} from '@trpc/server';
import { isObservable, type Unsubscribable } from '@trpc/server/observable';

import type { TRPCChromeRequest, TRPCChromeResponse } from '../types/index.js';
import { createDebugMiddleware } from '../utils/debug.js';
import { getErrorFromUnknown } from './errors.js';

export type CreateChromeContextOptions = {
  req: chrome.runtime.Port;
  res: undefined;
};

export type CreateChromeHandlerOptions<TRouter extends AnyRouter> = {
  router: TRouter;
  createContext?: (opts: CreateChromeContextOptions & { info?: any }) => Promise<any> | any;
  onError?: (opts: {
    error: TRPCError;
    type: ProcedureType;
    path: string | undefined;
    input: unknown;
    ctx: unknown;
    req: chrome.runtime.Port;
  }) => void;
  debug?: boolean | import('../utils/debug.js').DebugOptions;
};

export const createChromeHandler = <TRouter extends AnyRouter>(
  opts: CreateChromeHandlerOptions<TRouter>,
) => {
  const { router, createContext, onError, debug } = opts;
  const { transformer } = router._def._config;

  // Set up debug mode
  const debugMiddleware = debug
    ? createDebugMiddleware(typeof debug === 'boolean' ? { enabled: debug } : debug)
    : null;

  chrome.runtime.onConnect.addListener((port) => {
    const subscriptions = new Map<number | string, Unsubscribable>();
    const listeners: (() => void)[] = [];

    const onDisconnect = () => {
      listeners.forEach((unsub) => unsub());
    };

    port.onDisconnect.addListener(onDisconnect);
    listeners.push(() => port.onDisconnect.removeListener(onDisconnect));

    const onMessage = async (message: TRPCChromeRequest) => {
      if (!('trpc' in message)) return;
      const { trpc } = message;
      if (!('id' in trpc) || trpc.id === null || trpc.id === undefined) return;
      if (!trpc) return;

      const { id, jsonrpc, method } = trpc;

      // Log request
      debugMiddleware?.onRequest(port, message);

      const sendResponse = (response: TRPCChromeResponse['trpc']) => {
        const fullResponse = {
          trpc: { id, jsonrpc, ...response },
        } as TRPCChromeResponse;

        // Log response
        debugMiddleware?.onResponse(port, fullResponse);

        port.postMessage(fullResponse);
      };

      let params: { path: string; input: unknown } | undefined;
      let input: any;
      let ctx: any;

      try {
        if (method === 'subscription.stop') {
          const subscription = subscriptions.get(id);
          if (subscription) {
            subscription.unsubscribe();
            sendResponse({
              result: {
                type: 'stopped',
              },
            });
          }
          subscriptions.delete(id);
          return;
        }

        params = trpc.params as { path: string; input: unknown } | undefined;
        if (!params) {
          throw new TRPCError({
            message: 'Missing params in request',
            code: 'BAD_REQUEST',
          });
        }

        input =
          params.input !== undefined ? transformer.input.deserialize(params.input) : undefined;

        ctx = await createContext?.({
          req: port,
          res: undefined,
          info: {
            isBatchCall: false,
            accept: 'application/jsonl',
            type: 'query',
            calls: [],
            connectionParams: null,
            signal: new AbortController().signal,
            rawInput: input,
          },
        });
        const caller = router.createCaller(ctx);

        const segments = params.path.split('.');
        const procedureFn = segments.reduce(
          (acc, segment) => acc[segment],
          caller as any,
        ) as AnyProcedure;

        const result = await procedureFn(input);

        // Check if result is observable (for any procedure type)
        if (isObservable(result)) {
          // Handle observable results - this supports both:
          // 1. Legacy .subscription() procedures
          // 2. Modern .query()/.mutation() that return observables
          const subscription = result.subscribe({
            next: (data: any) => {
              const serializedData = transformer.output.serialize(data);
              sendResponse({
                result: {
                  type: 'data',
                  data: serializedData,
                },
              });
            },
            error: (cause: any) => {
              const error = getErrorFromUnknown(cause);

              onError?.({
                error,
                type: method,
                path: params?.path,
                input,
                ctx,
                req: port,
              });

              debugMiddleware?.onError(port, error, { path: params?.path, method });

              sendResponse({
                error: getErrorShape({
                  config: router._def._config,
                  error,
                  type: method,
                  path: params?.path,
                  input,
                  ctx,
                }),
              });
            },
            complete: () => {
              sendResponse({
                result: {
                  type: 'stopped',
                },
              });
            },
          });

          if (subscriptions.has(id)) {
            subscription.unsubscribe();
            sendResponse({
              result: {
                type: 'stopped',
              },
            });
            throw new TRPCError({
              message: `Duplicate id ${id}`,
              code: 'BAD_REQUEST',
            });
          }
          listeners.push(() => subscription.unsubscribe());

          subscriptions.set(id, subscription);

          sendResponse({
            result: {
              type: 'started',
            },
          });
          return;
        } else {
          // Non-observable result - regular query/mutation
          const data = transformer.output.serialize(result);
          sendResponse({
            result: {
              type: 'data',
              data,
            },
          });
          return;
        }
      } catch (cause) {
        const error = getErrorFromUnknown(cause);

        onError?.({
          error,
          type: method as ProcedureType,
          path: params?.path,
          input,
          ctx,
          req: port,
        });

        debugMiddleware?.onError(port, error, { path: params?.path, method });

        sendResponse({
          error: getErrorShape({
            config: router._def._config,
            error,
            type: method as ProcedureType,
            path: params?.path,
            input,
            ctx,
          }),
        });
      }
    };

    port.onMessage.addListener(onMessage);
    listeners.push(() => port.onMessage.removeListener(onMessage));
  });
};
