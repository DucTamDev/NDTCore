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
