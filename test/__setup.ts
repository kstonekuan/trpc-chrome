import { vi } from 'vitest';

type OnMessageListener = (message: any) => void;
type OnConnectListener = (port: any) => void;

const getMockChrome = vi.fn(() => {
  const linkPortOnMessageListeners: OnMessageListener[] = [];
  const handlerPortOnMessageListeners: OnMessageListener[] = [];
  const handlerPortOnConnectListeners: OnConnectListener[] = [];

  return {
    runtime: {
      connect: vi.fn(() => {
        const handlerPort = {
          postMessage: vi.fn((message) => {
            // Handler sends response -> link receives it
            linkPortOnMessageListeners.forEach((listener) => listener(message));
          }),
          onMessage: {
            addListener: vi.fn((listener) => {
              // Handler listens for requests from link
              handlerPortOnMessageListeners.push(listener);
            }),
            removeListener: vi.fn(),
          },
          onDisconnect: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          disconnect: vi.fn(),
        };

        const linkPort = {
          postMessage: vi.fn((message) => {
            // Link sends message -> handler receives it
            handlerPortOnMessageListeners.forEach((listener) => listener(message));
          }),
          onMessage: {
            addListener: vi.fn((listener) => {
              // Link listens for responses from handler
              linkPortOnMessageListeners.push(listener);
            }),
            removeListener: vi.fn(),
          },
          onDisconnect: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          disconnect: vi.fn(),
        };

        handlerPortOnConnectListeners.forEach((listener) => listener(handlerPort));

        return linkPort;
      }),
      onConnect: {
        addListener: vi.fn((listener) => {
          handlerPortOnConnectListeners.push(listener);
        }),
      },
    },
  };
});

export const resetMocks = () => {
  // @ts-expect-error mocking chrome
  global.chrome = getMockChrome();
};

resetMocks();
