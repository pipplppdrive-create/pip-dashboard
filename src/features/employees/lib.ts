/**
 * Logika murni Daftar Pegawai & Profil Pegawai — teruji unit, bebas React.
 *
 * Ringkasan di sini adalah alat PEMANTAUAN PEKERJAAN, bukan penilaian kinerja
 * ASN: tidak ada skor, predikat, maupun peringkat antar-pegawai.
 */
import type { Employee, Step, StepKind, Task } from '@/services/types';

export type EmployeeRelation = 'PIC_UTAMA' | 'ANGGOTA' | 'PEMBUAT' | 'PEMILIK';

export interface EmployeeWorkSummary {
  active: number;
  done: number;
  overdue: number;
  blocked: number;
  /** Persentase pekerjaan selesai dari seluruh pekerjaan terkait (0–100). */
  completionPercent: number;
  total: number;
}

/** Peta stepId → perilaku step (NORMAL/BLOCKED/DONE). */
export function stepKinds(steps: readonly Step[]): Map<string, StepKind> {
  return new Map(steps.map((s) => [s.id, s.kind]));
}

/** Semua keterkaitan pegawai dengan sebuah pekerjaan (bisa lebih dari satu). */
export function relationsOf(task: Task, employeeId: string): EmployeeRelation[] {
  const relations: EmployeeRelation[] = [];
  if (task.picMainIds.includes(employeeId) || task.picMainId === employeeId) {
    relations.push('PIC_UTAMA');
  }
  if (task.picIds.includes(employeeId)) relations.push('ANGGOTA');
  if (task.createdByEmployeeId === employeeId) relations.push('PEMBUAT');
  if (task.ownerEmployeeId === employeeId) relations.push('PEMILIK');
  return relations;
}

/** Pekerjaan yang melibatkan pegawai (PIC utama, anggota, pembuat, pemilik). */
export function tasksOfEmployee(tasks: readonly Task[], employeeId: string): Task[] {
  return tasks.filter((t) => !t.deletedAt && relationsOf(t, employeeId).length > 0);
}

export function isOverdue(task: Task, kinds: Map<string, StepKind>, todayIso: string): boolean {
  if (!task.dueDate || task.archivedAt || task.deletedAt) return false;
  if (kinds.get(task.stepId) === 'DONE') return false;
  return task.dueDate < todayIso;
}

/** Ringkasan pekerjaan seorang pegawai untuk kartu profil. */
export function employeeWorkSummary(
  tasks: readonly Task[],
  steps: readonly Step[],
  employeeId: string,
  todayIso: string,
): EmployeeWorkSummary {
  const kinds = stepKinds(steps);
  const related = tasksOfEmployee(tasks, employeeId);
  const live = related.filter((t) => !t.archivedAt);

  const done = related.filter((t) => kinds.get(t.stepId) === 'DONE').length;
  const active = live.filter((t) => kinds.get(t.stepId) !== 'DONE').length;
  const blocked = live.filter((t) => kinds.get(t.stepId) === 'BLOCKED').length;
  const overdue = live.filter((t) => isOverdue(t, kinds, todayIso)).length;
  const total = related.length;

  return {
    active,
    done,
    overdue,
    blocked,
    total,
    completionPercent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

export type ProfileTaskFilter =
  | 'SEMUA'
  | 'PIC_UTAMA'
  | 'ANGGOTA'
  | 'DIBUAT'
  | 'AKTIF'
  | 'SELESAI'
  | 'TERLAMBAT'
  | 'ARSIP';

export const PROFILE_FILTER_LABEL: Record<ProfileTaskFilter, string> = {
  SEMUA: 'Semua',
  PIC_UTAMA: 'PIC utama',
  ANGGOTA: 'Anggota tim',
  DIBUAT: 'Dibuat pegawai ini',
  AKTIF: 'Aktif',
  SELESAI: 'Selesai',
  TERLAMBAT: 'Terlambat',
  ARSIP: 'Diarsipkan',
};

/** Saring pekerjaan terkait pegawai sesuai pilihan filter profil. */
export function filterProfileTasks(
  tasks: readonly Task[],
  steps: readonly Step[],
  employeeId: string,
  filter: ProfileTaskFilter,
  todayIso: string,
): Task[] {
  const kinds = stepKinds(steps);
  const related = tasksOfEmployee(tasks, employeeId);
  switch (filter) {
    case 'PIC_UTAMA':
      return related.filter((t) => relationsOf(t, employeeId).includes('PIC_UTAMA'));
    case 'ANGGOTA':
      return related.filter((t) => relationsOf(t, employeeId).includes('ANGGOTA'));
    case 'DIBUAT':
      return related.filter((t) => t.createdByEmployeeId === employeeId);
    case 'AKTIF':
      return related.filter((t) => !t.archivedAt && kinds.get(t.stepId) !== 'DONE');
    case 'SELESAI':
      return related.filter((t) => kinds.get(t.stepId) === 'DONE');
    case 'TERLAMBAT':
      return related.filter((t) => isOverdue(t, kinds, todayIso));
    case 'ARSIP':
      return related.filter((t) => Boolean(t.archivedAt));
    case 'SEMUA':
    default:
      return related;
  }
}

// ---------------------------------------------------------------------------
// Struktur tim (tampilan internal Daftar Pegawai — bukan menu terpisah)
// ---------------------------------------------------------------------------

export interface TeamNode {
  leader: Employee;
  members: Employee[];
}

/**
 * Susun struktur tim dari atasan langsung.
 * Pegawai tanpa atasan dikelompokkan di bawah Pimpinan pada unit yang sama;
 * bila tetap tidak ada, dikembalikan pada daftar `tanpaAtasan`.
 */
export function buildTeamStructure(employees: readonly Employee[]): {
  teams: TeamNode[];
  tanpaAtasan: Employee[];
} {
  const active = employees.filter((e) => e.active);
  const leaders = active.filter((e) => e.level === 'LEADER');
  const byId = new Map(active.map((e) => [e.id, e]));

  const teams: TeamNode[] = leaders.map((leader) => ({ leader, members: [] }));
  const teamByLeader = new Map(teams.map((t) => [t.leader.id, t]));
  const tanpaAtasan: Employee[] = [];

  for (const employee of active) {
    if (employee.level === 'LEADER') continue;
    const supervisor = employee.supervisorId ? byId.get(employee.supervisorId) : undefined;
    const team =
      (supervisor && teamByLeader.get(supervisor.id)) ??
      // Tanpa atasan eksplisit: ikut Pimpinan pada unit yang sama bila tunggal.
      (() => {
        const sameUnit = teams.filter((t) => t.leader.team === employee.team);
        return sameUnit.length === 1 ? sameUnit[0] : undefined;
      })();
    if (team) team.members.push(employee);
    else tanpaAtasan.push(employee);
  }

  return { teams, tanpaAtasan };
}
