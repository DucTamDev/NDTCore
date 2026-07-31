module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@reduxjs/toolkit|immer|react-redux|@react-navigation|react-native-safe-area-context|react-native-screens|react-native-paper|@tanstack)(/|$))',
  ],
};
