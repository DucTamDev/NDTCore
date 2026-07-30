jest.mock('react-native-mmkv', () => {
  const store = new Map();
  return {
    createMMKV: jest.fn().mockImplementation(() => ({
      getString: (key) => store.get(key),
      set: (key, value) => store.set(key, value),
      remove: (key) => store.delete(key),
    })),
  };
});

jest.mock('react-native-bluetooth-classic', () => ({
  __esModule: true,
  default: {
    startDiscovery: jest.fn().mockResolvedValue([]),
    cancelDiscovery: jest.fn().mockResolvedValue(true),
    connectToDevice: jest.fn(),
  },
}));

// react-native-tcp-socket, like react-native-bluetooth-classic above, needs a
// global mock for the same reason: LanTransport.ts (used by TsplDriver) pulls
// it in at import time, and any test that transitively imports TsplDriver.ts
// (e.g. via DriverRegistry) would otherwise fail to parse it.
jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: {
    createConnection: jest.fn().mockImplementation((_options, callback) => {
      if (callback) callback();
      return {
        on: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
      };
    }),
  },
}));

// react-native-esc-pos-printer ships an ESM build that the `react-native` Jest
// preset does not transform (it lives outside the default transformIgnorePatterns
// whitelist), so any test that transitively imports EscPosDriver.ts — even
// without exercising it — fails to parse unless the module is mocked here.
// Test files that need finer control (e.g. EscPosDriver.test.ts) can still
// override this with their own local jest.mock(), which takes precedence.
jest.mock('react-native-esc-pos-printer', () => ({
  Printer: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    addText: jest.fn().mockResolvedValue(undefined),
    addFeedLine: jest.fn().mockResolvedValue(undefined),
    addCut: jest.fn().mockResolvedValue(undefined),
    sendData: jest.fn().mockResolvedValue({}),
  })),
  PrintersDiscovery: {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    onDiscovery: jest.fn().mockImplementation(() => () => undefined),
    onError: jest.fn().mockImplementation(() => () => undefined),
  },
  DiscoveryPortType: {
    PORTTYPE_ALL: 0,
    PORTTYPE_TCP: 1,
    PORTTYPE_BLUETOOTH: 2,
    PORTTYPE_USB: 3,
    PORTTYPE_BLUETOOTH_LE: 4,
  },
}));
