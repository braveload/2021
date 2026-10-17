import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL: process.env.SIDELEDGER_TEST_URL || "http://127.0.0.1:3217",
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
});
