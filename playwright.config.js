const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  workers: 3,
  use: { baseURL: 'http://127.0.0.1:8001', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', channel: process.env.CHIE_BROWSER_CHANNEL || 'msedge' } }],
  webServer: { command: 'python tests/serve.py', url: 'http://127.0.0.1:8001', reuseExistingServer: !process.env.CI }
});
