import { describe, expect, it } from 'vitest';
import type { Employee, Step, Task } from '@/services/types';
import {
  buildTeamStructure,
  employeeWorkSummary,
  filterProfileTasks,
  relationsOf,
  tasksOfEmployee,
} from './lib';

const STEPS: Step[] = [
  { id: 'todo', boardId: 'b', name: 'To Do', kind: 'NORMAL', color: '#1', sortOrder: 0, deletedAt: null, version: 1 },
  { id: 'block', boardId: 'b', name: 'Blocking', kind: 'BLOCKED', color: '#2', sortOrder: 1, deletedAt: null, version: 1 },
  { id: 'done', boardId: 'b', name: 'Done', kind: 'DONE', color: '#3', sortOrder: 2, deletedAt: null, version: 1 },
];

const TODAY = '2026-07-23';

function employee(partial: Partial<Employee> & { id: string }): Employee {
  return {
    fullName: partial.id,
    displayName: partial.id,
    initials: 'XX',
    color: 'blue',
    nip: null,
    nipNormalized: null,
    username: partial.id,
    position: '',
    team: 'Puslapdik',
    level: 'STAFF',
    supervisorId: null,
    sortOrder: 0,
    active: true,
    avatarPath: null,
    avatarUpdatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    boardId: 'b',
    stepId: 'todo',
    title: partial.id,
    description: '',
    durationType: 'JANGKA_PENDEK',
    categoryId: null,
    labelIds: [],
    priority: 'SEDANG',
    startDate: null,
    dueDate: null,
    progressMode: 'MANUAL',
    manualProgress: 0,
    picMainIds: [],
    picMainId: null,
    picIds: [],
    ownerEmployeeId: null,
    taskType: 'MANDIRI',
    disposedByEmployeeId: null,
    driveFolderId: null,
    checklist: [],
    isFocus: false,
    sortOrder: 0,
    archivedAt: null,
    deletedAt: null,
    deleteReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 1,
    createdByEmployeeId: null,
    updatedByEmployeeId: null,
    ...partial,
  };
}

describe('keterkaitan pegawai dengan pekerjaan', () => {
  it('mengenali PIC utama, anggota, pembuat, dan pemilik', () => {
    const t = task({
      id: 't1',
      picMainIds: ['nur'],
      picIds: ['ulfi'],
      createdByEmployeeId: 'thoriq',
      ownerEmployeeId: 'thoriq',
    });
    expect(relationsOf(t, 'nur')).toContain('PIC_UTAMA');
    expect(relationsOf(t, 'ulfi')).toContain('ANGGOTA');
    expect(relationsOf(t, 'thoriq')).toEqual(expect.arrayContaining(['PEMBUAT', 'PEMILIK']));
    expect(relationsOf(t, 'dhani')).toHaveLength(0);
  });

  it('pekerjaan terhapus tidak ikut dihitung', () => {
    const tasks = [
      task({ id: 't1', picMainIds: ['nur'] }),
      task({ id: 't2', picMainIds: ['nur'], deletedAt: '2026-07-01T00:00:00.000Z' }),
    ];
    expect(tasksOfEmployee(tasks, 'nur')).toHaveLength(1);
  });
});

describe('ringkasan pekerjaan pegawai', () => {
  const tasks = [
    task({ id: 'aktif', picMainIds: ['nur'] }),
    task({ id: 'selesai', picMainIds: ['nur'], stepId: 'done' }),
    task({ id: 'terlambat', picMainIds: ['nur'], dueDate: '2026-07-01' }),
    task({ id: 'terhambat', picMainIds: ['nur'], stepId: 'block' }),
    task({ id: 'arsip', picMainIds: ['nur'], archivedAt: '2026-07-01T00:00:00.000Z' }),
    task({ id: 'oranglain', picMainIds: ['ulfi'] }),
  ];

  it('menghitung aktif, selesai, terlambat, terhambat, dan persentase', () => {
    const s = employeeWorkSummary(tasks, STEPS, 'nur', TODAY);
    expect(s.total).toBe(5);
    expect(s.done).toBe(1);
    expect(s.blocked).toBe(1);
    expect(s.overdue).toBe(1);
    // aktif = seluruh pekerjaan tak terarsip di luar step DONE (3: aktif, terlambat, terhambat)
    expect(s.active).toBe(3);
    expect(s.completionPercent).toBe(20);
  });

  it('pegawai tanpa pekerjaan menghasilkan 0% (bukan NaN)', () => {
    const s = employeeWorkSummary(tasks, STEPS, 'kosong', TODAY);
    expect(s.total).toBe(0);
    expect(s.completionPercent).toBe(0);
  });

  it('saringan profil memilih subset yang benar', () => {
    expect(filterProfileTasks(tasks, STEPS, 'nur', 'SELESAI', TODAY).map((t) => t.id)).toEqual([
      'selesai',
    ]);
    expect(filterProfileTasks(tasks, STEPS, 'nur', 'TERLAMBAT', TODAY).map((t) => t.id)).toEqual([
      'terlambat',
    ]);
    expect(filterProfileTasks(tasks, STEPS, 'nur', 'ARSIP', TODAY).map((t) => t.id)).toEqual([
      'arsip',
    ]);
    expect(filterProfileTasks(tasks, STEPS, 'nur', 'SEMUA', TODAY)).toHaveLength(5);
  });
});

describe('struktur tim', () => {
  it('mengelompokkan staf di bawah atasan langsung', () => {
    const employees = [
      employee({ id: 'ketua', level: 'LEADER' }),
      employee({ id: 'nur', supervisorId: 'ketua' }),
      employee({ id: 'ulfi', supervisorId: 'ketua' }),
    ];
    const { teams, tanpaAtasan } = buildTeamStructure(employees);
    expect(teams).toHaveLength(1);
    expect(teams[0]!.members.map((m) => m.id)).toEqual(['nur', 'ulfi']);
    expect(tanpaAtasan).toHaveLength(0);
  });

  it('staf tanpa atasan ikut Pimpinan tunggal pada unit yang sama', () => {
    const employees = [
      employee({ id: 'ketua', level: 'LEADER', team: 'Puslapdik' }),
      employee({ id: 'nur', team: 'Puslapdik' }),
    ];
    const { teams, tanpaAtasan } = buildTeamStructure(employees);
    expect(teams[0]!.members.map((m) => m.id)).toEqual(['nur']);
    expect(tanpaAtasan).toHaveLength(0);
  });

  it('tanpa Pimpinan, seluruh staf masuk daftar tanpa atasan', () => {
    const employees = [employee({ id: 'nur' }), employee({ id: 'ulfi' })];
    const { teams, tanpaAtasan } = buildTeamStructure(employees);
    expect(teams).toHaveLength(0);
    expect(tanpaAtasan).toHaveLength(2);
  });

  it('pegawai nonaktif tidak masuk struktur', () => {
    const employees = [
      employee({ id: 'ketua', level: 'LEADER' }),
      employee({ id: 'lama', active: false, supervisorId: 'ketua' }),
    ];
    const { teams } = buildTeamStructure(employees);
    expect(teams[0]!.members).toHaveLength(0);
  });
});
