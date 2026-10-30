import { defineConfig } from 'vitest/config';

// Tests run the app's pure logic (src/lib) in plain Node: no phone, no React Native.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
