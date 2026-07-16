import { describe, expect, it } from 'vitest';
import type { DistributionRow, Task, TaskComment } from '@/services/types';
import {
  attentionReasons,
  attentionScore,
  isFocusToday,
  needsFollowUpIds,
  totalsFromRows,
  trendSeries,
} from './lib';

const rows: DistributionRow[] = [
  {
    jenjang: 'SD',
    alokasiSiswa: 100,
    alokasiAnggaran: 45_000,
    skSiswa: 90,
    skAnggaran: 40_500,
    salurSiswa: 80,
    salurAnggaran: 36_000,
  },
  {
    jenjang: 'SMP',
    alokasiSiswa: 50,
    alokasiAnggaran: 37_500,
    skSiswa: 40,
    skAnggaran: 30_000,
    salurSiswa: 25,
    salurAnggaran: 18_750,
  },
];

function makeTask(partial: Partial<Task>): Task {
  return {
    id: 't1',
    boardId: 'b',
    stepId: 'step-normal',
    title: 'Uji',
    description: '',
    durationType: 'JANGKA_PENDEK',
    categoryId: null,
    labelIds: [],
    priority: 'SEDANG',
    startDate: null,
    dueDate: null,
    progressMode: 'MANUAL',
    manualProgress: 0,
    picMainId: 'emp-1',
    picIds: [],
    checklist: [],
    isFocus: false,
    sortOrder: 0,
    archivedAt: null,
    deletedAt: null,
    deleteReason: null,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    version: 1,
    createdByEmployeeId: null,
    updatedByEmployeeId: null,
    ...partial,
  };
}

const kinds = new Map<string, 'NORMAL' | 'BLOCKED' | 'DONE'>([
  ['step-normal', 'NORMAL'],
  ['step-blocked', 'BLOCKED'],
  ['step-done', 'DONE'],
]);

const TODAY = '2026-07-16';
const NOW = Date.parse('2026-07-16T08:00:00.000Z');

describe('totalsFromRows', () => {
  it('menjumlahkan seluruh jenjang dan menghitung sisa & progres', () => {
    const t = totalsFromRows(rows);
    expect(t.alokasiSiswa).toBe(150);
    expect(t.salurSiswa).toBe(105);
    expect(t.sisaSiswa).toBe(45);
    expect(t.progresSiswa).toBeCloseTo(0.7);
    expect(t.progresDana).toBeCloseTo(54_750 / 82_500);
  });

  it('filter jenjang hanya menghitung jenjang tersebut', () => {
    const t = totalsFromRows(rows, 'SMP');
    expect(t.alokasiSiswa).toBe(50);
    expect(t.progresSiswa).toBeCloseTo(0.5);
  });

  it('alokasi nol tidak membagi nol', () => {
    const t = totalsFromRows([]);
    expect(t.progresSiswa).toBe(0);
  });
});

describe('attentionReasons', () => {
  it('melewati tenggat & jatuh tempo hari ini', () => {
    const overdue = attentionReasons(makeTask({ dueDate: '2026-07-10' }), kinds, 7, TODAY, NOW);
    expect(overdue.map((r) => r.key)).toContain('OVERDUE');
    const dueToday = attentionReasons(makeTask({ dueDate: TODAY }), kinds, 7, TODAY, NOW);
    expect(dueToday.map((r) => r.key)).toContain('DUE_TODAY');
  });

  it('tanpa PIC, terhambat (step BLOCKED), prioritas tinggi', () => {
    const r = attentionReasons(
      makeTask({ picMainId: null, picIds: [], stepId: 'step-blocked', priority: 'TINGGI' }),
      kinds,
      7,
      TODAY,
      NOW,
    );
    const keys = r.map((x) => x.key);
    expect(keys).toEqual(expect.arrayContaining(['NO_PIC', 'BLOCKED', 'HIGH_PRIORITY']));
  });

  it('lama tidak diperbarui memakai ambang staleDays', () => {
    const stale = attentionReasons(
      makeTask({ updatedAt: '2026-07-01T00:00:00.000Z' }),
      kinds,
      7,
      TODAY,
      NOW,
    );
    expect(stale.map((r) => r.key)).toContain('STALE');
    const fresh = attentionReasons(
      makeTask({ updatedAt: '2026-07-15T00:00:00.000Z' }),
      kinds,
      7,
      TODAY,
      NOW,
    );
    expect(fresh.map((r) => r.key)).not.toContain('STALE');
  });

  it('pekerjaan pada step selesai/arsip/terhapus tidak pernah masuk', () => {
    expect(
      attentionReasons(
        makeTask({ stepId: 'step-done', dueDate: '2026-07-01' }),
        kinds,
        7,
        TODAY,
        NOW,
      ),
    ).toEqual([]);
    expect(
      attentionReasons(
        makeTask({ archivedAt: '2026-07-01T00:00:00.000Z', dueDate: '2026-07-01' }),
        kinds,
        7,
        TODAY,
        NOW,
      ),
    ).toEqual([]);
  });

  it('terlambat mendapat skor paling penting', () => {
    const overdue = attentionReasons(makeTask({ dueDate: '2026-07-10' }), kinds, 7, TODAY, NOW);
    const highOnly = attentionReasons(makeTask({ priority: 'TINGGI' }), kinds, 7, TODAY, NOW);
    expect(attentionScore(overdue)).toBeLessThan(attentionScore(highOnly));
  });
});

describe('needsFollowUpIds', () => {
  const cmt = (taskId: string, type: TaskComment['type'], at: string): TaskComment => ({
    id: `${taskId}-${type}-${at}`,
    taskId,
    type,
    text: 'x',
    employeeId: 'e',
    createdAt: at,
  });

  it('kendala terbaru tanpa tindak lanjut sesudahnya = perlu tindak lanjut', () => {
    const ids = needsFollowUpIds([
      cmt('a', 'KENDALA', '2026-07-15T00:00:00Z'),
      cmt('a', 'TINDAK_LANJUT', '2026-07-14T00:00:00Z'),
      cmt('b', 'KENDALA', '2026-07-10T00:00:00Z'),
      cmt('b', 'TINDAK_LANJUT', '2026-07-12T00:00:00Z'),
      cmt('c', 'KOMENTAR', '2026-07-15T00:00:00Z'),
    ]);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(false);
    expect(ids.has('c')).toBe(false);
  });
});

describe('isFocusToday', () => {
  it('ditandai fokus selalu masuk', () => {
    const t = makeTask({ isFocus: true });
    expect(isFocusToday(t, [], false)).toBe(true);
  });
  it('memerlukan tindak lanjut masuk fokus', () => {
    const t = makeTask({});
    expect(isFocusToday(t, [], true)).toBe(true);
  });
  it('pekerjaan biasa tidak masuk', () => {
    const t = makeTask({});
    expect(isFocusToday(t, attentionReasons(t, kinds, 7, TODAY, NOW), false)).toBe(false);
  });
});

describe('trendSeries', () => {
  it('mengurutkan berdasarkan waktu aktivasi dan memfilter scope', () => {
    const snap = (id: string, activatedAt: string | null, salur: number) => ({
      id,
      year: 2026,
      period: 'Termin 1',
      status: 'ARCHIVED' as const,
      rows: [{ ...rows[0]!, salurSiswa: salur }],
      sourceFileName: null,
      note: null,
      createdAt: activatedAt ?? '2026-01-01T00:00:00Z',
      createdByEmployeeId: null,
      activatedAt,
      updatedAt: activatedAt ?? '2026-01-01T00:00:00Z',
      version: 1,
    });
    const series = trendSeries(
      [
        snap('b', '2026-03-01T00:00:00Z', 40),
        snap('a', '2026-02-01T00:00:00Z', 20),
        snap('draft', null, 99),
        { ...snap('other', '2026-03-01T00:00:00Z', 70), period: 'Termin 2' },
      ],
      2026,
      'Termin 1',
    );
    expect(series.map((p) => p.salurSiswa)).toEqual([20, 40]);
  });
});
