import { CheckCircle2, CircleAlert, CircleDashed, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/format';
import { getDataMode } from '@/services';
import { isSupabaseConfigured } from '@/services/supabase/client';
import {
  useEmployees,
  useGoogleStatus,
  useSources,
  useSyncRuns,
  useTasks,
} from '@/hooks/queries';

type Tone = 'ok' | 'warn' | 'off';

const TONE_ICON: Record<Tone, LucideIcon> = {
  ok: CheckCircle2,
  warn: CircleAlert,
  off: CircleDashed,
};

function StatusRow({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: Tone;
  detail?: string;
}) {
  const Icon = TONE_ICON[tone];
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon
        aria-hidden
        className={cn(
          'mt-0.5 size-4.5 shrink-0',
          tone === 'ok' && 'text-success-600',
          tone === 'warn' && 'text-warning-600',
          tone === 'off' && 'text-slate-400',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
      </div>
      <Badge tone={tone === 'ok' ? 'success' : tone === 'warn' ? 'warning' : 'neutral'}>
        {value}
      </Badge>
    </li>
  );
}

/**
 * Ringkasan Admin (Docs/09 §M.1) — status integrasi & kesehatan aplikasi.
 * Nilai environment TIDAK pernah ditampilkan — hanya status terisi/kosong.
 */
export function OverviewSection() {
  const mode = getDataMode();
  const supabaseReady = isSupabaseConfigured();
  const { data: google } = useGoogleStatus();
  const { data: sources } = useSources({ includeInactive: true });
  const { data: runs } = useSyncRuns(undefined, 1);
  const { data: employees } = useEmployees(true);
  const { data: tasks } = useTasks();

  const activeSources = (sources ?? []).filter((s) => s.isActive && !s.deletedAt);
  const failing = activeSources.filter(
    (s) => s.lastSyncStatus === 'GAGAL' || s.lastSyncStatus === 'PERLU_VALIDASI',
  );
  const lastRun = runs?.[0] ?? null;
  const activeEmployees = (employees ?? []).filter((e) => e.active).length;
  const activeTasks = (tasks ?? []).length;

  const envRows: Array<{ label: string; set: boolean }> = [
    { label: 'VITE_DATA_MODE', set: Boolean(import.meta.env.VITE_DATA_MODE) },
    { label: 'VITE_SUPABASE_URL', set: Boolean(import.meta.env.VITE_SUPABASE_URL) },
    { label: 'VITE_SUPABASE_ANON_KEY', set: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title="Backend & Integrasi" description="Status koneksi layanan inti" />
        <ul className="divide-y divide-slate-100 px-4 pb-2">
          <StatusRow
            label="Supabase"
            detail={
              mode === 'supabase'
                ? 'Mode produksi — data dari Postgres + Realtime.'
                : 'Mode lokal — data contoh tersimpan di perangkat ini.'
            }
            value={mode === 'supabase' ? 'Terhubung' : supabaseReady ? 'Siap (mode lokal)' : 'Belum dikonfigurasi'}
            tone={mode === 'supabase' ? 'ok' : supabaseReady ? 'warn' : 'off'}
          />
          <StatusRow
            label="Google OAuth"
            detail={
              google?.connected
                ? `Akun terhubung: ${google.email ?? '—'}${google.connectedAt ? ` · sejak ${formatRelative(google.connectedAt)}` : ''}`
                : 'Satu akun Google Admin dipakai membaca seluruh spreadsheet.'
            }
            value={
              google?.connected
                ? (google.tokenStatus ?? 'AKTIF')
                : google?.configured
                  ? 'Belum terhubung'
                  : 'Belum dikonfigurasi'
            }
            tone={google?.connected ? (google.tokenStatus === 'AKTIF' ? 'ok' : 'warn') : 'off'}
          />
          <StatusRow
            label="Sumber spreadsheet"
            detail={
              failing.length > 0
                ? `${failing.length} sumber berstatus gagal/perlu validasi.`
                : 'Progres penyaluran & Rencana Kegiatan dibaca read-only.'
            }
            value={`${activeSources.length} aktif`}
            tone={failing.length > 0 ? 'warn' : activeSources.length > 0 ? 'ok' : 'off'}
          />
          <StatusRow
            label="Sinkronisasi terakhir"
            detail={
              lastRun
                ? `${formatRelative(lastRun.startedAt)} · ${lastRun.rowsRead} baris dibaca${lastRun.errorMessage ? ` · ${lastRun.errorMessage}` : ''}`
                : 'Belum ada sinkronisasi tercatat.'
            }
            value={
              lastRun
                ? lastRun.status === 'BERHASIL'
                  ? 'Berhasil'
                  : lastRun.status === 'PERLU_VALIDASI'
                    ? 'Perlu Validasi'
                    : 'Gagal'
                : '—'
            }
            tone={lastRun ? (lastRun.status === 'BERHASIL' ? 'ok' : 'warn') : 'off'}
          />
          <StatusRow
            label="Realtime"
            detail={
              mode === 'supabase'
                ? 'Supabase Realtime — perubahan tampil tanpa reload.'
                : 'BroadcastChannel antar-tab (mode lokal).'
            }
            value="Aktif"
            tone="ok"
          />
        </ul>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Data Aplikasi" description="Ringkasan isi master data" />
          <dl className="grid grid-cols-2 gap-3 p-4">
            <div className="rounded-xl bg-(image:--gradient-brand-soft) p-3">
              <dt className="text-xs font-semibold text-slate-600">Pegawai aktif</dt>
              <dd className="tnum text-2xl font-extrabold text-slate-900">{activeEmployees}</dd>
            </div>
            <div className="rounded-xl bg-(image:--gradient-brand-soft) p-3">
              <dt className="text-xs font-semibold text-slate-600">Pekerjaan aktif</dt>
              <dd className="tnum text-2xl font-extrabold text-slate-900">{activeTasks}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Environment Variable"
            description="Hanya status terisi/kosong — nilai rahasia tidak pernah ditampilkan."
          />
          <ul className="divide-y divide-slate-100 px-4 pb-2">
            {envRows.map((row) => (
              <li key={row.label} className="flex items-center justify-between py-2.5">
                <code className="text-xs font-semibold text-slate-600">{row.label}</code>
                <Badge tone={row.set ? 'success' : 'neutral'}>{row.set ? 'Terisi' : 'Kosong'}</Badge>
              </li>
            ))}
            <li className="py-2.5 text-xs leading-relaxed text-slate-400">
              Kredensial server (service role, Google client secret, webhook secret) hanya berada
              di environment server — tidak pernah dikirim ke browser.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
