/**
 * Environment server (Vercel Functions) — SELURUH nilai di sini rahasia server;
 * tidak pernah dikirim ke frontend dan tidak pernah dicatat ke log.
 */

export interface ServerEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  tokenEncryptionKey: string;
  webhookSecret: string;
  appUrl: string;
}

function read(...names: string[]): string {
  for (const name of names) {
    const v = process.env[name];
    if (v) return v;
  }
  return '';
}

export function getEnv(): ServerEnv {
  return {
    // Dukung kedua konvensi nama (NEXT_PUBLIC_* dari Docs/09 & SUPABASE_URL polos).
    supabaseUrl: read('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL'),
    serviceRoleKey: read('SUPABASE_SERVICE_ROLE_KEY'),
    googleClientId: read('GOOGLE_CLIENT_ID'),
    googleClientSecret: read('GOOGLE_CLIENT_SECRET'),
    googleRedirectUri: read('GOOGLE_REDIRECT_URI'),
    tokenEncryptionKey: read('GOOGLE_TOKEN_ENCRYPTION_KEY'),
    webhookSecret: read('GOOGLE_WEBHOOK_SECRET'),
    appUrl: read('NEXT_PUBLIC_APP_URL', 'APP_URL'),
  };
}

/** Supabase server siap dipakai? */
export function supabaseConfigured(env: ServerEnv): boolean {
  return Boolean(env.supabaseUrl && env.serviceRoleKey);
}

/** Google OAuth siap dipakai? */
export function googleConfigured(env: ServerEnv): boolean {
  return Boolean(
    env.googleClientId && env.googleClientSecret && env.googleRedirectUri && env.tokenEncryptionKey,
  );
}
