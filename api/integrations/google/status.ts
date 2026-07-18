/**
 * GET /api/integrations/google/status (akun terautentikasi)
 * Status koneksi Google TANPA nilai rahasia apa pun.
 */
import { getEnv, googleConfigured, supabaseConfigured } from '../../_lib/env.js';
import { fail, json } from '../../_lib/http.js';
import { dbClient, verifyRole } from '../../_lib/supabase.js';

interface ConnRow {
  email: string | null;
  connected_at: string | null;
  last_used_at: string | null;
  token_status: string | null;
}

export async function GET(request: Request): Promise<Response> {
  const env = getEnv();
  if (!supabaseConfigured(env)) {
    return json({
      configured: false,
      connected: false,
      email: null,
      connectedAt: null,
      lastUsedAt: null,
      tokenStatus: null,
    });
  }
  const info = await verifyRole(env, request);
  if (!info) return fail('Sesi tidak valid.', 401);

  const db = dbClient(env);
  const rows = await db.select<ConnRow>(
    'google_oauth_connections',
    'select=email,connected_at,last_used_at,token_status&id=eq.1',
  );
  const row = rows[0];
  return json({
    configured: googleConfigured(env),
    connected: Boolean(row?.email && row.token_status === 'AKTIF'),
    email: row?.email ?? null,
    connectedAt: row?.connected_at ?? null,
    lastUsedAt: row?.last_used_at ?? null,
    tokenStatus: row?.token_status ?? null,
  });
}
