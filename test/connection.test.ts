import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChromeConnectionManager } from '../src/utils/connection.js';
import { resetMocks } from './__setup.js';

describe('ChromeConnectionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should connect automatically on creation', () => {
    const onStateChange = vi.fn();
    const manager = new ChromeConnectionManager({
      portName: 'test-port',
      onStateChange,
    });

    expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: 'test-port' });
    expect(onStateChange).toHaveBeenCalledWith('connecting');
    expect(onStateChange).toHaveBeenCalledWith('connected');
    expect(manager.getState()).toBe('connected');
  });

  it('should handle disconnection and attempt reconnect', () => {
    const onStateChange = vi.fn();
    const manager = new ChromeConnectionManager({
      portName: 'test-port',
      onStateChange,
      maxReconnectAttempts: 3,
      reconnectInterval: 1000,
    });

    const port = (chrome.runtime.connect as any).mock.results[0].value;
    const disconnectHandler = (port.onDisconnect.addListener as any).mock.calls[0][0];

    // Clear initial calls
    onStateChange.mockClear();

    // Simulate disconnection
    disconnectHandler();

    expect(onStateChange).toHaveBeenCalledWith('disconnected');
    expect(manager.getState()).toBe('disconnected');

    // Fast-forward to trigger reconnect
    vi.advanceTimersByTime(1000);

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
    // After successful reconnect, attempts are reset
    expect(manager.getConnectionInfo().attempts).toBe(0);
  });

  it('should stop reconnecting after max attempts', () => {
    const onStateChange = vi.fn();

    // Mock chrome.runtime.connect to throw an error after first successful connection
    let connectCount = 0;
    const originalConnect = chrome.runtime.connect;
    (chrome.runtime.connect as any) = vi.fn(() => {
      connectCount++;
      if (connectCount > 1) {
        throw new Error('Connection failed');
      }
      return originalConnect();
    });

    const manager = new ChromeConnectionManager({
      portName: 'test-port',
      onStateChange,
      maxReconnectAttempts: 2,
      reconnectInterval: 100,
    });

    const port = (chrome.runtime.connect as any).mock.results[0].value;
    const disconnectHandler = (port.onDisconnect.addListener as any).mock.calls[0][0];

    // Clear initial state changes
    onStateChange.mockClear();

    // First disconnection
    disconnectHandler();

    // Wait for first reconnect attempt (will fail)
    vi.advanceTimersByTime(100);

    // Wait for second reconnect attempt (will fail)
    vi.advanceTimersByTime(200);

    // Should now be in error state
    expect(manager.getState()).toBe('error');
    expect(manager.getConnectionInfo().attempts).toBe(2);

    // Restore original function
    chrome.runtime.connect = originalConnect;
  });

  it('should support manual reconnection', () => {
    const manager = new ChromeConnectionManager({
      portName: 'test-port',
    });

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);

    manager.reconnect();

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
    expect(manager.getConnectionInfo().attempts).toBe(0);
  });

  it('should notify state change listeners', () => {
    const manager = new ChromeConnectionManager({
      portName: 'test-port',
    });

    const listener = vi.fn();
    const unsubscribe = manager.onStateChange(listener);

    const port = (chrome.runtime.connect as any).mock.results[0].value;
    const disconnectHandler = (port.onDisconnect.addListener as any).mock.calls[0][0];

    disconnectHandler();

    expect(listener).toHaveBeenCalledWith('disconnected');

    // Unsubscribe and verify no more calls
    unsubscribe();
    vi.advanceTimersByTime(1000);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should handle manual disconnect', () => {
    const onStateChange = vi.fn();
    const manager = new ChromeConnectionManager({
      portName: 'test-port',
      onStateChange,
    });

    const port = (chrome.runtime.connect as any).mock.results[0].value;
    port.disconnect = vi.fn();

    onStateChange.mockClear();

    manager.disconnect();

    expect(port.disconnect).toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalledWith('disconnected');
    expect(manager.getState()).toBe('disconnected');
  });

  it('should use exponential backoff for reconnects', () => {
    new ChromeConnectionManager({
      portName: 'test-port',
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
    });

    const port = (chrome.runtime.connect as any).mock.results[0].value;
    const disconnectHandler = (port.onDisconnect.addListener as any).mock.calls[0][0];

    // First reconnect - 1000ms (1 * 1000)
    disconnectHandler();
    vi.advanceTimersByTime(999);
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);

    // Second reconnect - 2000ms (2 * 1000)
    const port2 = (chrome.runtime.connect as any).mock.results[1].value;
    const disconnectHandler2 = (port2.onDisconnect.addListener as any).mock.calls[0][0];
    disconnectHandler2();

    // Before second reconnect happens
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(2000);
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(3);
  });
});
