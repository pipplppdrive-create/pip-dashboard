/**
 * Titik akses tunggal ke DataService.
 *
 * Mode ditentukan oleh VITE_DATA_MODE:
 *  - "local"    (default): adapter lokal tanpa backend — untuk development/demo.
 *  - "supabase": backend produksi; wajib VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY.
 *
 * Adapter diimplementasikan pada fase berikutnya:
 *  - Fase 3–6 : adapter lokal (`./local`)
 *  - Fase 7   : adapter Supabase (`./supabase`)
 */

export type DataMode = 'local' | 'supabase';

export function getDataMode(): DataMode {
  const raw = (import.meta.env.VITE_DATA_MODE ?? 'local').toLowerCase();
  return raw === 'supabase' ? 'supabase' : 'local';
}
