import { expect, test } from '@playwright/test';

test.describe('smoke: kerangka aplikasi', () => {
  test('root diarahkan ke /dashboard dan shell tampil', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // Sidebar navigasi utama dengan 3 menu terkunci
    const nav = page.getByRole('navigation', { name: 'Menu' });
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Pekerjaan' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Admin' })).toBeVisible();
  });

  test('navigasi antar halaman lewat sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.getByRole('navigation', { name: 'Menu' });
    await nav.getByRole('link', { name: 'Pekerjaan' }).click();
    await expect(page).toHaveURL(/\/pekerjaan$/);
    await expect(page.getByRole('heading', { name: 'Pekerjaan' })).toBeVisible();
    await nav.getByRole('link', { name: 'Admin' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  });

  test('halaman login dapat dibuka', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible();
  });

  test('route tidak dikenal menampilkan halaman 404', async ({ page }) => {
    await page.goto('/halaman-tidak-ada');
    await expect(page.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeVisible();
  });

  test('mobile: bottom navigation tampil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    const bottomNavs = page.getByRole('navigation', { name: 'Navigasi utama' });
    // Pada mobile, nav bawah yang terlihat
    await expect(bottomNavs.last()).toBeVisible();
    await expect(bottomNavs.last().getByRole('link', { name: 'Pekerjaan' })).toBeVisible();
  });

  test('console browser bersih (tanpa error)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.goto('/pekerjaan');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
});
