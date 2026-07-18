import { describe, expect, it } from 'vitest';
import type { Step, Task } from '@/services/types';
import { buildColumns, countActiveFilters, EMPTY_FILTERS, taskMatchesFilters } from './lib';

function makeTask(partial: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    boardId: 'b',
    stepId: 's1',
    title: 'Tugas',
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
    checklist: [],
    isFocus: false,
    sortOrder: 0,
    archivedAt: null,
    deletedAt: null,
    deleteReason: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    version: 1,
    createdByEmployeeId: null,
    updatedByEmployeeId: null,
    ...partial,
  };
}

const steps: Step[] = [
  { id: 's1', boardId: 'b', name: 'A', kind: 'NORMAL', color: '#000', sortOrder: 0, deletedAt: null, version: 1 },
  { id: 's2', boardId: 'b', name: 'B', kind: 'NORMAL', color: '#000', sortOrder: 1, deletedAt: null, version: 1 },
];

describe('taskMatchesFilters', () => {
  it('mencari pada judul dan deskripsi (case-insensitive)', () => {
    const t = makeTask({ title: 'Rekonsiliasi Bank', description: 'Data Juni' });
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, search: 'rekon' })).toBe(true);
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, search: 'juni' })).toBe(true);
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, search: 'zzz' })).toBe(false);
  });

  it('filter kategori, label, prioritas, durasi', () => {
    const t = makeTask({
      categoryId: 'c1',
      labelIds: ['l1', 'l2'],
      priority: 'TINGGI',
      durationType: 'JANGKA_PANJANG',
    });
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, categoryId: 'c1' })).toBe(true);
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, categoryId: 'c2' })).toBe(false);
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, labelId: 'l2' })).toBe(true);
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, labelId: 'lx' })).toBe(false);
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, priority: 'TINGGI' })).toBe(true);
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, durationType: 'JANGKA_PENDEK' })).toBe(false);
  });

  it('filter PIC mencakup PIC utama (multi) dan tambahan', () => {
    const t = makeTask({ picMainIds: ['e1', 'e4'], picMainId: 'e1', picIds: ['e2'] });
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, picIds: ['e1'] })).toBe(true);
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, picIds: ['e4'] })).toBe(true);
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, picIds: ['e2'] })).toBe(true);
    expect(taskMatchesFilters(t, { ...EMPTY_FILTERS, picIds: ['e3'] })).toBe(false);
    // Data lama: hanya picMainId terisi (picMainIds kosong)
    const lama = makeTask({ picMainIds: [], picMainId: 'e9', picIds: [] });
    expect(taskMatchesFilters(lama, { ...EMPTY_FILTERS, picIds: ['e9'] })).toBe(true);
  });
});

describe('buildColumns', () => {
  it('mengelompokkan per step, urut sortOrder, tanpa arsip/terhapus', () => {
    const tasks = [
      makeTask({ id: 't2', stepId: 's1', sortOrder: 1 }),
      makeTask({ id: 't1', stepId: 's1', sortOrder: 0 }),
      makeTask({ id: 't3', stepId: 's2', sortOrder: 0 }),
      makeTask({ id: 'arsip', stepId: 's1', archivedAt: '2026-07-01T00:00:00Z' }),
      makeTask({ id: 'hapus', stepId: 's1', deletedAt: '2026-07-01T00:00:00Z' }),
    ];
    const cols = buildColumns(tasks, steps, EMPTY_FILTERS);
    expect(cols.get('s1')?.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(cols.get('s2')?.map((t) => t.id)).toEqual(['t3']);
  });
});

describe('countActiveFilters', () => {
  it('menghitung filter aktif (tanpa search/step)', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, categoryId: 'c', priority: 'TINGGI', search: 'x' }),
    ).toBe(2);
  });
});
