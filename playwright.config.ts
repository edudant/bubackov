import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173/bubackov/', trace: 'on-first-retry', channel: 'chromium' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173/bubackov/', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'tv', use: { viewport: { width: 1920, height: 1080 } } }
  ]
});
