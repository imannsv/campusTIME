import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: process.env.PLANNING_API_TEST_URL
    ? ["planning-api.spec.ts", "freddy-api.spec.ts"]
    : process.env.DEMO_TEST_URL
      ? "demo.spec.ts"
      : "platform.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL:
      process.env.PLANNING_API_TEST_URL ||
      process.env.DEMO_TEST_URL ||
      "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
  },
  reporter: "list",
});
