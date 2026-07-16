import { expect, test } from '@playwright/test';

test.describe('smoke: kerangka aplikasi', () => {
  test('root diarahkan ke /dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('seluruh route placeholder dapat dibuka', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible();

    await page.goto('/pekerjaan');
    await expect(page.getByRole('heading', { name: 'Pekerjaan' })).toBeVisible();

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  });

  test('route tidak dikenal menampilkan halaman 404', async ({ page }) => {
    await page.goto('/halaman-tidak-ada');
    await expect(page.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeVisible();
  });

  test('console browser bersih (tanpa error)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
});
