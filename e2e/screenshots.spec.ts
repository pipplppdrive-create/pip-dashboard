import { test } from '@playwright/test';
import path from 'node:path';

/**
 * Pengambilan screenshot pada seluruh ukuran wajib.
 * Jalankan dengan: SCREENSHOTS=1 (opsional SHOT_DIR untuk folder tujuan).
 * Bukan bagian test reguler.
 */

const VIEWPORTS = [
  { name: 'tv-1920x1080', width: 1920, height: 1080 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'laptop-1366x768', width: 1366, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
] as const;

const PAGES: Array<{ name: string; path: string }> = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'pekerjaan', path: '/pekerjaan' },
  { name: 'admin', path: '/admin' },
  { name: 'login', path: '/login' },
];

if (process.env.SCREENSHOTS_DEV_GALLERY) {
  PAGES.push({ name: 'ui-gallery', path: '/dev/ui' });
}

const enabled = !!process.env.SCREENSHOTS;
const outDir = process.env.SHOT_DIR ?? 'screenshots/current';

test.describe('screenshots', () => {
  test.skip(!enabled, 'Set SCREENSHOTS=1 untuk mengambil screenshot');

  for (const vp of VIEWPORTS) {
    test(`ambil ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const p of PAGES) {
        await page.goto(p.path);
        await page.waitForLoadState('networkidle');
        await page.screenshot({
          path: path.join(outDir, `${p.name}--${vp.name}.png`),
          fullPage: false,
        });
      }
    });
  }
});
