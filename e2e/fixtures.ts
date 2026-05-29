import { test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page);

    if (process.env.INSTRUMENT_COVERAGE === 'true') {
      try {
        const coverage = await page.evaluate(() => (window as any).__coverage__);
        if (coverage) {
          const coverageDir = path.join(process.cwd(), '.nyc_output');
          if (!fs.existsSync(coverageDir)) {
            fs.mkdirSync(coverageDir, { recursive: true });
          }
          const fileName = `playwright-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.json`;
          fs.writeFileSync(
            path.join(coverageDir, fileName),
            JSON.stringify(coverage)
          );
        }
      } catch (err) {
        console.warn('Failed to collect page coverage:', err);
      }
    }
  }
});

export { expect } from '@playwright/test';
