import { defineConfig } from 'vitest/config';

// Unit tests only: pure library code under src/lib. Anything that touches
// Tauri, Supabase or the DOM is mocked, or runs under jsdom per file.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_KEY: 'test-anon-key' },
  },
});
