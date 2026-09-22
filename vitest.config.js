// Vitest's settings: coverage only (DECISIONS T9.3, T9.11). Plain JS, like
// eslint.config.js, since the TS project's rootDir is src/.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      // Every source file, so one no test imports shows as 0% (T9.3).
      include: ["src/**", "web/**/*.ts"],
      exclude: ["**/*.test.ts"],
      // skipFull: false keeps fully covered files in the table (T9.11).
      reporter: [["text", { skipFull: false }], "html"],
    },
  },
});
