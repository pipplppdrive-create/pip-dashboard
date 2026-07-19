import { expect, test } from '@playwright/test';
import { collectConsoleErrors, loginAsUser } from './helpers';

test.describe('dashboard', () => {
  test('data penyaluran agregat, rekap jenjang, dan grafik tampil', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsUser(page);

    await expect(page.getByRole('heading', { name: 'Penyaluran PIP' })).toBeVisible();
    // KPI (default: seluruh jenjang, 2026 Termin 1 aktif) — tanpa KPI duplikat
    await expect(page.getByText('18.000.000 siswa')).toBeVisible();
    await expect(page.getByText('Capaian').first()).toBeVisible();
    // Grafik
    await expect(page.getByText('Target vs Realisasi per Jenjang')).toBeVisible();
    await expect(page.getByText('Progres per Jenjang')).toBeVisible();
    // Rekap jenjang
    await expect(page.getByText('Rekap per Jenjang')).toBeVisible();
    const table = page.locator('table');
    for (const j of ['SD', 'SMP', 'SMA', 'SMK']) {
      await expect(table.getByRole('cell', { name: j, exact: true })).toBeVisible();
    }
    // Waktu pembaruan
    await expect(page.getByText(/Terakhir diperbarui/)).toBeVisible();
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

  test('kartu statistik pekerjaan mengikuti step dan membuka board dengan filter', async ({
    page,
  }) => {
    await loginAsUser(page);
    const stepCards = page.getByRole('button', { name: /Buka board dengan filter step/ });
    await expect(stepCards).toHaveCount(5); // step default seed
    await expect(
      page.getByRole('button', { name: 'Buka board dengan filter step On Progress' }),
    ).toBeVisible();
    // Kartu ringkasan eksekutif lain
    await expect(page.getByRole('button', { name: 'Buka menu Pekerjaan' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Buka ringkasan pekerjaan yang perlu perhatian' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Buka board dengan filter step To Do' }).click();
    await expect(page).toHaveURL(/\/pekerjaan\?step=/);
  });

  test('kartu Perlu Perhatian membuka Pekerjaan › Ringkasan dengan rincian lengkap', async ({
    page,
  }) => {
    await loginAsUser(page);
    // Detail (Perlu Perhatian, Fokus, Aktivitas) kini berada di menu Pekerjaan.
    await page
      .getByRole('button', { name: 'Buka ringkasan pekerjaan yang perlu perhatian' })
      .click();
    await expect(page).toHaveURL(/\/pekerjaan\?view=ringkasan/);
    await expect(page.getByText('Perlu Perhatian')).toBeVisible();
    // Seed: rekonsiliasi Juni melewati tenggat & terhambat
    await expect(page.getByText('Melewati tenggat').first()).toBeVisible();
    await expect(page.getByText('Fokus Hari Ini')).toBeVisible();
    await expect(page.getByText('Ditandai fokus').first()).toBeVisible();
    await expect(page.getByText('Aktivitas Terbaru')).toBeVisible();
    // Feed aktivitas terisi (bukan empty state).
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
