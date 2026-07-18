import { useMemo, useState } from 'react';
import { Database, Focus, TriangleAlert } from 'lucide-react';
import { ErrorState } from '@/components/feedback/error-state';
import { EmptyState } from '@/components/feedback/empty-state';
import { Card, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelative, todayISO } from '@/lib/format';
import { JENJANG_LIST, type Task } from '@/services/types';
import {
  useActiveSnapshot,
  useAllComments,
  useAppSettings,
  useDistributionScopes,
  useEmployees,
  useRecentActivity,
  useSnapshots,
  useSources,
  useSteps,
  useTasks,
} from '@/hooks/queries';
import { ActivityFeed } from './components/ActivityFeed';
import { DistributionKpis } from './components/DistributionKpis';
import { RekapJenjangTable } from './components/RekapJenjangTable';
import { TargetRealisasiChart } from './components/TargetRealisasiChart';
import { TaskAttentionList, type AttentionItem } from './components/TaskAttentionList';
import { TrendChart } from './components/TrendChart';
import { WorkSummary } from './components/WorkSummary';
import {
  attentionReasons,
  attentionScore,
  focusScore,
  isFocusToday,
  needsFollowUpIds,
  stepKindMap,
  totalsFromRows,
  trendSeries,
  type FocusItem,
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
  const snapshotsQ = useSnapshots();
  const stepsQ = useSteps();
  const tasksQ = useTasks();
  const commentsQ = useAllComments();
  const activityQ = useRecentActivity(12);
  const employeesQ = useEmployees(true);

  const sourcesQ = useSources();

  const snapshot = snapshotQ.data ?? null;
  const settings = settingsQ.data;
  const employees = employeesQ.data ?? [];

  /** Sumber spreadsheet penyaluran aktif untuk tahun terpilih (utama lebih dulu). */
  const pipSource = useMemo(() => {
    const candidates = (sourcesQ.data ?? []).filter(
      (s) => s.sourceType === 'pip_progress' && s.isActive && !s.deletedAt,
    );
    const scoped = year ? candidates.filter((s) => s.year === year) : candidates;
    return (
      scoped.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.year - a.year)[0] ??
      null
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
    return jenjang === 'ALL'
      ? snapshot.rows
      : snapshot.rows.filter((r) => r.jenjang === jenjang);
  }, [snapshot, jenjang]);

  const trend = useMemo(() => {
    if (!snapshot || !snapshotsQ.data) return [];
    return trendSeries(snapshotsQ.data, snapshot.year, snapshot.period, jenjang);
  }, [snapshot, snapshotsQ.data, jenjang]);

  // ----- Seksi pekerjaan -----
  const steps = useMemo(() => stepsQ.data ?? [], [stepsQ.data]);
  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const today = todayISO();

  const { attentionItems, focusItems } = useMemo(() => {
    const kinds = stepKindMap(steps);
    const staleDays = settings?.staleDays ?? 7;
    const followUp = needsFollowUpIds(commentsQ.data ?? []);
    const attention: AttentionItem[] = [];
    const focus: FocusItem[] = [];
    for (const task of tasks as Task[]) {
      const reasons = attentionReasons(task, kinds, staleDays, today);
      if (reasons.length > 0) {
        attention.push({ task, reasons });
      }
      const needs = followUp.has(task.id);
      if (kinds.get(task.stepId) !== 'DONE' && isFocusToday(task, reasons, needs)) {
        focus.push({ task, reasons, needsFollowUp: needs });
      }
    }
    attention.sort(
      (a, b) =>
        attentionScore(a.reasons) - attentionScore(b.reasons) ||
        (a.task.dueDate ?? '9999').localeCompare(b.task.dueDate ?? '9999'),
    );
    focus.sort((a, b) => focusScore(a) - focusScore(b));
    return {
      attentionItems: attention,
      focusItems: focus.map(
        (f): AttentionItem => ({
          task: f.task,
          reasons: f.reasons,
          extraBadge: f.task.isFocus
            ? { label: 'Ditandai fokus', tone: 'brand' }
            : f.needsFollowUp
              ? { label: 'Perlu tindak lanjut', tone: 'info' }
              : null,
        }),
      ),
    };
  }, [steps, tasks, settings?.staleDays, commentsQ.data, today]);

  const distributionLoading =
    settingsQ.isLoading || snapshotQ.isLoading || scopesQ.isLoading;
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
                {snapshot.year} · {snapshot.period} — diperbarui{' '}
                <span title={formatDateTime(snapshot.activatedAt ?? snapshot.updatedAt)}>
                  {formatRelative(snapshot.activatedAt ?? snapshot.updatedAt)}
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
                    {pipSource.lastSyncedAt ? formatRelative(pipSource.lastSyncedAt) : 'belum pernah'}
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
              <Select
                value={jenjang}
                onChange={(e) => setJenjang(e.target.value as JenjangFilter)}
              >
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
                  title="Tren Penyaluran Siswa"
                  description={`Riwayat pembaruan data ${snapshot.year} · ${snapshot.period}`}
                />
                <div className="p-4 pt-2">
                  <TrendChart points={trend} />
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

      {/* ===== Pekerjaan tim ===== */}
      <section aria-labelledby="judul-pekerjaan" className="space-y-3">
        <h2 id="judul-pekerjaan" className="text-lg font-bold tracking-tight text-slate-900">
          Pekerjaan Tim
        </h2>
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
          <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
            <Card>
              <CardHeader
                title="Ringkasan Pekerjaan"
                description="Jumlah pekerjaan per step — klik untuk membuka board"
              />
              <div className="px-3 pb-3">
                <WorkSummary steps={steps} tasks={tasks} />
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Perlu Perhatian"
                description="Tenggat, PIC kosong, terhambat, atau lama tidak diperbarui"
              />
              <div className="px-3 pb-3">
                <TaskAttentionList
                  items={attentionItems}
                  employees={employees}
                  emptyIcon={TriangleAlert}
                  emptyTitle="Tidak ada yang perlu perhatian"
                  emptyDescription="Seluruh pekerjaan dalam kondisi terkendali."
                />
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Fokus Hari Ini"
                description="Ditandai fokus, jatuh tempo, prioritas tinggi, atau perlu tindak lanjut"
              />
              <div className="px-3 pb-3">
                <TaskAttentionList
                  items={focusItems}
                  employees={employees}
                  emptyIcon={Focus}
                  emptyTitle="Tidak ada fokus khusus"
                  emptyDescription="Tandai pekerjaan sebagai fokus dari board."
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Aktivitas Terbaru" description="Perubahan terakhir oleh tim" />
              <div className="px-3 pb-3">
                {activityQ.isLoading ? (
                  <div className="space-y-2 p-1">
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                  </div>
                ) : (
                  <ActivityFeed events={activityQ.data ?? []} employees={employees} />
                )}
              </div>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}
