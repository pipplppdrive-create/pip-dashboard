import { useMemo, useState } from 'react';
import { ArrowRight, Database } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState } from '@/components/feedback/error-state';
import { EmptyState } from '@/components/feedback/empty-state';
import { Card, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelative, todayISO } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { JENJANG_LIST, type Task } from '@/services/types';
import {
  useActiveSnapshot,
  useAppSettings,
  useDistributionScopes,
  useSources,
  useSteps,
  useTasks,
} from '@/hooks/queries';
import { DistributionKpis } from './components/DistributionKpis';
import { ProgresJenjangDonuts } from './components/ProgresJenjangDonuts';
import { RekapJenjangTable } from './components/RekapJenjangTable';
import { TargetRealisasiChart } from './components/TargetRealisasiChart';
import { WorkStats } from './components/WorkStats';
import {
  attentionReasons,
  stepKindMap,
  totalsFromRows,
  workStats,
  type JenjangFilter,
} from './lib';

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const settingsQ = useAppSettings();
  const scopesQ = useDistributionScopes();

  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>(''); // '' = periode aktif terbaru
  const [jenjang, setJenjang] = useState<JenjangFilter>('ALL');

  const year = yearFilter ?? settingsQ.data?.activeYear;
  const snapshotQ = useActiveSnapshot(year, periodFilter || undefined);
  const stepsQ = useSteps();
  const tasksQ = useTasks();

  const sourcesQ = useSources();

  const snapshot = snapshotQ.data ?? null;
  const settings = settingsQ.data;

  /** Sumber spreadsheet penyaluran aktif untuk tahun terpilih (utama lebih dulu). */
  const pipSource = useMemo(() => {
    const candidates = (sourcesQ.data ?? []).filter(
      (s) => s.sourceType === 'pip_progress' && s.isActive && !s.deletedAt,
    );
    const scoped = year ? candidates.filter((s) => s.year === year) : candidates;
    return (
      scoped.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.year - a.year)[0] ?? null
    );
  }, [sourcesQ.data, year]);

  const years = useMemo(() => {
    const set = new Set<number>();
    if (settings) set.add(settings.activeYear);
    for (const s of scopesQ.data ?? []) set.add(s.year);
    return [...set].sort((a, b) => b - a);
  }, [scopesQ.data, settings]);

  const periods = useMemo(() => {
    const set = new Set<string>();
    for (const s of scopesQ.data ?? []) {
      if (year === undefined || s.year === year) set.add(s.period);
    }
    return [...set].sort();
  }, [scopesQ.data, year]);

  const totals = useMemo(
    () => (snapshot ? totalsFromRows(snapshot.rows, jenjang) : null),
    [snapshot, jenjang],
  );

  const chartRows = useMemo(() => {
    if (!snapshot) return [];
    return jenjang === 'ALL' ? snapshot.rows : snapshot.rows.filter((r) => r.jenjang === jenjang);
  }, [snapshot, jenjang]);

  // ----- Seksi pekerjaan (ringkasan eksekutif) -----
  const steps = useMemo(() => stepsQ.data ?? [], [stepsQ.data]);
  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const today = todayISO();

  const stats = useMemo(() => workStats(tasks, steps, today), [tasks, steps, today]);
  const attentionCount = useMemo(() => {
    const kinds = stepKindMap(steps);
    const staleDays = settings?.staleDays ?? 7;
    return (tasks as Task[]).filter((t) => attentionReasons(t, kinds, staleDays, today).length > 0)
      .length;
  }, [steps, tasks, settings?.staleDays, today]);

  const distributionLoading = settingsQ.isLoading || snapshotQ.isLoading || scopesQ.isLoading;
  const distributionError = snapshotQ.isError ? snapshotQ.error : null;

  return (
    <div className="space-y-6">
      {/* ===== Penyaluran PIP ===== */}
      <section aria-labelledby="judul-penyaluran" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="judul-penyaluran" className="text-lg font-bold tracking-tight text-slate-900">
              Penyaluran PIP
            </h2>
            {snapshot && (
              <p className="text-xs text-slate-500">
                Tahun anggaran {snapshot.year} · Terakhir diperbarui{' '}
                <span title={formatRelative(snapshot.activatedAt ?? snapshot.updatedAt)}>
                  {formatDateTime(snapshot.activatedAt ?? snapshot.updatedAt)} WIB
                </span>
              </p>
            )}
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              {pipSource ? (
                <>
                  <span>
                    Sumber: <span className="font-semibold text-slate-700">{pipSource.name}</span>
                  </span>
                  <span>
                    · sinkron{' '}
                    {pipSource.lastSyncedAt
                      ? formatRelative(pipSource.lastSyncedAt)
                      : 'belum pernah'}
                  </span>
                  <span
                    className={
                      pipSource.lastSyncStatus === 'BERHASIL'
                        ? 'font-semibold text-success-600'
                        : pipSource.lastSyncStatus === 'BELUM_SINKRON'
                          ? 'font-semibold text-slate-400'
                          : 'font-semibold text-warning-600'
                    }
                  >
                    ·{' '}
                    {pipSource.lastSyncStatus === 'BERHASIL'
                      ? 'Sinkron berhasil'
                      : pipSource.lastSyncStatus === 'PERLU_VALIDASI'
                        ? 'Perlu Validasi'
                        : pipSource.lastSyncStatus === 'GAGAL'
                          ? 'Sinkron gagal — menampilkan snapshot valid terakhir'
                          : 'Belum sinkron'}
                  </span>
                </>
              ) : (
                <span>Sumber spreadsheet belum dikonfigurasi — data dari snapshot terakhir.</span>
              )}
            </p>
          </div>
          {/* Filter: tahun, periode, jenjang */}
          <div
            className="flex flex-wrap items-end gap-2"
            role="group"
            aria-label="Filter penyaluran"
          >
            <Field label="Tahun" className="w-28">
              <Select
                value={year ?? ''}
                onChange={(e) => {
                  setYearFilter(Number(e.target.value));
                  setPeriodFilter('');
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Periode" className="w-36">
              <Select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
                <option value="">Periode aktif</option>
                {periods.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Jenjang" className="w-32">
              <Select value={jenjang} onChange={(e) => setJenjang(e.target.value as JenjangFilter)}>
                <option value="ALL">Semua</option>
                {JENJANG_LIST.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {distributionLoading ? (
          <SectionSkeleton />
        ) : distributionError ? (
          <Card>
            <ErrorState error={distributionError} onRetry={() => void snapshotQ.refetch()} />
          </Card>
        ) : !snapshot || !totals ? (
          <Card>
            <EmptyState
              icon={Database}
              title={pipSource ? 'Belum ada data penyaluran' : 'Integrasi data belum dikonfigurasi'}
              description={
                pipSource
                  ? 'Belum ada snapshot aktif untuk periode ini. Jalankan sinkronisasi pada Admin › Integrasi Spreadsheet, atau aktifkan snapshot manual.'
                  : 'Hubungkan akun Google dan sumber spreadsheet pada Admin › Integrasi Spreadsheet. Aplikasi tetap berjalan tanpa data.'
              }
            />
          </Card>
        ) : (
          <>
            <DistributionKpis totals={totals} />
            <div className="grid gap-3 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Target vs Realisasi per Jenjang"
                  description="Alokasi, SK Pemberian, dan siswa tersalur"
                />
                <div className="p-4 pt-2">
                  <TargetRealisasiChart rows={chartRows} />
                </div>
              </Card>
              <Card>
                <CardHeader
                  title="Progres per Jenjang"
                  description="Realisasi SK Pemberian terhadap alokasi"
                />
                <div className="p-4 pt-2">
                  <ProgresJenjangDonuts rows={chartRows} />
                </div>
              </Card>
            </div>
            <Card>
              <CardHeader
                title="Rekap per Jenjang"
                description="Alokasi, SK Pemberian, tersalur, sisa, dana, dan progres"
              />
              <div className="p-4 pt-2">
                <RekapJenjangTable rows={snapshot.rows} highlight={jenjang} />
              </div>
            </Card>
          </>
        )}
      </section>

      {/* ===== Pekerjaan tim — ringkasan eksekutif ===== */}
      <section aria-labelledby="judul-pekerjaan" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="judul-pekerjaan" className="text-lg font-bold tracking-tight text-slate-900">
            Pekerjaan Tim
          </h2>
          <Link
            to={`${ROUTES.pekerjaan}?view=ringkasan`}
            className="pressable inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Lihat ringkasan lengkap
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {stepsQ.isError || tasksQ.isError ? (
          <Card>
            <ErrorState
              error={stepsQ.error ?? tasksQ.error}
              onRetry={() => {
                void stepsQ.refetch();
                void tasksQ.refetch();
              }}
            />
          </Card>
        ) : stepsQ.isLoading || tasksQ.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <WorkStats stats={stats} attentionCount={attentionCount} />
        )}
      </section>
    </div>
  );
}
