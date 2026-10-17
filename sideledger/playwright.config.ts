import { defineConfig } from "@playwright/test";
import path from "node:path";
import { tmpdir } from "node:os";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 45000,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: "../../History/2026-10-17_v1.0.0/evidence/e2e-results.json",
      },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:3216",
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3216",
    url: "http://127.0.0.1:3216",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      SIDELEDGER_DATA_DIR: path.join(tmpdir(), "sideledger-e2e-" + Date.now()),
    },
  },
});
