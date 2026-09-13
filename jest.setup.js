// Official mock per @react-native-async-storage/async-storage's own Jest
// integration docs - the native module doesn't exist in the Jest/Node
// environment, so any module importing it (src/lib/supabase.ts, and
// anything that imports that) needs this in place before that import runs.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
