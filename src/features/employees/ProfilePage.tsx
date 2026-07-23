import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  IdCard,
  KeyRound,
  ListChecks,
  OctagonAlert,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useConfirm } from '@/components/feedback/confirm-dialog';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { notify } from '@/components/feedback/toaster';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { DefaultAvatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelative, todayISO } from '@/lib/format';
import { employeeProfilePath, ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/errors';
import { getDataService } from '@/services';
import type { Task } from '@/services/types';
import { AvatarCropperDialog } from '@/features/admin/sections/AvatarCropperDialog';
import { ChangePasswordDialog } from '@/features/auth/ChangePasswordDialog';
import { useSessionStore } from '@/features/auth/session-store';
import {
  useEmployeeAccounts,
  useEmployeePhotos,
  useEmployees,
  useRecentActivity,
  useSteps,
  useTasks,
} from '@/hooks/queries';
import {
  employeeWorkSummary,
  filterProfileTasks,
  PROFILE_FILTER_LABEL,
  type ProfileTaskFilter,
} from './lib';

const FILTERS: ProfileTaskFilter[] = [
  'SEMUA',
  'PIC_UTAMA',
  'ANGGOTA',
  'DIBUAT',
  'AKTIF',
  'SELESAI',
  'TERLAMBAT',
  'ARSIP',
];

function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'brand',
}: {
  label: string;
  value: string | number;
  icon: typeof ListChecks;
  tone?: 'brand' | 'success' | 'danger' | 'warning';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-emerald-50 text-emerald-700',
    danger: 'bg-danger-50 text-danger-600',
    warning: 'bg-amber-50 text-amber-700',
  } as const;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">
      <span
        aria-hidden
        className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-xl', tones[tone])}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-lg leading-tight font-extrabold text-slate-900">{value}</span>
        <span className="block truncate text-xs font-medium text-slate-500">{label}</span>
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] items-start gap-2 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 font-semibold break-words text-slate-800">{value || '—'}</dd>
    </div>
  );
}

/**
 * Profil Pegawai (§N) & Profil Saya (§O).
 *
 * Halaman ini dibuka lewat foto/nama pegawai atau avatar header — bukan menu
 * sidebar. Tidak menampilkan ranking maupun skor kinerja.
 */
export default function ProfilePage({ self = false }: { self?: boolean }) {
  const params = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const { role, accountEmployeeId, actorId } = useSessionStore();
  const employeesQ = useEmployees(true);
  const stepsQ = useSteps();
  const tasksQ = useTasks({ includeArchived: true });
  const activityQ = useRecentActivity(50);
  const accountsQ = useEmployeeAccounts(role === 'ADMIN');

  const employeeId = self ? accountEmployeeId : (params.id ?? null);
  const employees = useMemo(() => employeesQ.data ?? [], [employeesQ.data]);
  const employee = employees.find((e) => e.id === employeeId) ?? null;
  const { data: photos } = useEmployeePhotos(employee ? [employee] : []);

  const [filter, setFilter] = useState<ProfileTaskFilter>('SEMUA');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isSelf = Boolean(employeeId && employeeId === accountEmployeeId);
  const isAdmin = role === 'ADMIN';
  const today = todayISO();

  const summary = useMemo(
    () =>
      employeeId
        ? employeeWorkSummary(tasksQ.data ?? [], stepsQ.data ?? [], employeeId, today)
        : null,
    [tasksQ.data, stepsQ.data, employeeId, today],
  );

  const relatedTasks = useMemo(
    () =>
      employeeId
        ? filterProfileTasks(tasksQ.data ?? [], stepsQ.data ?? [], employeeId, filter, today)
        : [],
    [tasksQ.data, stepsQ.data, employeeId, filter, today],
  );

  const activities = useMemo(
    () => (activityQ.data ?? []).filter((a) => a.employeeId === employeeId).slice(0, 10),
    [activityQ.data, employeeId],
  );

  const account = accountsQ.data?.find((a) => a.employeeId === employeeId) ?? null;
  const supervisor = employee?.supervisorId
    ? (employees.find((e) => e.id === employee.supervisorId) ?? null)
    : null;

  if (employeesQ.isError || stepsQ.isError) {
    return (
      <Card>
        <ErrorState
          error={employeesQ.error ?? stepsQ.error}
          onRetry={() => void employeesQ.refetch()}
        />
      </Card>
    );
  }

  if (employeesQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!employee) {
    return (
      <Card>
        <EmptyState
          icon={UserRound}
          title={self ? 'Akun ini belum terhubung ke data pegawai' : 'Pegawai tidak ditemukan'}
          description={
            self
              ? 'Profil pribadi hanya tersedia untuk akun pegawai. Hubungi Admin bila ini keliru.'
              : 'Data pegawai mungkin sudah dihapus atau tautan tidak lagi berlaku.'
          }
          action={
            <Button variant="secondary" onClick={() => navigate(ROUTES.pegawai)}>
              Buka Daftar Pegawai
            </Button>
          }
        />
      </Card>
    );
  }

  const photoUrl = photos?.[employee.avatarPath ?? ''] ?? null;

  async function handlePhoto(blob: Blob) {
    const ctx = actorId ? { employeeId: actorId } : null;
    if (!ctx || !employee) {
      notify.warning('Pilih pegawai pelaku terlebih dahulu.');
      return;
    }
    try {
      await getDataService().employees.setPhoto(employee.id, blob, ctx);
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'employees' });
      notify.success('Foto profil diperbarui.');
    } catch (err) {
      notify.error('Gagal memperbarui foto', errorMessage(err));
    }
  }

  async function handleRemovePhoto() {
    const ctx = actorId ? { employeeId: actorId } : null;
    if (!ctx || !employee) return;
    const ok = await confirm({
      title: 'Hapus foto profil?',
      description: 'Avatar bawaan akan dipakai kembali.',
      confirmLabel: 'Hapus foto',
      danger: true,
    });
    if (!ok) return;
    try {
      await getDataService().employees.removePhoto(employee.id, ctx);
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'employees' });
      notify.success('Foto profil dihapus.');
    } catch (err) {
      notify.error('Gagal menghapus foto', errorMessage(err));
    }
  }

  async function handleResetPassword() {
    if (!employee) return;
    const ok = await confirm({
      title: `Reset password ${employee.displayName}?`,
      description:
        'Password kembali ke password sementara dan wajib diganti pada login berikutnya. Sesi lama pegawai ini dicabut.',
      confirmLabel: 'Reset password',
      danger: true,
    });
    if (!ok) return;
    try {
      await getDataService().accounts.resetPassword(employee.id);
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'accounts' });
      notify.success('Password direset ke password sementara.');
    } catch (err) {
      notify.error('Gagal mereset password', errorMessage(err));
    }
  }

  async function handleToggleAccount() {
    if (!employee || !account) return;
    const next = !account.isActive;
    const ok = await confirm({
      title: next ? 'Aktifkan akun pegawai?' : 'Nonaktifkan akun pegawai?',
      description: next
        ? 'Pegawai dapat masuk kembali memakai password terakhirnya.'
        : 'Pegawai tidak dapat masuk dan seluruh sesi aktifnya dicabut.',
      confirmLabel: next ? 'Aktifkan' : 'Nonaktifkan',
      danger: !next,
    });
    if (!ok) return;
    try {
      await getDataService().accounts.setActive(employee.id, next);
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'accounts' });
      notify.success(next ? 'Akun diaktifkan.' : 'Akun dinonaktifkan.');
    } catch (err) {
      notify.error('Gagal mengubah status akun', errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" aria-hidden />
          Kembali
        </Button>
        <h1 className="text-lg font-bold text-slate-900">
          {self ? 'Profil Saya' : 'Profil Pegawai'}
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
        {/* ---------------------------------------------------------- Identitas */}
        <Card className="p-5">
          <div className="flex flex-col items-center text-center">
            <span className="relative inline-flex size-28 items-center justify-center overflow-hidden rounded-3xl bg-slate-100">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={`Foto ${employee.fullName}`}
                  className="size-full object-cover"
                />
              ) : (
                <DefaultAvatar seed={employee.displayName} color={employee.color} />
              )}
            </span>
            <p className="mt-3 text-base leading-tight font-bold text-slate-900">
              {employee.fullName}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">{employee.position || 'Jabatan belum diisi'}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              <Badge tone={employee.level === 'LEADER' ? 'brand' : 'neutral'}>
                {employee.level === 'LEADER' ? 'Pimpinan' : 'Staf'}
              </Badge>
              {!employee.active && <Badge tone="warning">Pegawai nonaktif</Badge>}
              {account && (
                <Badge tone={account.isActive ? 'success' : 'warning'}>
                  {account.hasAccount
                    ? account.isActive
                      ? 'Akun aktif'
                      : 'Akun nonaktif'
                    : 'Belum punya akun'}
                </Badge>
              )}
            </div>

            {(isSelf || isAdmin) && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file) setCropFile(file);
                    e.target.value = '';
                  }}
                />
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                  <Camera className="size-4" aria-hidden />
                  Ganti foto
                </Button>
                {employee.avatarPath && (
                  <Button variant="ghost" size="sm" onClick={() => void handleRemovePhoto()}>
                    <Trash2 className="size-4" aria-hidden />
                    Hapus foto
                  </Button>
                )}
              </div>
            )}
            {isSelf && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => setPasswordOpen(true)}
              >
                <KeyRound className="size-4" aria-hidden />
                Ganti password
              </Button>
            )}
          </div>

          <dl className="mt-5 divide-y divide-slate-100 border-t border-slate-100 pt-3">
            <InfoRow label="NIP" value={employee.nip ?? <span className="text-amber-600">Perlu dilengkapi</span>} />
            <InfoRow label="Username" value={employee.username ?? <span className="text-amber-600">Perlu dilengkapi</span>} />
            <InfoRow label="Unit / Tim" value={employee.team} />
            <InfoRow
              label="Atasan langsung"
              value={
                supervisor ? (
                  <Link
                    to={employeeProfilePath(supervisor.id)}
                    className="text-brand-700 underline-offset-2 hover:underline"
                  >
                    {supervisor.fullName}
                  </Link>
                ) : (
                  <span className="text-slate-400">Belum ditetapkan</span>
                )
              }
            />
            {account?.lastLoginAt && (
              <InfoRow label="Terakhir masuk" value={formatDateTime(account.lastLoginAt)} />
            )}
            {account?.mustChangePassword && (
              <InfoRow label="Status password" value={<Badge tone="warning">Wajib diganti</Badge>} />
            )}
          </dl>

          {(isSelf || isAdmin) && (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              NIP, jabatan, unit, tingkat Pimpinan/Staf, atasan langsung, dan hak akses hanya dapat
              diubah Admin lewat Pusat Admin.
            </p>
          )}

          {isAdmin && account?.hasAccount && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void handleResetPassword()}>
                <KeyRound className="size-4" aria-hidden />
                Reset password
              </Button>
              <Button
                variant={account.isActive ? 'ghost' : 'secondary'}
                size="sm"
                onClick={() => void handleToggleAccount()}
              >
                {account.isActive ? 'Nonaktifkan akun' : 'Aktifkan akun'}
              </Button>
            </div>
          )}
        </Card>

        {/* --------------------------------------------------- Ringkasan & tugas */}
        <div className="space-y-4">
          <Card className="p-4">
            <CardHeader
              title="Ringkasan pekerjaan"
              description="Untuk pemantauan pekerjaan — bukan penilaian kinerja."
            />
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Pekerjaan aktif" value={summary?.active ?? 0} icon={ListChecks} />
              <StatTile
                label="Selesai"
                value={summary?.done ?? 0}
                icon={CheckCircle2}
                tone="success"
              />
              <StatTile
                label="Terlambat"
                value={summary?.overdue ?? 0}
                icon={Clock}
                tone="danger"
              />
              <StatTile
                label="Terhambat"
                value={summary?.blocked ?? 0}
                icon={OctagonAlert}
                tone="warning"
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={summary?.completionPercent ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Persentase penyelesaian"
              >
                <div
                  className="h-full rounded-full bg-(image:--gradient-brand)"
                  style={{ width: `${summary?.completionPercent ?? 0}%` }}
                />
              </div>
              <span className="tnum text-sm font-bold text-slate-700">
                {summary?.completionPercent ?? 0}%
              </span>
            </div>
          </Card>

          <Card className="p-4">
            <CardHeader title="Pekerjaan terkait" />
            <div
              role="group"
              aria-label="Saringan pekerjaan"
              className="mt-3 flex flex-wrap gap-1.5"
            >
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'pressable min-h-8 cursor-pointer rounded-full border px-3 text-xs font-semibold transition-colors',
                    filter === f
                      ? 'border-brand-300 bg-brand-50 text-brand-800'
                      : 'border-slate-200 text-slate-600 hover:border-brand-200 hover:text-brand-700',
                  )}
                >
                  {PROFILE_FILTER_LABEL[f]}
                </button>
              ))}
            </div>

            {relatedTasks.length === 0 ? (
              <EmptyState
                compact
                icon={ListChecks}
                title="Tidak ada pekerjaan pada saringan ini"
              />
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {relatedTasks.slice(0, 25).map((task: Task) => (
                  <li key={task.id}>
                    <Link
                      to={`${ROUTES.pekerjaan}?task=${task.id}`}
                      className="pressable flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-brand-50/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">
                          {task.title}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {task.dueDate ? `Tenggat ${task.dueDate}` : 'Tanpa tenggat'}
                          {task.archivedAt ? ' · diarsipkan' : ''}
                          {task.taskType === 'DISPOSISI' ? ' · disposisi' : ''}
                        </span>
                      </span>
                      <Badge tone={task.priority === 'TINGGI' ? 'danger' : 'neutral'}>
                        {task.priority}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <CardHeader title="Aktivitas terakhir" />
            {activities.length === 0 ? (
              <EmptyState compact icon={IdCard} title="Belum ada aktivitas tercatat" />
            ) : (
              <ul className="mt-2 space-y-1.5">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-800">{a.title}</span>
                      {a.detail && <span className="text-slate-500"> · {a.detail}</span>}
                      <span className="block text-xs text-slate-400">{formatRelative(a.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <AvatarCropperDialog
        open={cropFile !== null}
        file={cropFile}
        onOpenChange={(open) => {
          if (!open) setCropFile(null);
        }}
        onConfirm={(blob) => {
          setCropFile(null);
          void handlePhoto(blob);
        }}
      />
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
