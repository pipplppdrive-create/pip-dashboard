/**
 * Titik akses tunggal ke DataService.
 *
 * Mode ditentukan oleh VITE_DATA_MODE:
 *  - "local"    (default): adapter lokal tanpa backend — untuk development/demo.
 *  - "supabase": backend produksi; wajib VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
 *                (adapter dihubungkan pada Fase 7).
 */
import type { DataService } from './types';
import { localAdapter } from './local/adapter';

export type DataMode = 'local' | 'supabase';

export function getDataMode(): DataMode {
  const raw = (import.meta.env.VITE_DATA_MODE ?? 'local').toLowerCase();
  return raw === 'supabase' ? 'supabase' : 'local';
}

let instance: DataService | null = null;

export function getDataService(): DataService {
  if (instance) return instance;
  const mode = getDataMode();
  if (mode === 'supabase') {
    // Adapter Supabase dihubungkan pada Fase 7 (butuh kredensial).
    console.warn(
      '[services] VITE_DATA_MODE=supabase belum tersedia pada fase ini — memakai adapter lokal.',
    );
  }
  instance = localAdapter;
  return instance;
}
