// Playwright's settings for the browser tests (DECISIONS T10.27, Q34, Q35).
// Plain JS, like vitest.config.js, since the TS project's rootDir is src/.
// `npm run test:e2e` builds the page first; this serves that build on its
// own port, so a preview left running on 5170 is never the one tested.
import { defineConfig, devices } from "@playwright/test";

const PORT = 5171;

export default defineConfig({
  testDir: "e2e",
  // Named apart from vitest's *.test.ts, so neither runner picks up the other.
  testMatch: "*.e2e.ts",
  forbidOnly: true,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `vite preview web --outDir ../dist/web --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
  },
});
