import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:4180", browserName: "chromium" },
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4180",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
