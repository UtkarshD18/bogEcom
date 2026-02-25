const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60 * 1000,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  expect: {
    timeout: 10 * 1000,
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    timeout: 120 * 1000,
    reuseExistingServer: true,
  },
});
