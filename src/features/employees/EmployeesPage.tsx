import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BadgeCheck, IdCard, Search, Settings2, UserRound, Users } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Avatar, DefaultAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';
import type { Employee } from '@/services/types';
import { useSessionStore } from '@/features/auth/session-store';
import { useEmployeePhotos, useEmployees } from '@/hooks/queries';

type StatusFilter = 'AKTIF' | 'SEMUA' | 'NONAKTIF';

/** Foto profil atau avatar bawaan bertema maskot. */
function EmployeePhoto({
  employee,
  url,
  className,
}: {
  employee: Employee;
  url: string | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100',
        !employee.active && 'opacity-60 grayscale',
        className,
      )}
    >
      {url ? (
        <img
          src={url}
          alt={`Foto ${employee.fullName}`}
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <DefaultAvatar seed={employee.displayName} color={employee.color} />
      )}
    </span>
  );
}

/**
 * Daftar Pegawai — halaman baca-saja untuk seluruh peran.
 * Pengelolaan data & foto dilakukan Admin lewat Admin › Pegawai.
 */
export default function EmployeesPage() {
  const employeesQ = useEmployees(true);
  const { role } = useSessionStore();
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');
  const [status, setStatus] = useState<StatusFilter>('AKTIF');
  const [detail, setDetail] = useState<Employee | null>(null);

  const employees = useMemo(() => employeesQ.data ?? [], [employeesQ.data]);
  const photosQ = useEmployeePhotos(employees);
  const photoUrls = photosQ.data ?? {};

  const positions = useMemo(
    () =>
      [...new Set(employees.map((e) => e.position).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'id'),
      ),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (status === 'AKTIF' && !e.active) return false;
      if (status === 'NONAKTIF' && e.active) return false;
      if (position && e.position !== position) return false;
      if (
        q &&
        !e.fullName.toLowerCase().includes(q) &&
        !e.displayName.toLowerCase().includes(q) &&
        !e.position.toLowerCase().includes(q) &&
        !(e.nip ?? '').includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [employees, search, position, status]);

  if (employeesQ.isError) {
    return <ErrorState error={employeesQ.error} onRetry={() => void employeesQ.refetch()} />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">
            {employees.filter((e) => e.active).length} pegawai aktif · data dikelola oleh Admin
          </p>
        </div>
        {role === 'ADMIN' && (
          <Link
            to={`${ROUTES.admin}/pegawai`}
            className="pressable inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-brand-50 hover:text-brand-700"
          >
            <Settings2 className="size-4" aria-hidden />
            Kelola pegawai
          </Link>
        )}
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, jabatan, NIP…"
            aria-label="Cari pegawai"
            className="h-10 w-56 pl-9 lg:w-72"
          />
        </div>
        <Field label="Jabatan" className="w-44">
          <Select value={position} onChange={(e) => setPosition(e.target.value)}>
            <option value="">Semua jabatan</option>
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" className="w-32">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="AKTIF">Aktif</option>
            <option value="SEMUA">Semua</option>
            <option value="NONAKTIF">Nonaktif</option>
          </Select>
        </Field>
      </div>

      {/* Grid pegawai */}
      {employeesQ.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Pegawai tidak ditemukan"
          description="Coba ubah kata kunci pencarian atau filter."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((emp, i) => (
            <li key={emp.id}>
              <button
                type="button"
                onClick={() => setDetail(emp)}
                aria-label={`Lihat detail ${emp.fullName}`}
                style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                className="liftable pressable animate-fade-in-up flex h-full w-full cursor-pointer flex-col items-center rounded-2xl border border-slate-200/80 bg-white p-4 text-center shadow-(--shadow-card)"
              >
                <EmployeePhoto
                  employee={emp}
                  url={emp.avatarPath ? photoUrls[emp.avatarPath] : undefined}
                  className="size-20 2xl:size-24"
                />
                <p className="mt-3 line-clamp-2 text-sm leading-snug font-bold text-slate-900 2xl:text-base">
                  {emp.fullName}
                </p>
                <p className="mt-0.5 line-clamp-2 min-h-4 text-xs text-slate-500 2xl:text-sm">
                  {emp.position || '—'}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
                  <Badge tone="brand">{emp.displayName}</Badge>
                  {!emp.active && <Badge tone="neutral">Nonaktif</Badge>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Detail pegawai (baca-saja) */}
      <Modal
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title={detail?.fullName ?? ''}
        description="Profil pegawai"
      >
        {detail && (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <EmployeePhoto
              employee={detail}
              url={detail.avatarPath ? photoUrls[detail.avatarPath] : undefined}
              className="size-28"
            />
            <dl className="w-full space-y-2.5 text-sm">
              <div className="flex items-start gap-2.5">
                <UserRound className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                <div>
                  <dt className="text-[11px] font-bold text-slate-500 uppercase">Tag board</dt>
                  <dd className="flex items-center gap-2 font-semibold text-slate-800">
                    <Avatar employee={detail} size="xs" showInactive />
                    {detail.displayName}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <IdCard className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                <div>
                  <dt className="text-[11px] font-bold text-slate-500 uppercase">NIP</dt>
                  <dd className="tnum font-semibold text-slate-800">{detail.nip ?? '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                <div>
                  <dt className="text-[11px] font-bold text-slate-500 uppercase">Jabatan</dt>
                  <dd className="font-semibold text-slate-800">{detail.position || '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Users className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                <div>
                  <dt className="text-[11px] font-bold text-slate-500 uppercase">Instansi/Tim</dt>
                  <dd className="font-semibold text-slate-800">{detail.team || '—'}</dd>
                </div>
              </div>
              <div className="pt-1">
                <Badge tone={detail.active ? 'success' : 'neutral'}>
                  {detail.active ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </div>
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}
