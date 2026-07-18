import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Pencil, UserPlus } from 'lucide-react';
import { ErrorState } from '@/components/feedback/error-state';
import { LoadingBlock } from '@/components/feedback/loading-block';
import { notify } from '@/components/feedback/toaster';
import { Avatar, AVATAR_COLOR_KEYS, AVATAR_COLORS } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { arrayMove, cn, initialsFromName } from '@/lib/utils';
import { errorMessage } from '@/services/errors';
import { getDataService } from '@/services';
import type { Employee, EmployeeInput } from '@/services/types';
import { useActorCtx } from '@/features/auth/useActorCtx';
import { useEmployees } from '@/hooks/queries';

export function EmployeesSection() {
  const employeesQ = useEmployees(true);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const getCtx = useActorCtx();
  const queryClient = useQueryClient();

  const employees = employeesQ.data ?? [];

  async function toggleActive(emp: Employee) {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      await getDataService().employees.setActive(emp.id, !emp.active, ctx);
      notify.success(
        emp.active ? `${emp.displayName} dinonaktifkan.` : `${emp.displayName} diaktifkan.`,
        emp.active
          ? 'Tidak dapat dipilih untuk pekerjaan baru; histori lama tetap tampil.'
          : undefined,
      );
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch (err) {
      notify.error('Gagal mengubah status', errorMessage(err));
    }
  }

  async function move(emp: Employee, dir: -1 | 1) {
    const ids = employees.map((e) => e.id);
    const from = ids.indexOf(emp.id);
    const to = from + dir;
    if (to < 0 || to >= ids.length) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      await getDataService().employees.reorder(arrayMove(ids, from, to), ctx);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch (err) {
      notify.error('Gagal mengubah urutan', errorMessage(err));
    }
  }

  if (employeesQ.isLoading) return <LoadingBlock label="Memuat pegawai…" />;
  if (employeesQ.isError) {
    return <ErrorState error={employeesQ.error} onRetry={() => void employeesQ.refetch()} />;
  }

  return (
    <Card>
      <CardHeader
        title="Pegawai & PIC"
        description="Master pegawai untuk pegawai pelaku & PIC. Pegawai dengan histori tidak dapat dihapus — gunakan nonaktif."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <UserPlus className="size-4" aria-hidden />
            Tambah pegawai
          </Button>
        }
      />
      <ul className="divide-y divide-slate-100 p-4 pt-2">
        {employees.map((emp, i) => (
          <li key={emp.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <Avatar employee={emp} showInactive />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                {emp.fullName}
                {!emp.active && <Badge tone="neutral">Nonaktif</Badge>}
              </p>
              <p className="text-xs text-slate-500">
                {[emp.position, emp.team, emp.nip ? `NIP ${emp.nip}` : null]
                  .filter(Boolean)
                  .join(' · ')}{' '}
                · tag board “{emp.displayName}”
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Naikkan urutan ${emp.displayName}`}
                disabled={i === 0}
                onClick={() => void move(emp, -1)}
              >
                <ChevronUp className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Turunkan urutan ${emp.displayName}`}
                disabled={i === employees.length - 1}
                onClick={() => void move(emp, 1)}
              >
                <ChevronDown className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Ubah ${emp.displayName}`}
                onClick={() => {
                  setEditing(emp);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Switch
                checked={emp.active}
                onCheckedChange={() => void toggleActive(emp)}
                aria-label={`Status aktif ${emp.displayName}`}
              />
            </div>
          </li>
        ))}
      </ul>
      <EmployeeDialog open={dialogOpen} onOpenChange={setDialogOpen} employee={editing} />
    </Card>
  );
}

function EmployeeDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}) {
  const [form, setForm] = useState<EmployeeInput>({
    fullName: '',
    displayName: '',
    initials: '',
    color: AVATAR_COLOR_KEYS[0] ?? 'blue',
    nip: '',
    position: '',
    team: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const getCtx = useActorCtx();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm(
        employee
          ? {
              fullName: employee.fullName,
              displayName: employee.displayName,
              initials: employee.initials,
              color: employee.color,
              nip: employee.nip ?? '',
              position: employee.position,
              team: employee.team,
            }
          : {
              fullName: '',
              displayName: '',
              initials: '',
              color: AVATAR_COLOR_KEYS[0] ?? 'blue',
              nip: '',
              position: '',
              team: '',
            },
      );
      setError(null);
    }
  }, [open, employee]);

  async function submit() {
    if (!form.fullName.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    const ctx = getCtx();
    if (!ctx) return;
    const payload: EmployeeInput = {
      ...form,
      displayName: form.displayName.trim() || form.fullName.trim().split(/\s+/)[0]!,
      initials: form.initials.trim() || initialsFromName(form.fullName),
    };
    setBusy(true);
    try {
      if (employee) {
        await getDataService().employees.update(employee.id, payload, ctx);
        notify.success('Pegawai diperbarui.');
      } else {
        await getDataService().employees.create(payload, ctx);
        notify.success('Pegawai ditambahkan.', payload.fullName);
      }
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      onOpenChange(false);
    } catch (err) {
      notify.error('Gagal menyimpan pegawai', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={employee ? 'Ubah Pegawai' : 'Tambah Pegawai'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nama lengkap" required error={error ?? undefined}>
          <Input
            value={form.fullName}
            onChange={(e) => {
              setForm((f) => ({ ...f, fullName: e.target.value }));
              setError(null);
            }}
            placeholder="cth. Budi Santoso"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tag board"
            hint="Satu kata, unik antar pegawai aktif. Kosongkan = kata pertama nama."
          >
            <Input
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="cth. Budi"
            />
          </Field>
          <Field label="Inisial" hint="Kosongkan = otomatis dari nama.">
            <Input
              value={form.initials}
              onChange={(e) => setForm((f) => ({ ...f, initials: e.target.value.toUpperCase() }))}
              maxLength={3}
              placeholder="BS"
            />
          </Field>
          <Field label="NIP" hint="Kosongkan bila tidak ada.">
            <Input
              value={form.nip ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, nip: e.target.value }))}
              inputMode="numeric"
              placeholder="cth. 198102082005011003"
            />
          </Field>
          <Field label="Jabatan">
            <Input
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="cth. Analis Data"
            />
          </Field>
          <Field label="Instansi/Tim">
            <Input
              value={form.team}
              onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))}
              placeholder="cth. Puslapdik"
            />
          </Field>
        </div>
        <Field label="Warna avatar">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Warna avatar">
            {AVATAR_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={form.color === key}
                aria-label={`Warna ${key}`}
                onClick={() => setForm((f) => ({ ...f, color: key }))}
                className={cn(
                  'size-7 cursor-pointer rounded-full transition-transform hover:scale-110',
                  AVATAR_COLORS[key],
                  form.color === key && 'ring-2 ring-slate-900 ring-offset-2',
                )}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
