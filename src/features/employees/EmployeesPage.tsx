import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Network, Search, Settings2, Users } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { DefaultAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { employeeProfilePath, ROUTES } from '@/lib/routes';
import type { Employee } from '@/services/types';
import { useSessionStore } from '@/features/auth/session-store';
import {
  useEmployeeAccounts,
  useEmployeePhotos,
  useEmployees,
  useSteps,
  useTasks,
} from '@/hooks/queries';
import { buildTeamStructure, tasksOfEmployee } from './lib';

type StatusFilter = 'AKTIF' | 'SEMUA' | 'NONAKTIF';
type LevelFilter = 'SEMUA' | 'LEADER' | 'STAFF';
type PageView = 'daftar' | 'struktur';

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
 * Daftar Pegawai (spesifikasi §M).
 *
 * Satu menu dengan DUA tampilan internal: "Semua Pegawai" dan "Struktur Tim" —
 * tidak ada menu sidebar "Tim Kerja" terpisah. Foto/nama pegawai membuka
 * Profil Pegawai.
 */
export default function EmployeesPage() {
  const employeesQ = useEmployees(true);
  const stepsQ = useSteps();
  const tasksQ = useTasks({ includeArchived: false });
  const { role } = useSessionStore();
  const accountsQ = useEmployeeAccounts(role === 'ADMIN');
  const navigate = useNavigate();

  const [view, setView] = useState<PageView>('daftar');
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState('');
  const [level, setLevel] = useState<LevelFilter>('SEMUA');
  const [status, setStatus] = useState<StatusFilter>('AKTIF');

  const employees = useMemo(() => employeesQ.data ?? [], [employeesQ.data]);
  const photosQ = useEmployeePhotos(employees);
  const photoUrls = photosQ.data ?? {};
  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const stepKindById = useMemo(
    () => new Map((stepsQ.data ?? []).map((s) => [s.id, s.kind])),
    [stepsQ.data],
  );

  const teams = useMemo(
    () =>
      [...new Set(employees.map((e) => e.team).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'id'),
      ),
    [employees],
  );

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const accountByEmployee = useMemo(
    () => new Map((accountsQ.data ?? []).map((a) => [a.employeeId, a])),
    [accountsQ.data],
  );

  /** Jumlah pekerjaan aktif (belum selesai) per pegawai. */
  const activeCountById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const employee of employees) {
      const related = tasksOfEmployee(tasks, employee.id).filter(
        (t) => stepKindById.get(t.stepId) !== 'DONE',
      );
      counts.set(employee.id, related.length);
    }
    return counts;
  }, [employees, tasks, stepKindById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (status === 'AKTIF' && !e.active) return false;
      if (status === 'NONAKTIF' && e.active) return false;
      if (level !== 'SEMUA' && e.level !== level) return false;
      if (team && e.team !== team) return false;
      if (
        q &&
        !e.fullName.toLowerCase().includes(q) &&
        !e.displayName.toLowerCase().includes(q) &&
        !(e.username ?? '').includes(q) &&
        !e.position.toLowerCase().includes(q) &&
        !(e.nip ?? '').includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [employees, search, team, level, status]);

  const structure = useMemo(() => buildTeamStructure(employees), [employees]);

  if (employeesQ.isError) {
    return <ErrorState error={employeesQ.error} onRetry={() => void employeesQ.refetch()} />;
  }

  const personCard = (emp: Employee, index = 0) => (
    <button
      type="button"
      onClick={() => navigate(employeeProfilePath(emp.id))}
      aria-label={`Buka profil ${emp.fullName}`}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
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
      <p className="tnum mt-0.5 text-[11px] text-slate-400">{emp.nip ?? 'NIP belum diisi'}</p>
      <p className="mt-0.5 line-clamp-2 min-h-4 text-xs text-slate-500 2xl:text-sm">
        {emp.position || '—'}
      </p>
      <p className="mt-0.5 text-xs text-slate-400">{emp.team || '—'}</p>
      {emp.supervisorId && (
        <p className="mt-0.5 text-[11px] text-slate-400">
          Atasan: {byId.get(emp.supervisorId)?.displayName ?? '—'}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
        <Badge tone={emp.level === 'LEADER' ? 'brand' : 'neutral'}>
          {emp.level === 'LEADER' ? 'Pimpinan' : 'Staf'}
        </Badge>
        {emp.username && <Badge tone="neutral">@{emp.username}</Badge>}
        {!emp.active && <Badge tone="warning">Nonaktif</Badge>}
        {role === 'ADMIN' && accountByEmployee.has(emp.id) && (
          <Badge tone={accountByEmployee.get(emp.id)?.isActive ? 'success' : 'warning'}>
            {accountByEmployee.get(emp.id)?.hasAccount
              ? accountByEmployee.get(emp.id)?.isActive
                ? 'Akun aktif'
                : 'Akun nonaktif'
              : 'Belum ada akun'}
          </Badge>
        )}
      </div>
      <p className="mt-2 text-xs font-semibold text-brand-700">
        {activeCountById.get(emp.id) ?? 0} pekerjaan aktif
      </p>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">
            {employees.filter((e) => e.active).length} pegawai aktif · data dikelola oleh Admin
          </p>
        </div>
        <div
          role="group"
          aria-label="Tampilan daftar pegawai"
          className="inline-flex items-center gap-1 rounded-xl bg-slate-200/60 p-1"
        >
          {(
            [
              { value: 'daftar', label: 'Semua Pegawai', icon: Users },
              { value: 'struktur', label: 'Struktur Tim', icon: Network },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={view === opt.value}
              onClick={() => setView(opt.value)}
              className={cn(
                'pressable inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors',
                view === opt.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <opt.icon className="size-4" aria-hidden />
              {opt.label}
            </button>
          ))}
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
      </div>

      {view === 'daftar' && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, username, jabatan, NIP…"
              aria-label="Cari pegawai"
              className="h-10 w-56 pl-9 lg:w-72"
            />
          </div>
          <Field label="Tingkat" className="w-40">
            <Select value={level} onChange={(e) => setLevel(e.target.value as LevelFilter)}>
              <option value="SEMUA">Semua</option>
              <option value="LEADER">Pimpinan</option>
              <option value="STAFF">Staf</option>
            </Select>
          </Field>
          <Field label="Unit / Tim" className="w-52">
            <Select value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">Semua unit</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status akun" className="w-36">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="AKTIF">Aktif</option>
              <option value="SEMUA">Semua</option>
              <option value="NONAKTIF">Nonaktif</option>
            </Select>
          </Field>
        </div>
      )}

      {employeesQ.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : view === 'struktur' ? (
        /* ------------------------------------------------------ Struktur Tim */
        <div className="space-y-4">
          {structure.teams.length === 0 ? (
            <EmptyState
              icon={Network}
              title="Struktur tim belum ditetapkan"
              description="Admin dapat menetapkan tingkat Pimpinan/Staf dan atasan langsung pada Pusat Admin › Pegawai."
            />
          ) : (
            structure.teams.map((node) => (
              <Card key={node.leader.id} className="p-4">
                <CardHeader
                  title={`${node.leader.fullName} · Pimpinan`}
                  description={`${node.leader.position || 'Jabatan belum diisi'} — ${node.members.length} anggota`}
                />
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  <div>{personCard(node.leader)}</div>
                  {node.members.map((member, i) => (
                    <div key={member.id}>{personCard(member, i)}</div>
                  ))}
                </div>
              </Card>
            ))
          )}
          {structure.tanpaAtasan.length > 0 && (
            <Card className="p-4">
              <CardHeader
                title="Belum memiliki atasan langsung"
                description="Tetapkan atasan langsung pada Pusat Admin › Pegawai agar struktur lengkap."
              />
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {structure.tanpaAtasan.map((emp, i) => (
                  <div key={emp.id}>{personCard(emp, i)}</div>
                ))}
              </div>
            </Card>
          )}
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
            <li key={emp.id}>{personCard(emp, i)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
