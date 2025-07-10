import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChromePortManager } from '../src/utils/port-manager.js';
import { resetMocks } from './__setup.js';

describe('ChromePortManager', () => {
  let portManager: ChromePortManager;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    portManager = new ChromePortManager();
  });

  it('should create and manage port connections', () => {
    const port = portManager.getPort('test-port');

    expect(port).toBeDefined();
    expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: 'test-port' });
    expect(portManager.isConnected('test-port')).toBe(true);
  });

  it('should reuse existing connected ports', () => {
    const port1 = portManager.getPort('test-port');
    const port2 = portManager.getPort('test-port');

    expect(port1).toBe(port2);
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
  });

  it('should track active ports', () => {
    portManager.getPort('port-1');
    portManager.getPort('port-2');
    portManager.getPort('port-3');

    const activePorts = portManager.getActivePorts();
    expect(activePorts).toHaveLength(3);
    expect(activePorts.map((p) => p.name)).toEqual(['port-1', 'port-2', 'port-3']);
  });

  it('should handle port disconnection', () => {
    const port = portManager.getPort('test-port');
    expect(portManager.isConnected('test-port')).toBe(true);

    // Simulate disconnection
    const disconnectHandler = (port.onDisconnect.addListener as any).mock.calls[0][0];
    disconnectHandler();

    expect(portManager.isConnected('test-port')).toBe(false);
  });

  it('should create new port after disconnection', () => {
    const port1 = portManager.getPort('test-port');

    // Simulate disconnection
    const disconnectHandler = (port1.onDisconnect.addListener as any).mock.calls[0][0];
    disconnectHandler();

    const port2 = portManager.getPort('test-port');

    expect(port1).not.toBe(port2);
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
  });

  it('should notify connection listeners', () => {
    const connectionListener = vi.fn();
    portManager.onConnect('incoming-port', connectionListener);

    // Simulate incoming connection
    const mockPort = {
      name: 'incoming-port',
      postMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onDisconnect: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    };

    const onConnectHandler = (chrome.runtime.onConnect.addListener as any).mock.calls[0][0];
    onConnectHandler(mockPort);

    expect(connectionListener).toHaveBeenCalledWith(mockPort);
  });

  it('should notify disconnection listeners', () => {
    const disconnectionListener = vi.fn();
    portManager.onDisconnect('test-port', disconnectionListener);

    // Create and disconnect port
    const port = portManager.getPort('test-port');
    const disconnectHandler = (port.onDisconnect.addListener as any).mock.calls[0][0];
    disconnectHandler();

    expect(disconnectionListener).toHaveBeenCalledWith(port);
  });

  it('should close specific ports', () => {
    const port = portManager.getPort('test-port');
    port.disconnect = vi.fn();

    portManager.closePort('test-port');

    expect(port.disconnect).toHaveBeenCalled();
  });

  it('should close all ports', () => {
    const port1 = portManager.getPort('port-1');
    const port2 = portManager.getPort('port-2');

    port1.disconnect = vi.fn();
    port2.disconnect = vi.fn();

    portManager.closeAll();

    expect(port1.disconnect).toHaveBeenCalled();
    expect(port2.disconnect).toHaveBeenCalled();
    expect(portManager.getActivePorts()).toHaveLength(0);
  });

  it('should create managed link options', () => {
    const linkOptions = portManager.createManagedLink('test-port', {
      transformer: undefined,
    });

    expect(linkOptions.port).toBeDefined();
    expect(linkOptions.transformer).toBeUndefined();
  });

  it('should cleanup listeners when unsubscribing', () => {
    const listener = vi.fn();
    const cleanup = portManager.onConnect('test-port', listener);

    // Simulate connection
    const mockPort = {
      name: 'test-port',
      postMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onDisconnect: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    };

    const onConnectHandler = (chrome.runtime.onConnect.addListener as any).mock.calls[0][0];
    onConnectHandler(mockPort);

    expect(listener).toHaveBeenCalledTimes(1);

    // Cleanup
    cleanup();

    // Try again - should not be called
    onConnectHandler(mockPort);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
