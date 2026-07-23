import { expect, test } from '@playwright/test';
import { loginAsAdmin, loginAsUser } from './helpers';

test.describe('daftar pegawai', () => {
  test('USER: menu tampil, halaman baca-saja, pencarian & detail bekerja', async ({ page }) => {
    await loginAsUser(page);
    const nav = page.getByRole('navigation', { name: 'Menu' });
    await nav.getByRole('link', { name: 'Daftar Pegawai' }).click();
    await expect(page).toHaveURL(/\/daftar-pegawai/);

    // Card pegawai tampil
    const kontent = page.locator('#konten-utama');
    await expect(
      kontent.getByRole('button', { name: 'Lihat detail Tri Hesti Wahyudiati' }),
    ).toBeVisible();

    // Baca-saja: tidak ada tombol kelola/unggah untuk USER
    await expect(kontent.getByRole('link', { name: 'Kelola pegawai' })).toHaveCount(0);
    await expect(kontent.getByText('Unggah foto')).toHaveCount(0);

    // Pencarian menyaring
    await page.getByLabel('Cari pegawai').fill('Thoriq');
    await expect(
      kontent.getByRole('button', { name: 'Lihat detail Thoriq Rozaq Rosyadi' }),
    ).toBeVisible();
    await expect(
      kontent.getByRole('button', { name: 'Lihat detail Tri Hesti Wahyudiati' }),
    ).toHaveCount(0);

    // Detail terbuka sebagai dialog baca-saja
    await kontent.getByRole('button', { name: 'Lihat detail Thoriq Rozaq Rosyadi' }).click();
    const dialog = page.getByRole('dialog', { name: 'Thoriq Rozaq Rosyadi' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('NIP')).toBeVisible();
    await expect(dialog.getByText('Jabatan')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Ubah|Simpan/ })).toHaveCount(0);
  });

  test('ADMIN: tombol kelola menuju Admin › Pegawai; dialog punya kontrol foto', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/daftar-pegawai');
    await page.locator('#konten-utama').getByRole('link', { name: 'Kelola pegawai' }).click();
    await expect(page).toHaveURL(/\/admin\/pegawai/);

    // Dialog ubah pegawai memiliki unggah foto profil
    await page
      .locator('li', { hasText: 'Tri Hesti Wahyudiati' })
      .getByRole('button', { name: /Ubah/ })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Ubah Pegawai' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Unggah foto|Ganti foto/)).toBeVisible();

    // Validasi format: berkas non-gambar ditolak sebelum diunggah
    await dialog.getByLabel('Unggah foto pegawai').setInputFiles({
      name: 'bukan-gambar.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('bukan gambar'),
    });
    await expect(page.getByText('Foto tidak dapat dipakai')).toBeVisible();

    // Validasi resolusi: PNG 1×1 ditolak (min. 32×32)
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await dialog.getByLabel('Unggah foto pegawai').setInputFiles({
      name: 'kecil.png',
      mimeType: 'image/png',
      buffer: tinyPng,
    });
    await expect(page.getByText(/Resolusi gambar terlalu kecil/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Batal' }).click();
  });
});

test.describe('sidebar', () => {
  test('hanya ada SATU kontrol toggle; siklus perkecil → sembunyikan → tampilkan', async ({
    page,
  }) => {
    await loginAsUser(page);
    const toggle = page.getByRole('button', {
      name: /Perkecil sidebar|Sembunyikan sidebar|Tampilkan sidebar/,
    });
    // Satu kontrol saja pada satu waktu
    await expect(toggle).toHaveCount(1);
    await expect(toggle).toHaveAccessibleName('Perkecil sidebar');

    await toggle.click(); // → compact
    await expect(toggle).toHaveCount(1);
    await expect(toggle).toHaveAccessibleName('Sembunyikan sidebar');

    await toggle.click(); // → hidden; tombol tampil di kiri-atas
    await expect(toggle).toHaveCount(1);
    await expect(toggle).toHaveAccessibleName('Tampilkan sidebar');

    await toggle.click(); // → kembali expanded
    await expect(toggle).toHaveAccessibleName('Perkecil sidebar');
    // Preferensi tersimpan; navigasi tetap tampil
    await expect(
      page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Dashboard' }),
    ).toBeVisible();
  });
});

test.describe('login maskot', () => {
  test('animasi maskot tidak menghambat pengisian & submit login', async ({ page }) => {
    await page.goto('/login');
    // Interaksi cepat username → password → toggle lihat password → submit
    const username = page.getByLabel('NIP atau Username');
    const password = page.getByLabel('Password', { exact: true });
    await username.click();
    await username.pressSequentially('x', { delay: 10 });
    await username.fill('');
    await password.click();
    await password.fill('salah');
    await page.getByRole('button', { name: 'Tampilkan password' }).click();
    await page.getByRole('button', { name: 'Sembunyikan password' }).click();
    // Form tetap responsif: submit kosong menampilkan error validasi segera
    await username.fill('');
    await password.fill('');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.getByRole('alert')).toContainText('Masukkan username dan password');
  });
});
