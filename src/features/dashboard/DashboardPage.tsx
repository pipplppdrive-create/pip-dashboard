import { useMemo, useState } from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import { ErrorState } from '@/components/feedback/error-state';
import { EmptyState } from '@/components/feedback/empty-state';
import { Card, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelative } from '@/lib/format';
import { JENJANG_LIST } from '@/services/types';
import {
  useActiveSnapshot,
  useAppSettings,
  useDistributionScopes,
  usePipSkRecords,
  useSources,
} from '@/hooks/queries';
import { DistributionKpis } from './components/DistributionKpis';
import { RekapJenjangTable } from './components/RekapJenjangTable';
import { SkBulananChart } from './components/SkBulananChart';
import { SkJenjangDonut } from './components/SkJenjangDonut';
import { skStats, totalsFromRows, type JenjangFilter } from './lib';

function SectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-30" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[340px] lg:col-span-7" />
        <Skeleton className="h-[340px] lg:col-span-5" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

/**
 * Dashboard — khusus informasi penyaluran PIP (pekerjaan tim ada di menu
 * Pekerjaan › Ringkasan). Satu layar tanpa scroll pada TV/desktop (≥ lg):
 * 4 KPI → Rekap SK per Bulan + Jumlah SK per Jenjang (donut) → Detail Rekap.
 *
 * Sumber data (semua angka nyata, tanpa tren sintetis):
 * - KPI & progres  : snapshot aktif distribution_snapshots (kuota alokasi
 *                    REKAP/konfigurasi + realisasi sheet Pemberian kolom TOTAL).
 * - Jumlah SK      : COUNT(DISTINCT nomor SK) dari pip_progress_records
 *                    (baris sheet Pemberian); bulan dari tanggal SK.
 */
export default function DashboardPage() {
  const settingsQ = useAppSettings();
  const scopesQ = useDistributionScopes();

  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>(''); // '' = periode aktif terbaru
  const [jenjang, setJenjang] = useState<JenjangFilter>('ALL');

  const year = yearFilter ?? settingsQ.data?.activeYear;
  const snapshotQ = useActiveSnapshot(year, periodFilter || undefined);

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

  const skRecordsQ = usePipSkRecords(year, pipSource?.id);

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

  /** Agregasi SK unik (per jenjang & per bulan) mengikuti filter aktif. */
  const sk = useMemo(
    () => skStats(skRecordsQ.data ?? [], year, jenjang),
    [skRecordsQ.data, year, jenjang],
  );
  const hasSkDetail = (skRecordsQ.data?.length ?? 0) > 0;

  const distributionLoading = settingsQ.isLoading || snapshotQ.isLoading || scopesQ.isLoading;
  const distributionError = snapshotQ.isError ? snapshotQ.error : null;

  return (
    <section aria-labelledby="judul-penyaluran" className="flex flex-col gap-4 short:gap-2.5 tall:gap-3">
      {/* Header seksi: judul, status data, filter */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-(image:--gradient-brand) text-white shadow-(--shadow-lift) sm:inline-flex"
          >
            <ShieldCheck className="size-5" />
          </span>
          <div>
          <h2 id="judul-penyaluran" className="text-lg font-bold tracking-tight text-slate-900">
            Penyaluran PIP
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            {pipSource ? (
              <span>
                Sumber: <span className="font-semibold text-slate-700">{pipSource.name}</span>
              </span>
            ) : (
              <span>Sumber: snapshot manual</span>
            )}
            {snapshot && (
              <span>
                · Terakhir diperbarui:{' '}
                <span title={formatRelative(snapshot.activatedAt ?? snapshot.updatedAt)}>
                  {formatDateTime(snapshot.activatedAt ?? snapshot.updatedAt)} WIB
                </span>
              </span>
            )}
            {pipSource && (
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
                  ? 'Sinkronisasi berhasil'
                  : pipSource.lastSyncStatus === 'PERLU_VALIDASI'
                    ? 'Perlu validasi'
                    : pipSource.lastSyncStatus === 'GAGAL'
                      ? 'Sinkronisasi gagal — data valid terakhir'
                      : 'Belum sinkron'}
              </span>
            )}
          </p>
          </div>
        </div>
        {/* Filter: tahun, periode, jenjang */}
        <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Filter penyaluran">
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
          <div className="shrink-0">
            <DistributionKpis totals={totals} skCount={hasSkDetail ? sk.totalSk : null} />
          </div>
          <div className="grid gap-4 short:gap-3 lg:grid-cols-12">
            <Card className="flex h-[320px] flex-col overflow-hidden lg:col-span-7 tall:h-[340px] short:h-[272px]">
              <CardHeader
                title="Rekap SK per Bulan"
                description="Jumlah penerbitan SK unik berdasarkan tanggal SK — sheet Pemberian"
              />
              <div className="min-h-0 flex-1 p-4 pt-1">
                <SkBulananChart stats={sk} />
              </div>
            </Card>
            <Card className="flex h-[320px] flex-col overflow-hidden lg:col-span-5 tall:h-[340px] short:h-[272px]">
              <CardHeader
                title="Jumlah SK per Jenjang"
                description="Nomor SK unik per jenjang pendidikan — bukan jumlah siswa"
              />
              <div className="min-h-0 flex-1 p-4 pt-2">
                <SkJenjangDonut
                  perJenjang={hasSkDetail ? sk.perJenjang : {}}
                  totalSk={hasSkDetail ? sk.totalSk : 0}
                />
              </div>
            </Card>
          </div>
          <Card className="shrink-0">
            <CardHeader
              title="Detail Rekap per Jenjang"
              description="Alokasi, SK Pemberian, jumlah SK unik, dana, dan progres"
            />
            <div className="p-4 pt-2">
              <RekapJenjangTable
                rows={snapshot.rows}
                highlight={jenjang}
                skPerJenjang={hasSkDetail ? sk.perJenjang : null}
                skTotal={hasSkDetail ? sk.totalSk : null}
              />
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
