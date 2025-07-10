import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectToTypedPort,
  createPortNames,
  createPortValidator,
  TypedPortRegistry,
} from '../src/utils/typed-ports.js';
import { resetMocks } from './__setup.js';

describe('typed ports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('createPortNames', () => {
    it('should create camelCase port name mappings', () => {
      const PortNames = createPortNames([
        'content-to-background',
        'popup-to-background',
        'devtools-to-background',
      ] as const);

      expect(PortNames.contentToBackground).toBe('content-to-background');
      expect(PortNames.popupToBackground).toBe('popup-to-background');
      expect(PortNames.devtoolsToBackground).toBe('devtools-to-background');
    });

    it('should handle single word port names', () => {
      const PortNames = createPortNames(['main', 'secondary'] as const);

      expect(PortNames.main).toBe('main');
      expect(PortNames.secondary).toBe('secondary');
    });
  });

  describe('connectToTypedPort', () => {
    it('should create a port with the specified name', () => {
      const portName = 'test-port' as const;
      const port = connectToTypedPort(portName);

      expect(chrome.runtime.connect).toHaveBeenCalledWith({
        name: 'test-port',
      });
      expect(port).toBeDefined();
    });

    it('should pass additional options', () => {
      const portName = 'test-port' as const;
      connectToTypedPort(portName, { includeTlsChannelId: true });

      expect(chrome.runtime.connect).toHaveBeenCalledWith({
        name: 'test-port',
        includeTlsChannelId: true,
      });
    });
  });

  describe('createPortValidator', () => {
    const validator = createPortValidator([
      'content-to-background',
      'popup-to-background',
    ] as const);

    it('should validate port names', () => {
      expect(validator.isValid('content-to-background')).toBe(true);
      expect(validator.isValid('popup-to-background')).toBe(true);
      expect(validator.isValid('invalid-port')).toBe(false);
    });

    it('should assert valid port names', () => {
      expect(() => validator.assert('content-to-background')).not.toThrow();
      expect(() => validator.assert('invalid-port')).toThrow('Invalid port name: invalid-port');
    });

    it('should validate and return port names', () => {
      expect(validator.validate('content-to-background')).toBe('content-to-background');
      expect(() => validator.validate('invalid-port')).toThrow('Invalid port name: invalid-port');
    });
  });

  describe('TypedPortRegistry', () => {
    const PortNames = createPortNames([
      'content-to-background',
      'popup-to-background',
      'devtools-to-background',
    ] as const);

    let registry: TypedPortRegistry<typeof PortNames>;

    beforeEach(() => {
      registry = new TypedPortRegistry(PortNames);
    });

    it('should connect to ports using type-safe keys', () => {
      const port = registry.connect('contentToBackground');

      expect(chrome.runtime.connect).toHaveBeenCalledWith({
        name: 'content-to-background',
      });
      expect(port).toBeDefined();
    });

    it('should reuse existing connections', () => {
      const port1 = registry.connect('contentToBackground');
      const port2 = registry.connect('contentToBackground');

      expect(port1).toBe(port2);
      expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle port disconnection', () => {
      const port = registry.connect('contentToBackground');
      const disconnectHandler = (port.onDisconnect.addListener as any).mock.calls[0][0];

      expect(registry.getPort('contentToBackground')).toBe(port);

      // Simulate disconnection
      disconnectHandler();

      expect(registry.getPort('contentToBackground')).toBeUndefined();
    });

    it('should disconnect specific ports', () => {
      const port = registry.connect('contentToBackground');
      port.disconnect = vi.fn();

      registry.disconnect('contentToBackground');

      expect(port.disconnect).toHaveBeenCalled();
      expect(registry.getPort('contentToBackground')).toBeUndefined();
    });

    it('should disconnect all ports', () => {
      const port1 = registry.connect('contentToBackground');
      const port2 = registry.connect('popupToBackground');

      port1.disconnect = vi.fn();
      port2.disconnect = vi.fn();

      registry.disconnectAll();

      expect(port1.disconnect).toHaveBeenCalled();
      expect(port2.disconnect).toHaveBeenCalled();
      expect(registry.getPort('contentToBackground')).toBeUndefined();
      expect(registry.getPort('popupToBackground')).toBeUndefined();
    });

    it('should create typed links', () => {
      const link = registry.createLink('contentToBackground', {
        transformer: undefined,
      });

      expect(link).toBeDefined();
      expect(chrome.runtime.connect).toHaveBeenCalledWith({
        name: 'content-to-background',
      });
    });
  });
});
