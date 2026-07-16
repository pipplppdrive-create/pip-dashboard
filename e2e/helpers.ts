import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const USER_PASSWORD = 'pip2026';
export const ADMIN_USERNAME = 'admin';
export const ADMIN_PASSWORD = 'admin2026';

/** Login sebagai akun Tim (User bersama) dan pilih pegawai pelaku. */
export async function loginAsUser(page: Page, actorName = 'Rina Wahyuni'): Promise<void> {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Tim PIP' }).click();
  await page.getByLabel(/Password tim/).fill(USER_PASSWORD);
  await page.getByRole('button', { name: 'Masuk sebagai Tim' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await pickActor(page, actorName);
}

/** Login sebagai Admin dan pilih pegawai pelaku. */
export async function loginAsAdmin(page: Page, actorName = 'Putri Maharani'): Promise<void> {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Admin' }).click();
  await page.getByLabel(/Username/).fill(ADMIN_USERNAME);
  await page.getByLabel(/^Password/).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Masuk sebagai Admin' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await pickActor(page, actorName);
}

/**
 * Pilih pegawai pelaku dari dialog.
 * Pegawai pelaku persisten per perangkat — bila sudah pernah dipilih pada
 * konteks ini, dialog tidak muncul lagi dan helper ini tidak melakukan apa-apa.
 */
export async function pickActor(page: Page, name: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Siapa yang sedang bekerja?' });
  try {
    await dialog.waitFor({ state: 'visible', timeout: 3000 });
  } catch {
    return;
  }
  await dialog.getByRole('button', { name: new RegExp(name) }).click();
  await expect(dialog).toBeHidden();
}

/** Kumpulkan error console & pageerror untuk asersi kebersihan console. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}
