/** Logika murni Board — teruji unit, bebas React. */
import type { DurationType, Priority, Step, Task } from '@/services/types';

export interface BoardFilters {
  search: string;
  stepId: string | null;
  categoryId: string | null;
  labelId: string | null;
  priority: Priority | null;
  /** Cocok bila task memiliki SALAH SATU pegawai ini sebagai PIC (utama/tambahan). */
  picIds: string[];
  durationType: DurationType | null;
}

export const EMPTY_FILTERS: BoardFilters = {
  search: '',
  stepId: null,
  categoryId: null,
  labelId: null,
  priority: null,
  picIds: [],
  durationType: null,
};

export function countActiveFilters(f: BoardFilters): number {
  let n = 0;
  if (f.categoryId) n += 1;
  if (f.labelId) n += 1;
  if (f.priority) n += 1;
  if (f.picIds.length > 0) n += 1;
  if (f.durationType) n += 1;
  return n;
}

export function taskMatchesFilters(task: Task, f: BoardFilters): boolean {
  if (f.search) {
    const q = f.search.toLowerCase();
    if (!task.title.toLowerCase().includes(q) && !task.description.toLowerCase().includes(q)) {
      return false;
    }
  }
  if (f.categoryId && task.categoryId !== f.categoryId) return false;
  if (f.labelId && !task.labelIds.includes(f.labelId)) return false;
  if (f.priority && task.priority !== f.priority) return false;
  if (f.picIds.length > 0) {
    const pics = new Set([
      ...task.picMainIds,
      ...(task.picMainId ? [task.picMainId] : []),
      ...task.picIds,
    ]);
    if (!f.picIds.some((id) => pics.has(id))) return false;
  }
  if (f.durationType && task.durationType !== f.durationType) return false;
  return true;
}

/** Kartu per step, terurut, setelah filter (step filter diterapkan di level kolom). */
export function buildColumns(
  tasks: readonly Task[],
  steps: readonly Step[],
  filters: BoardFilters,
): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const step of steps) map.set(step.id, []);
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const task of sorted) {
    if (task.archivedAt || task.deletedAt) continue;
    if (!taskMatchesFilters(task, filters)) continue;
    map.get(task.stepId)?.push(task);
  }
  return map;
}

/** Seluruh PIC sebuah task (utama lebih dulu, tanpa duplikat). */
export function taskPicIds(task: Pick<Task, 'picMainIds' | 'picMainId' | 'picIds'>): string[] {
  return [
    ...new Set([
      ...task.picMainIds,
      ...(task.picMainId ? [task.picMainId] : []),
      ...task.picIds,
    ]),
  ];
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  RENDAH: 'Rendah',
  SEDANG: 'Sedang',
  TINGGI: 'Tinggi',
};

export const DURATION_LABEL: Record<DurationType, string> = {
  JANGKA_PANJANG: 'Jangka panjang',
  JANGKA_PENDEK: 'Jangka pendek',
};

/** Preset warna step (kunci tampilan konsisten). */
export const STEP_COLORS = [
  '#94a3b8',
  '#3579ee',
  '#0d9488',
  '#f59e0b',
  '#ef4444',
  '#10b981',
  '#7c3aed',
  '#e11d48',
] as const;
