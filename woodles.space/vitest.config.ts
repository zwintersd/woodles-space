import { defineConfig } from 'vitest/config';

// Covers api/ — the one part of the workspace that isn't a pnpm package (it
// ships as Vercel edge functions, not a built module), so it needs its own
// runner instead of the recursive `pnpm -r test`.
export default defineConfig({
  test: {
    include: ['api/**/*.test.ts']
  }
});
