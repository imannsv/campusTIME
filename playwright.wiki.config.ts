import { defineConfig } from "@playwright/test";

const externalURL = process.env.WIKI_TEST_URL;
export default defineConfig({
  testDir: "./tests",
  testMatch: "wiki.spec.ts",
  workers: 1,
  fullyParallel: false,
  webServer: externalURL
    ? undefined
    : [
        {
          command: "node scripts/wiki-test-backend.mjs",
          url: "http://127.0.0.1:8123/api/auth/me/",
          timeout: 120000,
          reuseExistingServer: false,
        },
        {
          command: "npm run build:wiki-test && node scripts/wiki-test-vite.mjs",
          url: "http://127.0.0.1:5186",
          timeout: 120000,
          reuseExistingServer: false,
        },
      ],
  use: {
    baseURL: externalURL || "http://127.0.0.1:5186",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
