/**
 * Klien Google OAuth + Sheets API (server-only, scope read-only).
 * Refresh token disimpan TERENKRIPSI di google_oauth_tokens dan tidak pernah
 * meninggalkan server.
 */
import { decryptSecret, encryptSecret } from './crypto.js';
import type { ServerEnv } from './env.js';
import { dbClient } from './supabase.js';

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

interface TokenRow {
  id: number;
  refresh_token_ciphertext: string | null;
  access_token_ciphertext: string | null;
  access_token_expires_at: string | null;
  scope: string | null;
}

export class GoogleNotConnectedError extends Error {
  constructor() {
    super('Integrasi Google belum dikonfigurasi atau akun belum terhubung.');
  }
}

/** Tukar authorization code menjadi token (dipanggil callback OAuth). */
export async function exchangeCode(
  env: ServerEnv,
  code: string,
): Promise<{ refreshToken: string | null; accessToken: string; expiresIn: number; scope: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.googleRedirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Pertukaran token Google gagal (${res.status}).`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
  return {
    refreshToken: data.refresh_token ?? null,
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  };
}

/** Info akun (email) dari access token. */
export async function fetchUserInfo(accessToken: string): Promise<{ email: string | null }> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { email: null };
  const data = (await res.json()) as { email?: string };
  return { email: data.email ?? null };
}

/** Simpan token (refresh + access) terenkripsi. */
export async function storeTokens(
  env: ServerEnv,
  tokens: { refreshToken: string | null; accessToken: string; expiresIn: number; scope: string },
): Promise<void> {
  const db = dbClient(env);
  const patch: Record<string, unknown> = {
    access_token_ciphertext: await encryptSecret(tokens.accessToken, env.tokenEncryptionKey),
    access_token_expires_at: new Date(Date.now() + (tokens.expiresIn - 60) * 1000).toISOString(),
    scope: tokens.scope,
  };
  if (tokens.refreshToken) {
    patch.refresh_token_ciphertext = await encryptSecret(
      tokens.refreshToken,
      env.tokenEncryptionKey,
    );
  }
  await db.update('google_oauth_tokens', 'id=eq.1', patch);
}

/** Access token valid — pakai cache atau refresh dengan refresh token. */
export async function getAccessToken(env: ServerEnv): Promise<string> {
  const db = dbClient(env);
  const rows = await db.select<TokenRow>('google_oauth_tokens', 'select=*&id=eq.1');
  const row = rows[0];
  if (!row?.refresh_token_ciphertext) throw new GoogleNotConnectedError();

  if (
    row.access_token_ciphertext &&
    row.access_token_expires_at &&
    Date.parse(row.access_token_expires_at) > Date.now()
  ) {
    return decryptSecret(row.access_token_ciphertext, env.tokenEncryptionKey);
  }

  const refreshToken = await decryptSecret(row.refresh_token_ciphertext, env.tokenEncryptionKey);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    // Token dicabut/kedaluwarsa — tandai status agar Admin menghubungkan ulang.
    await db.update('google_oauth_connections', 'id=eq.1', { token_status: 'KEDALUWARSA' });
    throw new GoogleNotConnectedError();
  }
  const data = (await res.json()) as { access_token: string; expires_in: number; scope?: string };
  await storeTokens(env, {
    refreshToken: null,
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    scope: data.scope ?? SHEETS_SCOPE,
  });
  await db.update('google_oauth_connections', 'id=eq.1', {
    token_status: 'AKTIF',
    last_used_at: new Date().toISOString(),
  });
  return data.access_token;
}

/** Putuskan koneksi: revoke di Google (best-effort) + hapus token tersimpan. */
export async function disconnectGoogle(env: ServerEnv): Promise<void> {
  const db = dbClient(env);
  const rows = await db.select<TokenRow>('google_oauth_tokens', 'select=*&id=eq.1');
  const row = rows[0];
  if (row?.refresh_token_ciphertext) {
    try {
      const refreshToken = await decryptSecret(
        row.refresh_token_ciphertext,
        env.tokenEncryptionKey,
      );
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }),
      });
    } catch {
      // best-effort — token tetap dihapus dari penyimpanan
    }
  }
  await db.update('google_oauth_tokens', 'id=eq.1', {
    refresh_token_ciphertext: null,
    access_token_ciphertext: null,
    access_token_expires_at: null,
    scope: null,
  });
  await db.update('google_oauth_connections', 'id=eq.1', {
    email: null,
    connected_at: null,
    token_status: 'DICABUT',
  });
}

// ---------------------------------------------------------------------------
// Google Sheets API (read-only)
// ---------------------------------------------------------------------------

export interface SheetMeta {
  title: string;
}

export async function fetchSpreadsheetMeta(
  accessToken: string,
  spreadsheetId: string,
): Promise<{ title: string; sheets: SheetMeta[] }> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(
      res.status === 403 || res.status === 404
        ? 'Spreadsheet tidak dapat diakses akun Google terhubung.'
        : `Google Sheets API gagal (${res.status}).`,
    );
  }
  const data = (await res.json()) as {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  return {
    title: data.properties?.title ?? '',
    sheets: (data.sheets ?? []).map((s) => ({ title: s.properties?.title ?? '' })),
  };
}

/** Ambil nilai sheet (formatted string) — merge cell/formula sudah dievaluasi Google. */
export async function fetchSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Gagal membaca range "${range}" (${res.status}).`);
  const data = (await res.json()) as { values?: unknown[][] };
  return (data.values ?? []).map((row) => row.map((cell) => String(cell ?? '')));
}
