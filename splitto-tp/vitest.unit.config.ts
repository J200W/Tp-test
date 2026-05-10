import { defineConfig } from 'vitest/config';

/** Config dédiée au mutation testing : uniquement les tests unitaires domaine. */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
