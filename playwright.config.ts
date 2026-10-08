import { defineConfig } from "@playwright/test";

const apiURL = process.env.PLANNING_API_TEST_URL;
const demoURL = process.env.DEMO_TEST_URL;
const platform = process.env.CAMPUS_TEST_MODE === "platform";
const managedDemo = !apiURL && !demoURL && !platform;

export default defineConfig({
  testDir: "./tests",
  testMatch: apiURL
    ? ["planning-api.spec.ts", "freddy-api.spec.ts"]
    : platform && !demoURL
      ? "platform.spec.ts"
      : "demo.spec.ts",
  fullyParallel: false,
  workers: 1,
  webServer: managedDemo
    ? {
        command: "npm run preview:test",
        url: "http://127.0.0.1:5175",
        timeout: 240000,
        reuseExistingServer: false,
      }
    : undefined,
  use: {
    baseURL:
      apiURL ||
      demoURL ||
      (platform ? "http://127.0.0.1:5173" : "http://127.0.0.1:5175"),
    viewport: { width: 1440, height: 1000 },
    trace: process.env.CAMPUS_TEST_TRACE === "1" ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
