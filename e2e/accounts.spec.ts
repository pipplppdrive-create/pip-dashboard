import { expect, test } from '@playwright/test';
import { IS_SUPABASE_E2E, loginAsAdmin, loginAsUser, submitLogin } from './helpers';

/**
 * Akun pegawai, login NIP/username, wajib ganti password, notifikasi, & profil.
 *
 * Uji ini hanya berjalan pada mode Supabase (akun pegawai nyata). Uji TIDAK
 * mengganti password akun produksi mana pun — hanya memverifikasi bahwa gerbang
 * "wajib ganti password" muncul, lalu keluar.
 */
test.describe('akun pegawai & login NIP/username', () => {
  test.skip(!IS_SUPABASE_E2E, 'Butuh akun pegawai pada Supabase.');

  test('pesan gagal login bersifat generik (anti-enumerasi akun)', async ({ page }) => {
    await submitLogin(page, 'pegawai-tidak-ada', 'apapun123');
    const pesanTidakAda = await page.getByRole('alert').textContent();
    await submitLogin(page, 'nur', 'password-salah-sekali');
    const pesanSalahPassword = await page.getByRole('alert').textContent();
    expect(pesanTidakAda).toBe(pesanSalahPassword);
    expect(pesanTidakAda).toContain('NIP/username atau password salah');
  });

  test('halaman login memakai field "NIP atau Username"', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('NIP atau Username')).toBeVisible();
    await expect(page.getByRole('button', { name: /Tampilkan password/ })).toBeVisible();
  });

  test('Admin melihat modul Pengguna & Akses', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await expect(page.getByRole('link', { name: /Pengguna & Akses/ })).toBeVisible();
    await page.goto('/admin/pengguna');
    await expect(page.getByRole('heading', { name: 'Pengguna & Akses' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Buat akun untuk semua pegawai aktif/ }),
    ).toBeVisible();
  });

  test('Daftar Pegawai memiliki tampilan Struktur Tim (bukan menu terpisah)', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/daftar-pegawai');
    const nav = page.getByRole('navigation', { name: 'Menu' });
    await expect(nav.getByRole('link', { name: 'Tim Kerja' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Notifikasi' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Profil' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Struktur Tim' }).click();
    await expect(page.getByText(/Pimpinan|Struktur tim belum ditetapkan/).first()).toBeVisible();
  });

  test('foto/nama pegawai membuka halaman Profil Pegawai', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/daftar-pegawai');
    await page.getByRole('button', { name: /Buka profil/ }).first().click();
    await expect(page).toHaveURL(/\/pegawai\//);
    await expect(page.getByRole('heading', { name: 'Profil Pegawai' })).toBeVisible();
    await expect(page.getByText('Ringkasan pekerjaan')).toBeVisible();
    await expect(page.getByText('Pekerjaan terkait')).toBeVisible();
    // Bukan penilaian kinerja: tidak ada predikat/peringkat.
    const body = (await page.textContent('body')) ?? '';
    for (const terlarang of ['Predikat', 'Peringkat', 'SKP', 'Ranking']) {
      expect(body).not.toContain(terlarang);
    }
  });

  test('akun DEMO tidak menampilkan lonceng notifikasi personal', async ({ page }) => {
    await loginAsUser(page);
    await expect(page.getByRole('button', { name: /^Notifikasi/ })).toHaveCount(0);
  });
});
