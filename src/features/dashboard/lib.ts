/** Logika murni Dashboard — teruji unit, bebas React. */
import type { BadgeTone } from '@/components/ui/badge';
import type {
  DistributionRow,
  DistributionSnapshot,
  Jenjang,
  Step,
  StepKind,
  Task,
  TaskComment,
} from '@/services/types';

// ---------------------------------------------------------------------------
// Agregasi penyaluran
// ---------------------------------------------------------------------------

export interface DistributionTotals {
  alokasiSiswa: number;
  alokasiAnggaran: number;
  skSiswa: number;
  skAnggaran: number;
  salurSiswa: number;
  salurAnggaran: number;
  sisaSiswa: number;
  sisaAnggaran: number;
  /** Rasio 0–1. */
  progresSiswa: number;
  progresDana: number;
}

export type JenjangFilter = Jenjang | 'ALL';

export function totalsFromRows(
  rows: readonly DistributionRow[],
  jenjang: JenjangFilter = 'ALL',
): DistributionTotals {
  const filtered = jenjang === 'ALL' ? rows : rows.filter((r) => r.jenjang === jenjang);
  const sum = (fn: (r: DistributionRow) => number) =>
    filtered.reduce((acc, r) => acc + fn(r), 0);
  const alokasiSiswa = sum((r) => r.alokasiSiswa);
  const alokasiAnggaran = sum((r) => r.alokasiAnggaran);
  const salurSiswa = sum((r) => r.salurSiswa);
  const salurAnggaran = sum((r) => r.salurAnggaran);
  return {
    alokasiSiswa,
    alokasiAnggaran,
    skSiswa: sum((r) => r.skSiswa),
    skAnggaran: sum((r) => r.skAnggaran),
    salurSiswa,
    salurAnggaran,
    sisaSiswa: alokasiSiswa - salurSiswa,
    sisaAnggaran: alokasiAnggaran - salurAnggaran,
    progresSiswa: alokasiSiswa > 0 ? salurSiswa / alokasiSiswa : 0,
    progresDana: alokasiAnggaran > 0 ? salurAnggaran / alokasiAnggaran : 0,
  };
}

/** Titik tren dari riwayat snapshot yang pernah aktif pada scope yang sama. */
export interface TrendPoint {
  date: string;
  salurSiswa: number;
  salurAnggaran: number;
}

export function trendSeries(
  snapshots: readonly DistributionSnapshot[],
  year: number,
  period: string,
  jenjang: JenjangFilter = 'ALL',
  maxPoints = 10,
): TrendPoint[] {
  return snapshots
    .filter((s) => s.year === year && s.period === period && s.activatedAt !== null)
    .sort((a, b) => Date.parse(a.activatedAt!) - Date.parse(b.activatedAt!))
    .map((s) => {
      const t = totalsFromRows(s.rows, jenjang);
      return { date: s.activatedAt!, salurSiswa: t.salurSiswa, salurAnggaran: t.salurAnggaran };
    })
    .slice(-maxPoints);
}

// ---------------------------------------------------------------------------
// Perlu Perhatian & Fokus Hari Ini
// ---------------------------------------------------------------------------

export type AttentionKey =
  | 'OVERDUE'
  | 'DUE_TODAY'
  | 'BLOCKED'
  | 'NO_PIC'
  | 'STALE'
  | 'HIGH_PRIORITY';

export interface AttentionReason {
  key: AttentionKey;
  label: string;
  tone: BadgeTone;
}

const REASON_DEFS: Record<AttentionKey, { label: string; tone: BadgeTone; weight: number }> = {
  OVERDUE: { label: 'Melewati tenggat', tone: 'danger', weight: 0 },
  DUE_TODAY: { label: 'Jatuh tempo hari ini', tone: 'warning', weight: 1 },
  BLOCKED: { label: 'Terhambat', tone: 'danger', weight: 2 },
  NO_PIC: { label: 'Belum ada PIC', tone: 'warning', weight: 3 },
  STALE: { label: 'Lama tidak diperbarui', tone: 'neutral', weight: 4 },
  HIGH_PRIORITY: { label: 'Prioritas tinggi', tone: 'brand', weight: 5 },
};

function reason(key: AttentionKey): AttentionReason {
  const def = REASON_DEFS[key];
  return { key, label: def.label, tone: def.tone };
}

export function stepKindMap(steps: readonly Step[]): Map<string, StepKind> {
  return new Map(steps.map((s) => [s.id, s.kind]));
}

/**
 * Alasan sebuah pekerjaan masuk "Perlu Perhatian".
 * Pekerjaan pada step selesai (kind DONE) tidak pernah masuk.
 */
export function attentionReasons(
  task: Task,
  kinds: Map<string, StepKind>,
  staleDays: number,
  todayIso: string,
  nowMs: number = Date.now(),
): AttentionReason[] {
  if (task.archivedAt || task.deletedAt) return [];
  if (kinds.get(task.stepId) === 'DONE') return [];
  const reasons: AttentionReason[] = [];
  if (task.dueDate) {
    if (task.dueDate < todayIso) reasons.push(reason('OVERDUE'));
    else if (task.dueDate === todayIso) reasons.push(reason('DUE_TODAY'));
  }
  if (kinds.get(task.stepId) === 'BLOCKED') reasons.push(reason('BLOCKED'));
  if (!task.picMainId && task.picIds.length === 0) reasons.push(reason('NO_PIC'));
  const ageMs = nowMs - Date.parse(task.updatedAt);
  if (Number.isFinite(ageMs) && ageMs > staleDays * 86_400_000) reasons.push(reason('STALE'));
  if (task.priority === 'TINGGI') reasons.push(reason('HIGH_PRIORITY'));
  return reasons;
}

export function attentionScore(reasons: readonly AttentionReason[]): number {
  if (reasons.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...reasons.map((r) => REASON_DEFS[r.key].weight));
}

/**
 * Task yang "memerlukan tindak lanjut": kendala terakhir lebih baru daripada
 * tindak lanjut terakhir.
 */
export function needsFollowUpIds(comments: readonly TaskComment[]): Set<string> {
  const lastKendala = new Map<string, number>();
  const lastTindakLanjut = new Map<string, number>();
  for (const c of comments) {
    const at = Date.parse(c.createdAt);
    if (c.type === 'KENDALA') {
      lastKendala.set(c.taskId, Math.max(lastKendala.get(c.taskId) ?? 0, at));
    } else if (c.type === 'TINDAK_LANJUT') {
      lastTindakLanjut.set(c.taskId, Math.max(lastTindakLanjut.get(c.taskId) ?? 0, at));
    }
  }
  const ids = new Set<string>();
  for (const [taskId, kendalaAt] of lastKendala) {
    if (kendalaAt > (lastTindakLanjut.get(taskId) ?? 0)) ids.add(taskId);
  }
  return ids;
}

export interface FocusItem {
  task: Task;
  reasons: AttentionReason[];
  needsFollowUp: boolean;
}

/**
 * "Fokus Hari Ini": ditandai fokus, jatuh tempo hari ini, prioritas tinggi,
 * terhambat, atau memerlukan tindak lanjut.
 */
export function isFocusToday(
  task: Task,
  reasons: readonly AttentionReason[],
  needsFollowUp: boolean,
): boolean {
  if (task.archivedAt || task.deletedAt) return false;
  if (task.isFocus) return true;
  if (needsFollowUp) return true;
  return reasons.some(
    (r) => r.key === 'DUE_TODAY' || r.key === 'HIGH_PRIORITY' || r.key === 'BLOCKED',
  );
}

/** Skor urutan Fokus Hari Ini: ditandai fokus paling atas. */
export function focusScore(item: FocusItem): number {
  if (item.task.isFocus) return -1;
  const base = attentionScore(item.reasons);
  return item.needsFollowUp ? Math.min(base, 2.5) : base;
}
