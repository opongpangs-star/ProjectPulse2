// playwright.config.js — Module 2 sign-off test suite for ProjectPulse2.
// Runs against the deployed site (no local server needed — this is a static
// front-end + Firebase backend app, not something Playwright needs to boot).
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 45000,
  fullyParallel: false, // tests touch shared seed data / shared Firestore docs — keep sequential
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "https://projectpulse2-eb313.web.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
