const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:3000', headless: true, launchOptions: { executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' } },
  webServer: { command: 'npm start', url: 'http://127.0.0.1:3000', reuseExistingServer: true, timeout: 120000 }
});
