import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function readDotEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const entries: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line) || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (key && entries[key] === undefined) entries[key] = value;
  }
  return entries;
}

const dotEnv = readDotEnv();
const hasSupabaseConfig = Boolean(
  process.env.VITE_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    dotEnv.VITE_SUPABASE_URL ??
    dotEnv.NEXT_PUBLIC_SUPABASE_URL,
);
const dataMode = (
  process.env.VITE_DATA_MODE ??
  process.env.NEXT_PUBLIC_DATA_MODE ??
  dotEnv.VITE_DATA_MODE ??
  dotEnv.NEXT_PUBLIC_DATA_MODE ??
  (hasSupabaseConfig ? 'supabase' : 'local')
).toLowerCase();

export const IS_SUPABASE_E2E = dataMode === 'supabase';

function testEnv(name: string): string | undefined {
  return process.env[name] ?? dotEnv[name];
}

function credential(name: string, fallback: string): string {
  const value = testEnv(name);
  if (value) return value;
  if (dataMode === 'supabase' && name.includes('PASSWORD')) {
    throw new Error(
      `${name} wajib diisi untuk E2E mode Supabase. Simpan di .env.local atau process env; jangan commit nilainya.`,
    );
  }
  return fallback;
}

export const USER_USERNAME = credential('PIP_E2E_USER_USERNAME', dataMode === 'supabase' ? 'user' : 'tim-pip');
export const USER_PASSWORD = credential('PIP_E2E_USER_PASSWORD', 'pip2026');
export const ADMIN_USERNAME = credential('PIP_E2E_ADMIN_USERNAME', 'admin');
export const ADMIN_PASSWORD = credential('PIP_E2E_ADMIN_PASSWORD', 'admin2026');

/** Login sebagai akun Tim (User bersama) dan pilih pegawai pelaku. */
export async function loginAsUser(page: Page, actorName = 'Tri Hesti Wahyudiati'): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(USER_USERNAME);
  await page.getByPlaceholder('Password').fill(USER_PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await pickActor(page, actorName);
}

/** Login sebagai Admin dan pilih pegawai pelaku. */
export async function loginAsAdmin(page: Page, actorName = 'Sucianingsih'): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(ADMIN_USERNAME);
  await page.getByPlaceholder('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
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
