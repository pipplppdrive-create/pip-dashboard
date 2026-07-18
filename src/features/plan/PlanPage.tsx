import { useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  Clock3,
  ExternalLink,
  ListTodo,
  MapPin,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/feedback/empty-state';
import { LoadingBlock } from '@/components/feedback/loading-block';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDate, formatRelative } from '@/lib/format';
import {
  useActivities,
  useActivitySyncInfo,
  useActivityYears,
  useAppSettings,
  useEmployees,
} from '@/hooks/queries';
import type { ActivityPlanItem, ActivityStatus } from '@/services/types';
import { ACTIVITY_STATUS_LIST } from '@/services/types';
import {
  applyFilters,
  DEFAULT_FILTERS,
  formatRange,
  groupByMonth,
  itemsToday,
  itemsUpcoming,
  monthMatrix,
  monthName,
  STATUS_META,
  todayISO,
  uniqueCategories,
  type ActivityFilters,
} from './lib';

type PlanView = 'ringkasan' | 'kalender' | 'daftar';

const VIEWS: Array<{ id: PlanView; label: string; icon: typeof ListTodo }> = [
  { id: 'ringkasan', label: 'Ringkasan', icon: ListTodo },
  { id: 'kalender', label: 'Kalender', icon: CalendarDays },
  { id: 'daftar', label: 'Daftar', icon: CalendarRange },
];

/**
 * Rencana Kegiatan (Docs/09 §W) — read-only dari spreadsheet.
 * View hybrid: Ringkasan (default, ramah pimpinan/TV), Kalender bulanan, Daftar.
 */
export default function PlanPage() {
  const { data: settings } = useAppSettings();
  const { data: years } = useActivityYears();
  const initialNow = useMemo(() => new Date(), []);
  const currentYear = initialNow.getFullYear();
  const [year, setYear] = useState<number | null>(null);
  const activeYear = year ?? settings?.activeYear ?? currentYear;
  const [month, setMonth] = useState(initialNow.getMonth() + 1);
  const [view, setView] = useState<PlanView>('ringkasan');
  const [filters, setFilters] = useState<ActivityFilters>(DEFAULT_FILTERS);
  const [detail, setDetail] = useState<ActivityPlanItem | null>(null);

  const { data: items, isLoading } = useActivities(activeYear);
  const { data: syncInfo } = useActivitySyncInfo(activeYear);
  const { data: employees } = useEmployees(true);

  const filtered = useMemo(
    () => applyFilters(items ?? [], filters),
    [items, filters],
  );
  const categories = useMemo(() => uniqueCategories(items ?? []), [items]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>([activeYear, currentYear, ...(years ?? [])]);
    return [...set].sort((a, b) => b - a);
  }, [years, activeYear, currentYear]);

  const source = syncInfo?.source ?? null;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Rencana Kegiatan"
        description="Agenda kegiatan tim dari spreadsheet — perbaikan data dilakukan langsung di spreadsheet."
        actions={
          <div
            role="group"
            aria-label="Pilih tampilan"
            className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
          >
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-pressed={view === v.id}
                className={cn(
                  'pressable inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold',
                  view === v.id
                    ? 'bg-(image:--gradient-brand) text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                )}
              >
                <v.icon className="size-4" aria-hidden />
                {v.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Filter */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className="col-span-2 sm:col-span-3 lg:col-span-2">
          <span className="sr-only">Cari kegiatan</span>
          <span className="relative block">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Cari kegiatan, lokasi, PIC…"
              className="pl-9"
            />
          </span>
        </label>
        <label>
          <span className="sr-only">Tahun</span>
          <Select value={activeYear} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Kategori</span>
          <Select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="ALL">Semua kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">PIC</span>
          <Select
            value={filters.picEmployeeId}
            onChange={(e) => setFilters((f) => ({ ...f, picEmployeeId: e.target.value }))}
          >
            <option value="ALL">Semua PIC</option>
            {(employees ?? [])
              .filter((e) => e.active)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.displayName}
                </option>
              ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Status</span>
          <Select
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value as ActivityStatus | 'ALL' }))
            }
          >
            <option value="ALL">Semua status</option>
            {ACTIVITY_STATUS_LIST.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {/* Status sumber & sinkronisasi */}
      <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <RefreshCw className="size-3.5" aria-hidden />
        {source ? (
          <>
            <span>
              Sumber: <span className="font-semibold text-slate-700">{source.name}</span>
            </span>
            <span>
              Terakhir sinkron:{' '}
              <span className="font-semibold text-slate-700">
                {source.lastSyncedAt ? formatRelative(source.lastSyncedAt) : 'belum pernah'}
              </span>
            </span>
            <Badge
              tone={
                source.lastSyncStatus === 'BERHASIL'
                  ? 'success'
                  : source.lastSyncStatus === 'PERLU_VALIDASI'
                    ? 'warning'
                    : source.lastSyncStatus === 'GAGAL'
                      ? 'danger'
                      : 'neutral'
              }
            >
              {source.lastSyncStatus === 'BELUM_SINKRON'
                ? 'Belum sinkron'
                : source.lastSyncStatus === 'PERLU_VALIDASI'
                  ? 'Perlu Validasi'
                  : source.lastSyncStatus === 'BERHASIL'
                    ? 'Sinkron berhasil'
                    : 'Sinkron gagal'}
            </Badge>
          </>
        ) : (
          <span>Integrasi data belum dikonfigurasi — hubungkan spreadsheet lewat menu Admin.</span>
        )}
      </p>

      {isLoading ? (
        <LoadingBlock label="Memuat rencana kegiatan" />
      ) : (items ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarRange}
            title={source ? `Belum ada kegiatan untuk ${activeYear}` : 'Integrasi data belum dikonfigurasi'}
            description={
              source
                ? 'Kegiatan akan tampil otomatis setelah spreadsheet terisi dan tersinkron.'
                : 'Admin perlu menghubungkan akun Google dan sumber spreadsheet Rencana Kegiatan.'
            }
          />
        </Card>
      ) : (
        <>
          {view === 'ringkasan' && (
            <SummaryView items={filtered} onOpen={setDetail} />
          )}
          {view === 'kalender' && (
            <CalendarView
              items={filtered}
              year={activeYear}
              month={month}
              onMonthChange={setMonth}
              onOpen={setDetail}
            />
          )}
          {view === 'daftar' && <ListView items={filtered} onOpen={setDetail} />}
        </>
      )}

      {/* Detail kegiatan */}
      <Modal
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.title ?? ''}
        description={detail ? formatRange(detail) : undefined}
        size="md"
      >
        {detail && (
          <div className="space-y-3 px-5 py-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_META[detail.status].tone === 'brand' ? 'brand' : STATUS_META[detail.status].tone}>
                {STATUS_META[detail.status].label}
              </Badge>
              {detail.category && <Badge tone="outline">{detail.category}</Badge>}
              {detail.allDay && <Badge tone="neutral">Sepanjang hari</Badge>}
            </div>
            <dl className="space-y-2.5">
              <DetailRow icon={CalendarDays} label="Tanggal">
                {formatDate(detail.startDate)}
                {detail.endDate !== detail.startDate && <> — {formatDate(detail.endDate)}</>}
              </DetailRow>
              {!detail.allDay && detail.startTime && (
                <DetailRow icon={Clock3} label="Waktu">
                  {detail.startTime}
                  {detail.endTime ? `–${detail.endTime}` : ''} WIB
                </DetailRow>
              )}
              {detail.location && (
                <DetailRow icon={MapPin} label="Lokasi">
                  {detail.location}
                </DetailRow>
              )}
              {detail.picNames.length > 0 && (
                <DetailRow icon={Users} label="PIC">
                  <span className="flex flex-wrap gap-1">
                    {detail.picNames.map((name) => (
                      <Badge key={name} tone="brand">
                        {name}
                      </Badge>
                    ))}
                  </span>
                </DetailRow>
              )}
              {detail.participants && (
                <DetailRow icon={Users} label="Peserta">
                  {detail.participants}
                </DetailRow>
              )}
              {detail.meetingLink && (
                <DetailRow icon={ExternalLink} label="Link rapat">
                  <SafeLink href={detail.meetingLink} />
                </DetailRow>
              )}
              {detail.documentLink && (
                <DetailRow icon={ExternalLink} label="Dokumen">
                  <SafeLink href={detail.documentLink} />
                </DetailRow>
              )}
            </dl>
            {detail.notes && (
              <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                {detail.notes}
              </p>
            )}
            <p className="text-xs text-slate-400">
              Data berasal dari spreadsheet Rencana Kegiatan — perubahan dilakukan di spreadsheet,
              bukan di aplikasi. Diperbarui {formatRelative(detail.updatedAt)}.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold text-slate-400 uppercase">{label}</dt>
        <dd className="text-sm text-slate-700">{children}</dd>
      </div>
    </div>
  );
}

/** Tautan eksternal aman: hanya http(s), tanpa merender HTML mentah. */
function SafeLink({ href }: { href: string }) {
  let valid = false;
  try {
    const url = new URL(href);
    valid = url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    valid = false;
  }
  if (!valid) return <span className="text-slate-500">{href}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
    >
      {href.length > 48 ? `${href.slice(0, 48)}…` : href}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Kartu kegiatan (dipakai semua view)
// ---------------------------------------------------------------------------

function ActivityCard({
  item,
  onOpen,
  showDate = true,
}: {
  item: ActivityPlanItem;
  onOpen: (item: ActivityPlanItem) => void;
  showDate?: boolean;
}) {
  const meta = STATUS_META[item.status];
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'liftable pressable w-full cursor-pointer rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm',
        (item.status === 'DIBATALKAN' || item.status === 'DITUNDA') && 'opacity-75',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'min-w-0 text-sm leading-snug font-semibold text-slate-800',
            item.status === 'DIBATALKAN' && 'line-through',
          )}
        >
          {item.title}
        </p>
        <Badge tone={meta.tone === 'brand' ? 'brand' : meta.tone}>{meta.label}</Badge>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {showDate && (
          <span className="tnum inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            {formatRange(item)}
          </span>
        )}
        {item.location && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{item.location}</span>
          </span>
        )}
        {item.picNames.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {item.picNames.slice(0, 3).join(', ')}
            {item.picNames.length > 3 && ` +${item.picNames.length - 3}`}
          </span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// View: Ringkasan (default — ramah pimpinan & TV)
// ---------------------------------------------------------------------------

function SummaryView({
  items,
  onOpen,
}: {
  items: ActivityPlanItem[];
  onOpen: (item: ActivityPlanItem) => void;
}) {
  const iso = todayISO();
  const today = itemsToday(items, iso);
  const week = itemsUpcoming(items, 7, iso);
  const later = itemsUpcoming(items, 60, iso).filter((i) => !week.includes(i)).slice(0, 6);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-1">
        <CardHeader
          title="Hari Ini"
          description={formatDate(iso)}
        />
        <div className="space-y-2 p-4">
          {today.length === 0 ? (
            <EmptyState compact icon={CalendarDays} title="Tidak ada kegiatan hari ini" />
          ) : (
            today.map((item) => <ActivityCard key={item.id} item={item} onOpen={onOpen} />)
          )}
        </div>
      </Card>

      <Card className="xl:col-span-1">
        <CardHeader title="7 Hari ke Depan" description="Kegiatan terdekat minggu ini" />
        <div className="space-y-2 p-4">
          {week.length === 0 ? (
            <EmptyState compact icon={CalendarRange} title="Belum ada kegiatan minggu ini" />
          ) : (
            week.map((item) => <ActivityCard key={item.id} item={item} onOpen={onOpen} />)
          )}
        </div>
      </Card>

      <Card className="xl:col-span-1">
        <CardHeader title="Mendatang" description="Setelah minggu ini (60 hari ke depan)" />
        <div className="space-y-2 p-4">
          {later.length === 0 ? (
            <EmptyState compact icon={CalendarRange} title="Belum ada kegiatan berikutnya" />
          ) : (
            later.map((item) => <ActivityCard key={item.id} item={item} onOpen={onOpen} />)
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View: Kalender bulanan
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function CalendarView({
  items,
  year,
  month,
  onMonthChange,
  onOpen,
}: {
  items: ActivityPlanItem[];
  year: number;
  month: number;
  onMonthChange: (m: number) => void;
  onOpen: (item: ActivityPlanItem) => void;
}) {
  const weeks = useMemo(() => monthMatrix(year, month, items), [year, month, items]);
  const iso = todayISO();

  return (
    <Card>
      <CardHeader
        title={`${monthName(month)} ${year}`}
        description="Klik/OK pada kegiatan untuk melihat detail"
        actions={
          <label>
            <span className="sr-only">Bulan</span>
            <Select value={month} onChange={(e) => onMonthChange(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {monthName(i + 1)}
                </option>
              ))}
            </Select>
          </label>
        }
      />
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1">
          <thead>
            <tr>
              {DAY_NAMES.map((d) => (
                <th key={d} className="pb-1 text-center text-[11px] font-semibold text-slate-400">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((cell) => (
                  <td
                    key={cell.iso}
                    className={cn(
                      'h-24 rounded-xl border border-slate-100 bg-white/60 p-1.5 align-top',
                      !cell.inMonth && 'opacity-40',
                      cell.iso === iso && 'border-brand-300 bg-brand-50/60',
                    )}
                  >
                    <p
                      className={cn(
                        'tnum mb-1 text-xs font-semibold',
                        cell.iso === iso ? 'text-brand-700' : 'text-slate-500',
                      )}
                    >
                      {Number(cell.iso.slice(8, 10))}
                    </p>
                    <div className="space-y-1">
                      {cell.items.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onOpen(item)}
                          title={item.title}
                          className={cn(
                            'pressable block w-full cursor-pointer truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-4 font-semibold',
                            item.status === 'DIBATALKAN'
                              ? 'bg-slate-100 text-slate-400 line-through'
                              : item.status === 'BERLANGSUNG'
                                ? 'bg-(image:--gradient-brand) text-white'
                                : 'bg-brand-100 text-brand-800 hover:bg-brand-200',
                          )}
                        >
                          {item.title}
                        </button>
                      ))}
                      {cell.items.length > 3 && (
                        <p className="px-1 text-[10px] font-semibold text-slate-400">
                          +{cell.items.length - 3} lainnya
                        </p>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// View: Daftar kronologis
// ---------------------------------------------------------------------------

function ListView({
  items,
  onOpen,
}: {
  items: ActivityPlanItem[];
  onOpen: (item: ActivityPlanItem) => void;
}) {
  const groups = groupByMonth(items);
  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState icon={CalendarRange} title="Tidak ada kegiatan yang cocok dengan filter" />
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      {groups.map(([key, list]) => {
        const [y = 0, m = 1] = key.split('-').map(Number);
        return (
          <section key={key} aria-label={`${monthName(m)} ${y}`}>
            <h3 className="mb-2 text-sm font-bold text-slate-600">
              {monthName(m)} <span className="text-slate-400">{y}</span>
              <span className="ml-2 text-xs font-semibold text-slate-400">
                {list.length} kegiatan
              </span>
            </h3>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {list.map((item) => (
                <ActivityCard key={item.id} item={item} onOpen={onOpen} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
