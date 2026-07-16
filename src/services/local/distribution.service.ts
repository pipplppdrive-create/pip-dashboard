import { uid } from '@/lib/utils';
import { NotFoundError, ValidationError } from '@/services/errors';
import { JENJANG_LIST, type DistributionRow, type DistributionService, type DistributionSnapshot } from '@/services/types';
import { localBus } from './bus';
import { COL, db, ensureSeeded, nowISO, writeAudit } from './db';
import { requireActor, requireAdmin, requireSession } from './guard-util';

function auditBase(employeeId: string) {
  const session = requireAdmin();
  return {
    actorRole: session.role,
    actorAccount: session.account,
    employeeId,
    sessionId: session.id,
    deviceLabel: session.deviceLabel,
  } as const;
}

export function snapshotLabel(s: Pick<DistributionSnapshot, 'year' | 'period'>): string {
  return `Penyaluran ${s.year} · ${s.period}`;
}

/** Validasi baris agregat — dipakai upload, koreksi, dan test. */
export function validateRows(rows: DistributionRow[]): string[] {
  const errors: string[] = [];
  if (rows.length === 0) errors.push('Data kosong — tidak ada baris yang dapat disimpan.');
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const rowLabel = `Baris ${i + 1} (${row.jenjang || '?'})`;
    if (!JENJANG_LIST.includes(row.jenjang)) {
      errors.push(`${rowLabel}: jenjang tidak valid (harus SD/SMP/SMA/SMK).`);
      return;
    }
    if (seen.has(row.jenjang)) errors.push(`${rowLabel}: jenjang ${row.jenjang} duplikat.`);
    seen.add(row.jenjang);
    const numbers: Array<[string, number]> = [
      ['alokasi siswa', row.alokasiSiswa],
      ['alokasi anggaran', row.alokasiAnggaran],
      ['SK siswa', row.skSiswa],
      ['SK anggaran', row.skAnggaran],
      ['salur siswa', row.salurSiswa],
      ['salur anggaran', row.salurAnggaran],
    ];
    for (const [label, value] of numbers) {
      if (!Number.isFinite(value)) errors.push(`${rowLabel}: ${label} bukan angka.`);
      else if (value < 0) errors.push(`${rowLabel}: ${label} tidak boleh negatif.`);
      else if (!Number.isInteger(value)) errors.push(`${rowLabel}: ${label} harus bilangan bulat.`);
    }
    if (row.skSiswa > row.alokasiSiswa)
      errors.push(`${rowLabel}: SK siswa melebihi alokasi siswa.`);
    if (row.salurSiswa > row.alokasiSiswa)
      errors.push(`${rowLabel}: siswa tersalur melebihi alokasi siswa.`);
    if (row.salurAnggaran > row.alokasiAnggaran)
      errors.push(`${rowLabel}: dana tersalur melebihi alokasi anggaran.`);
    if (row.skAnggaran > row.alokasiAnggaran)
      errors.push(`${rowLabel}: SK anggaran melebihi alokasi anggaran.`);
  });
  return errors;
}

export function validateScope(year: number, period: string): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    errors.push('Tahun tidak valid (2020–2100).');
  }
  if (!period.trim()) errors.push('Periode wajib diisi.');
  if (period.trim().length > 30) errors.push('Periode maksimal 30 karakter.');
  return errors;
}

function getSnapshotOrThrow(id: string): DistributionSnapshot {
  const snap = db.snapshots().find((s) => s.id === id);
  if (!snap) throw new NotFoundError('Snapshot tidak ditemukan.');
  return snap;
}

function save(snapshots: DistributionSnapshot[]): void {
  db.write(COL.snapshots, snapshots);
  localBus.emit({ topic: 'distribution' });
}

export const localDistribution: DistributionService = {
  async getActive(year, period): Promise<DistributionSnapshot | null> {
    await ensureSeeded();
    requireSession();
    const candidates = db
      .snapshots()
      .filter(
        (s) =>
          s.status === 'ACTIVE' &&
          (year === undefined || s.year === year) &&
          (period === undefined || s.period === period),
      )
      .sort((a, b) => Date.parse(b.activatedAt ?? b.createdAt) - Date.parse(a.activatedAt ?? a.createdAt));
    return candidates[0] ?? null;
  },

  async list(): Promise<DistributionSnapshot[]> {
    await ensureSeeded();
    requireSession();
    return [...db.snapshots()].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.period !== b.period) return a.period.localeCompare(b.period);
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  },

  async get(id): Promise<DistributionSnapshot> {
    await ensureSeeded();
    requireSession();
    return getSnapshotOrThrow(id);
  },

  async createDraft(input, ctx): Promise<DistributionSnapshot> {
    await ensureSeeded();
    requireAdmin();
    const employeeId = requireActor(ctx);
    const scopeErrors = validateScope(input.year, input.period);
    const rowErrors = validateRows(input.rows);
    const errors = [...scopeErrors, ...rowErrors];
    if (errors.length > 0) {
      throw new ValidationError(errors[0] ?? 'Data tidak valid.');
    }
    const snapshot: DistributionSnapshot = {
      id: uid('snap'),
      year: input.year,
      period: input.period.trim(),
      status: 'DRAFT',
      rows: input.rows,
      sourceFileName: input.sourceFileName ?? null,
      note: input.note ?? null,
      createdAt: nowISO(),
      createdByEmployeeId: employeeId,
      activatedAt: null,
      updatedAt: nowISO(),
      version: 1,
    };
    save([snapshot, ...db.snapshots()]);
    writeAudit({
      ...auditBase(employeeId),
      action: 'IMPORT',
      entityType: 'SNAPSHOT',
      entityId: snapshot.id,
      entityLabel: snapshotLabel(snapshot),
      after: { fileName: snapshot.sourceFileName, rows: snapshot.rows.length },
    });
    return snapshot;
  },

  async activate(id, ctx): Promise<DistributionSnapshot> {
    await ensureSeeded();
    requireAdmin();
    const employeeId = requireActor(ctx);
    const snap = getSnapshotOrThrow(id);
    const rowErrors = validateRows(snap.rows);
    if (rowErrors.length > 0) {
      throw new ValidationError('Snapshot tidak valid dan tidak dapat diaktifkan.');
    }
    const next = db.snapshots().map((s): DistributionSnapshot => {
      if (s.id === id) {
        return { ...s, status: 'ACTIVE', activatedAt: nowISO(), updatedAt: nowISO(), version: s.version + 1 };
      }
      // Hanya satu snapshot aktif untuk scope (tahun, periode) yang sama.
      if (s.status === 'ACTIVE' && s.year === snap.year && s.period === snap.period) {
        return { ...s, status: 'ARCHIVED', updatedAt: nowISO(), version: s.version + 1 };
      }
      return s;
    });
    save(next);
    writeAudit({
      ...auditBase(employeeId),
      action: 'ACTIVATE',
      entityType: 'SNAPSHOT',
      entityId: id,
      entityLabel: snapshotLabel(snap),
      before: { status: snap.status },
      after: { status: 'ACTIVE' },
    });
    return getSnapshotOrThrow(id);
  },

  async deactivate(id, ctx): Promise<DistributionSnapshot> {
    await ensureSeeded();
    requireAdmin();
    const employeeId = requireActor(ctx);
    const snap = getSnapshotOrThrow(id);
    if (snap.status !== 'ACTIVE') {
      throw new ValidationError('Hanya snapshot aktif yang dapat dibatalkan aktivasinya.');
    }
    save(
      db.snapshots().map((s) =>
        s.id === id
          ? { ...s, status: 'DRAFT', activatedAt: null, updatedAt: nowISO(), version: s.version + 1 }
          : s,
      ),
    );
    writeAudit({
      ...auditBase(employeeId),
      action: 'DEACTIVATE',
      entityType: 'SNAPSHOT',
      entityId: id,
      entityLabel: snapshotLabel(snap),
      before: { status: 'ACTIVE' },
      after: { status: 'DRAFT' },
    });
    return getSnapshotOrThrow(id);
  },

  async correct(id, rows, reason, ctx): Promise<DistributionSnapshot> {
    await ensureSeeded();
    requireAdmin();
    const employeeId = requireActor(ctx);
    const source = getSnapshotOrThrow(id);
    if (!reason.trim()) throw new ValidationError('Alasan koreksi wajib diisi.');
    const rowErrors = validateRows(rows);
    if (rowErrors.length > 0) {
      throw new ValidationError(rowErrors[0] ?? 'Data koreksi tidak valid.');
    }
    const wasActive = source.status === 'ACTIVE';
    const corrected: DistributionSnapshot = {
      id: uid('snap'),
      year: source.year,
      period: source.period,
      status: 'DRAFT',
      rows,
      sourceFileName: source.sourceFileName,
      note: `Koreksi manual: ${reason.trim()}`,
      createdAt: nowISO(),
      createdByEmployeeId: employeeId,
      activatedAt: null,
      updatedAt: nowISO(),
      version: 1,
    };
    save([corrected, ...db.snapshots()]);
    writeAudit({
      ...auditBase(employeeId),
      action: 'CORRECTION',
      entityType: 'SNAPSHOT',
      entityId: corrected.id,
      entityLabel: snapshotLabel(corrected),
      before: { sourceSnapshotId: id },
      after: { reason: reason.trim() },
    });
    if (wasActive) {
      return localDistribution.activate(corrected.id, ctx);
    }
    return corrected;
  },

  async remove(id, ctx): Promise<void> {
    await ensureSeeded();
    requireAdmin();
    const employeeId = requireActor(ctx);
    const snap = getSnapshotOrThrow(id);
    if (snap.status === 'ACTIVE') {
      throw new ValidationError('Snapshot aktif tidak dapat dihapus. Batalkan aktivasi dahulu.');
    }
    save(db.snapshots().filter((s) => s.id !== id));
    writeAudit({
      ...auditBase(employeeId),
      action: 'PERMANENT_DELETE',
      entityType: 'SNAPSHOT',
      entityId: id,
      entityLabel: snapshotLabel(snap),
    });
  },

  async listScopes(): Promise<{ year: number; period: string }[]> {
    await ensureSeeded();
    requireSession();
    const seen = new Set<string>();
    const scopes: { year: number; period: string }[] = [];
    for (const s of db.snapshots()) {
      const key = `${s.year}|${s.period}`;
      if (!seen.has(key)) {
        seen.add(key);
        scopes.push({ year: s.year, period: s.period });
      }
    }
    return scopes.sort((a, b) => b.year - a.year || a.period.localeCompare(b.period));
  },
};
