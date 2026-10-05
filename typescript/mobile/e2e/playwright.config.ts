import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.', testMatch: '*.spec.ts', workers: 1, timeout: 300_000,
  use: { actionTimeout: 30_000, baseURL: 'http://127.0.0.1:8081', viewport: { width: 390, height: 844 }, channel: process.env.CHROMIUM_PATH ? undefined : 'chrome', launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node e2e/serve.mjs', url: 'http://127.0.0.1:8081', reuseExistingServer: true },
})
