import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers';

/**
 * Uji responsive pada seluruh ukuran wajib:
 * body tidak boleh overflow horizontal (scroll horizontal hanya di dalam
 * kontainer yang memang dirancang scroll, mis. board kanban & tabel).
 */

const VIEWPORTS = [
  { name: 'TV 1920x1080', width: 1920, height: 1080 },
  { name: 'Desktop 1440x900', width: 1440, height: 900 },
  { name: 'Laptop 1366x768', width: 1366, height: 768 },
  { name: 'Tablet 768x1024', width: 768, height: 1024 },
  { name: 'Mobile 390x844', width: 390, height: 844 },
] as const;

const PAGES = [
  '/dashboard',
  '/pekerjaan',
  '/daftar-pegawai',
  '/admin/audit',
  '/admin/pengaturan',
] as const;

async function expectNoBodyOverflow(page: Page, context: string) {
  const overflow = await page.evaluate(() => ({
    // Konten nyata harus muat (body mencerminkan konten; documentElement bisa
    // memuat rentang phantom dari scroll-container — lihat komentar index.css).
    bodyScrollWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
  }));
  expect(
    overflow.bodyScrollWidth,
    `${context}: konten overflow horizontal (${overflow.bodyScrollWidth} > ${overflow.clientWidth})`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect(
    overflow.htmlOverflowX,
    `${context}: dokumen harus terkunci dari gulir horizontal pengguna`,
  ).toBe('hidden');
}

for (const vp of VIEWPORTS) {
  test(`responsive ${vp.name}: tanpa overflow yang merusak`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await loginAsAdmin(page);
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectNoBodyOverflow(page, `${vp.name} ${path}`);
    }
    // Elemen kunci tetap dapat diakses
    await page.goto('/dashboard');
    await expect(page.getByText('Penyaluran PIP').first()).toBeVisible();
    await page.goto('/pekerjaan');
    await expect(
      page.getByRole('region', { name: 'Step To Do', exact: true }),
    ).toBeVisible();
  });
}
