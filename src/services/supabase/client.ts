import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

/** Klien Supabase (singleton). Panggil hanya bila isSupabaseConfigured(). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        'Supabase belum dikonfigurasi: isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY.',
      );
    }
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

/** Domain email akun (user tim & admin dibuat dengan email pada domain ini). */
export function authEmailDomain(): string {
  return import.meta.env.VITE_AUTH_EMAIL_DOMAIN ?? 'pip.local';
}

/** Email akun bersama Tim PIP. */
export function userAccountEmail(): string {
  return import.meta.env.VITE_AUTH_USER_EMAIL ?? `tim@${authEmailDomain()}`;
}
