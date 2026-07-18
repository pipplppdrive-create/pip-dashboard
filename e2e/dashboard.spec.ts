import { expect, test } from '@playwright/test';
import { collectConsoleErrors, loginAsUser } from './helpers';

test.describe('dashboard', () => {
  test('data penyaluran agregat, rekap jenjang, dan grafik tampil', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsUser(page);

    await expect(page.getByRole('heading', { name: 'Penyaluran PIP' })).toBeVisible();
    // KPI (default: seluruh jenjang, 2026 Termin 1 aktif)
    await expect(page.getByText('18.000.000 siswa')).toBeVisible();
    await expect(page.getByText('Dana Tersalur').first()).toBeVisible();
    // Grafik
    await expect(page.getByText('Target vs Realisasi per Jenjang')).toBeVisible();
    await expect(page.getByText('Tren Penyaluran Siswa')).toBeVisible();
    // Rekap jenjang
    await expect(page.getByText('Rekap per Jenjang')).toBeVisible();
    const table = page.locator('table');
    for (const j of ['SD', 'SMP', 'SMA', 'SMK']) {
      await expect(table.getByRole('cell', { name: j, exact: true })).toBeVisible();
    }
    // Waktu pembaruan
    await expect(page.getByText(/Termin 1 — diperbarui/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('filter jenjang & periode bekerja', async ({ page }) => {
    await loginAsUser(page);
    // Filter jenjang SD → KPI alokasi berubah
    await page.getByLabel('Jenjang', { exact: true }).selectOption('SD');
    await expect(page.getByText('10.400.000 siswa')).toBeVisible();
    // Periode tanpa snapshot aktif → empty state
    await page.getByLabel('Periode').selectOption('Termin 2');
    await expect(page.getByText('Belum ada data penyaluran')).toBeVisible();
    // Kembali ke periode aktif
    await page.getByLabel('Periode').selectOption('');
    await expect(page.getByText('10.400.000 siswa')).toBeVisible();
  });

  test('ringkasan pekerjaan dinamis mengikuti step dan membuka board dengan filter', async ({
    page,
  }) => {
    await loginAsUser(page);
    const ringkasan = page.getByRole('button', { name: /Buka board dengan filter step/ });
    await expect(ringkasan).toHaveCount(5); // step default seed
    await expect(
      page.getByRole('button', { name: 'Buka board dengan filter step On Progress' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Buka board dengan filter step To Do' }).click();
    await expect(page).toHaveURL(/\/pekerjaan\?step=/);
  });

  test('Perlu Perhatian, Fokus Hari Ini, dan Aktivitas terbaru berfungsi', async ({ page }) => {
    await loginAsUser(page);
    await expect(page.getByText('Perlu Perhatian')).toBeVisible();
    // Seed: rekonsiliasi Juni melewati tenggat & terhambat
    await expect(page.getByText('Melewati tenggat').first()).toBeVisible();
    await expect(page.getByText('Fokus Hari Ini')).toBeVisible();
    await expect(page.getByText('Ditandai fokus').first()).toBeVisible();
    await expect(page.getByText('Aktivitas Terbaru')).toBeVisible();
    // Feed aktivitas kini terisi untuk USER (migrasi 0005 membuka baca audit
    // terbatas). Verba bisa dari pembaruan penyaluran (seed) atau aktivitas
    // pekerjaan uji; pastikan feed terisi (bukan empty state).
    await expect(
      page
        .getByText(/memperbarui data penyaluran|membuat|memindahkan|memperbarui|menyelesaikan/)
        .first(),
    ).toBeVisible();
  });

  test('tidak ada data individual siswa', async ({ page }) => {
    await loginAsUser(page);
    const body = (await page.textContent('body')) ?? '';
    for (const forbidden of ['NISN', 'NIK', 'Virtual Account', 'No. Rekening']) {
      expect(body).not.toContain(forbidden);
    }
  });
});
