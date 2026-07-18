/**
 * Akses Supabase dari server (service role) via PostgREST — tanpa SDK agar
 * ringan di Vercel Function. SERVICE ROLE HANYA di server; tidak pernah
 * dikirim ke frontend.
 */
import type { ServerEnv } from './env';

export interface DbClient {
  select<T>(table: string, query: string): Promise<T[]>;
  insert<T>(table: string, rows: unknown, opts?: { upsertOn?: string }): Promise<T[]>;
  update<T>(table: string, query: string, patch: unknown): Promise<T[]>;
  delete(table: string, query: string): Promise<void>;
}

export function dbClient(env: ServerEnv): DbClient {
  const base = `${env.supabaseUrl}/rest/v1`;
  const headers: Record<string, string> = {
    apikey: env.serviceRoleKey,
    Authorization: `Bearer ${env.serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  async function run<T>(url: string, init: RequestInit): Promise<T[]> {
    const res = await fetch(url, init);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`);
    }
    if (res.status === 204) return [];
    const text = await res.text();
    return text ? (JSON.parse(text) as T[]) : [];
  }

  return {
    select: <T>(table: string, query: string) =>
      run<T>(`${base}/${table}?${query}`, { headers }),
    insert: <T>(table: string, rows: unknown, opts?: { upsertOn?: string }) =>
      run<T>(
        `${base}/${table}${opts?.upsertOn ? `?on_conflict=${opts.upsertOn}` : ''}`,
        {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: `return=representation${opts?.upsertOn ? ',resolution=merge-duplicates' : ''}`,
          },
          body: JSON.stringify(rows),
        },
      ),
    update: <T>(table: string, query: string, patch: unknown) =>
      run<T>(`${base}/${table}?${query}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      }),
    delete: async (table: string, query: string) => {
      await run(`${base}/${table}?${query}`, { method: 'DELETE', headers });
    },
  };
}

/**
 * Verifikasi JWT Supabase dari header Authorization dan pastikan pemiliknya
 * terdaftar di account_roles. Role TIDAK PERNAH dipercaya dari client.
 */
export async function verifyRole(
  env: ServerEnv,
  request: Request,
): Promise<{ userId: string; role: 'USER' | 'ADMIN' } | null> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const res = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  if (!user.id) return null;
  const db = dbClient(env);
  const rows = await db.select<{ role: 'USER' | 'ADMIN' }>(
    'account_roles',
    `select=role&user_id=eq.${user.id}`,
  );
  const role = rows[0]?.role;
  if (!role) return null;
  return { userId: user.id, role };
}

export async function requireAdmin(env: ServerEnv, request: Request): Promise<boolean> {
  const info = await verifyRole(env, request);
  return info?.role === 'ADMIN';
}
