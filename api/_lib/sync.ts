/**
 * Mesin sinkronisasi Google Sheets → Supabase (server-only).
 *
 * Alur (Docs/09 §X): Sheets → validasi → Supabase → Realtime → frontend.
 * Prinsip:
 *  - read-only terhadap Google Sheets (tidak pernah write-back);
 *  - idempotent: upsert berdasar (source_id, source_row_key) yang stabil;
 *  - validasi silang detail (Pemberian) vs kontrol (REKAP PROGRESS);
 *  - snapshot valid terakhir TIDAK ditimpa bila validasi gagal;
 *  - tidak menyimpan data pribadi siswa (hanya agregat per SK/jenjang).
 */
import { sha256Hex } from './crypto.js';
import type { ServerEnv } from './env.js';
import {
  fetchSheetValues,
  fetchSpreadsheetMeta,
  getAccessToken,
  GoogleNotConnectedError,
} from './google.js';
import {
  ACTIVITY_RULES,
  detectMappings,
  isNoiseRow,
  normalizeHeader,
  parseActivityStatus,
  parseIdDate,
  parseIdNumber,
  parseIdTime,
  parseJenjang,
  PIP_DETAIL_RULES,
  PIP_REKAP_RULES,
  type HeaderRule,
} from './parse.js';
import { dbClient, type DbClient } from './supabase.js';

// ---------------------------------------------------------------------------
// Tipe baris DB (snake_case)
// ---------------------------------------------------------------------------

export interface SourceRow {
  id: string;
  source_type: 'pip_progress' | 'activity_plan';
  year: number;
  name: string;
  spreadsheet_id: string;
  is_active: boolean;
  deleted_at: string | null;
}

export interface BindingRow {
  id: string;
  source_id: string;
  binding_type: 'detail_realisasi' | 'allocation_summary' | 'activity_rows';
  sheet_name: string;
  header_row: number;
  data_start_row: number;
  optional_range: string | null;
  mapping_status: string;
}

export interface MappingRow {
  id?: string;
  binding_id: string;
  detected_header: string;
  target_field: string;
  parser_type: string;
  required: boolean;
  validation_status?: string;
}

export interface SyncRunRow {
  id: string;
  source_id: string;
  trigger: 'MANUAL' | 'WEBHOOK' | 'JADWAL';
  status: 'BERHASIL' | 'PERLU_VALIDASI' | 'GAGAL';
  started_at: string;
  finished_at: string | null;
  rows_read: number;
  rows_upserted: number;
  message: string | null;
  error_message: string | null;
}

interface SyncErrorInput {
  sheet_name?: string;
  row_ref?: string;
  error_code?: string;
  detail: string;
}

const RULES_BY_BINDING: Record<BindingRow['binding_type'], HeaderRule[]> = {
  detail_realisasi: PIP_DETAIL_RULES,
  allocation_summary: PIP_REKAP_RULES,
  activity_rows: ACTIVITY_RULES,
};

// ---------------------------------------------------------------------------
// Util umum
// ---------------------------------------------------------------------------

async function loadSource(db: DbClient, sourceId: string): Promise<SourceRow | null> {
  const rows = await db.select<SourceRow>(
    'spreadsheet_sources',
    `select=id,source_type,year,name,spreadsheet_id,is_active,deleted_at&id=eq.${sourceId}`,
  );
  return rows[0] ?? null;
}

async function loadBindings(db: DbClient, sourceId: string): Promise<BindingRow[]> {
  return db.select<BindingRow>('spreadsheet_sheet_bindings', `select=*&source_id=eq.${sourceId}`);
}

/** Baca satu sheet: header + baris data (mengikuti binding). */
async function readBinding(
  accessToken: string,
  spreadsheetId: string,
  binding: BindingRow,
): Promise<{ headers: string[]; rows: string[][] }> {
  const range = binding.optional_range
    ? `'${binding.sheet_name}'!${binding.optional_range}`
    : `'${binding.sheet_name}'`;
  const values = await fetchSheetValues(accessToken, spreadsheetId, range);
  const headers = values[binding.header_row - 1] ?? [];
  const rows = values.slice(binding.data_start_row - 1);
  return { headers, rows };
}

/**
 * Deteksi mapping dari header aktual & simpan sebagai usulan (idempotent).
 * TIDAK mengubah mapping_status — konfirmasi tetap di tangan Admin (§T).
 */
async function storeDetectedMappings(
  db: DbClient,
  binding: BindingRow,
  headers: string[],
): Promise<void> {
  const detected = detectMappings(headers, RULES_BY_BINDING[binding.binding_type]);
  if (detected.length === 0) return;
  await db.insert(
    'spreadsheet_column_mappings',
    detected.map((d) => ({
      binding_id: binding.id,
      detected_header: d.detectedHeader,
      target_field: d.targetField,
      parser_type: d.parserType,
      required: d.required,
      validation_status: 'BELUM_DIVALIDASI',
    })),
    { upsertOn: 'binding_id,target_field' },
  );
}

/**
 * Peta target_field → indeks kolom berdasarkan mapping tersimpan.
 * Mengembalikan null bila header wajib tidak ditemukan lagi (struktur berubah).
 */
function resolveColumns(
  headers: string[],
  mappings: MappingRow[],
): { columns: Map<string, number>; missing: string[] } {
  const normalized = headers.map((h) => normalizeHeader(h));
  const columns = new Map<string, number>();
  const missing: string[] = [];
  for (const m of mappings) {
    const idx = normalized.indexOf(normalizeHeader(m.detected_header));
    if (idx >= 0) {
      columns.set(m.target_field, idx);
    } else if (m.required) {
      missing.push(m.target_field);
    }
  }
  return { columns, missing };
}

const cell = (row: string[], idx: number | undefined): string =>
  idx === undefined ? '' : (row[idx] ?? '').trim();

// ---------------------------------------------------------------------------
// Test & preview
// ---------------------------------------------------------------------------

export async function testSource(
  env: ServerEnv,
  sourceId: string,
): Promise<{ ok: boolean; message: string; sheets?: string[] }> {
  const db = dbClient(env);
  const source = await loadSource(db, sourceId);
  if (!source) return { ok: false, message: 'Sumber tidak ditemukan.' };
  try {
    const token = await getAccessToken(env);
    const meta = await fetchSpreadsheetMeta(token, source.spreadsheet_id);
    const titles = meta.sheets.map((s) => s.title);
    const bindings = await loadBindings(db, sourceId);
    const missing = bindings.filter((b) => !titles.includes(b.sheet_name));
    // Simpan usulan mapping dari header aktual untuk setiap sheet yang ada.
    for (const binding of bindings) {
      if (titles.includes(binding.sheet_name)) {
        const { headers } = await readBinding(token, source.spreadsheet_id, binding);
        await storeDetectedMappings(db, binding, headers);
      }
    }
    if (missing.length > 0) {
      return {
        ok: false,
        message: `Sheet tidak ditemukan: ${missing.map((b) => b.sheet_name).join(', ')}.`,
        sheets: titles,
      };
    }
    return {
      ok: true,
      message: `Spreadsheet "${meta.title}" dapat diakses. Header terdeteksi — konfirmasi mapping sebelum sinkronisasi.`,
      sheets: titles,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof GoogleNotConnectedError
          ? 'Koneksi Google Sheets belum dikonfigurasi.'
          : err instanceof Error
            ? err.message
            : 'Spreadsheet tidak dapat diakses. Pastikan file dibagikan ke email koneksi (Viewer).',
    };
  }
}

export async function previewBinding(
  env: ServerEnv,
  sourceId: string,
  bindingId: string,
): Promise<{ headers: string[]; rows: string[][] } | null> {
  const db = dbClient(env);
  const source = await loadSource(db, sourceId);
  if (!source) return null;
  const bindings = await loadBindings(db, sourceId);
  const binding = bindings.find((b) => b.id === bindingId);
  if (!binding) return null;
  try {
    const token = await getAccessToken(env);
    const { headers, rows } = await readBinding(token, source.spreadsheet_id, binding);
    await storeDetectedMappings(db, binding, headers);
    return { headers, rows: rows.slice(0, 8) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sinkronisasi
// ---------------------------------------------------------------------------

export async function syncSource(
  env: ServerEnv,
  sourceId: string,
  trigger: SyncRunRow['trigger'],
): Promise<SyncRunRow> {
  const db = dbClient(env);
  const startedAt = new Date().toISOString();
  const source = await loadSource(db, sourceId);
  if (!source) throw new Error('Sumber tidak ditemukan.');

  let status: SyncRunRow['status'] = 'BERHASIL';
  let rowsRead = 0;
  let rowsUpserted = 0;
  let message: string | null = null;
  let errorMessage: string | null = null;
  const errors: SyncErrorInput[] = [];

  try {
    const bindings = await loadBindings(db, sourceId);
    const unconfirmed = bindings.filter((b) => b.mapping_status !== 'TERKONFIRMASI');
    if (unconfirmed.length > 0) {
      status = 'PERLU_VALIDASI';
      message = `Mapping belum dikonfirmasi: ${unconfirmed.map((b) => b.sheet_name).join(', ')}. Buka Detail & mapping lalu konfirmasi.`;
    } else {
      const token = await getAccessToken(env);
      const result =
        source.source_type === 'pip_progress'
          ? await syncPipProgress(env, db, source, bindings, token, errors)
          : await syncActivityPlan(env, db, source, bindings, token, errors);
      rowsRead = result.rowsRead;
      rowsUpserted = result.rowsUpserted;
      status = result.status;
      message = result.message;
    }
  } catch (err) {
    status = 'GAGAL';
    errorMessage =
      err instanceof GoogleNotConnectedError
        ? 'Integrasi Google belum dikonfigurasi.'
        : err instanceof Error
          ? err.message
          : 'Kesalahan tidak diketahui.';
  }

  const finishedAt = new Date().toISOString();
  const runRows = await db.insert<SyncRunRow>('spreadsheet_sync_runs', {
    source_id: sourceId,
    trigger,
    status,
    started_at: startedAt,
    finished_at: finishedAt,
    rows_read: rowsRead,
    rows_upserted: rowsUpserted,
    message,
    error_message: errorMessage,
  });
  const run = runRows[0];
  if (run && errors.length > 0) {
    await db.insert(
      'spreadsheet_sync_errors',
      errors.slice(0, 100).map((e) => ({
        run_id: run.id,
        source_id: sourceId,
        sheet_name: e.sheet_name ?? null,
        row_ref: e.row_ref ?? null,
        error_code: e.error_code ?? 'PARSE',
        detail: e.detail,
      })),
    );
  }
  await db.update('spreadsheet_sources', `id=eq.${sourceId}`, {
    last_synced_at: finishedAt,
    last_sync_status: status,
    last_error: errorMessage ?? (status === 'PERLU_VALIDASI' ? message : null),
  });
  await db.update('google_oauth_connections', 'id=eq.1', {
    last_used_at: finishedAt,
  });
  return (
    run ?? {
      id: 'run-tanpa-id',
      source_id: sourceId,
      trigger,
      status,
      started_at: startedAt,
      finished_at: finishedAt,
      rows_read: rowsRead,
      rows_upserted: rowsUpserted,
      message,
      error_message: errorMessage,
    }
  );
}

/** Sinkronkan seluruh sumber aktif yang cocok dengan spreadsheetId (webhook). */
export async function syncBySpreadsheetId(
  env: ServerEnv,
  spreadsheetId: string,
  trigger: SyncRunRow['trigger'],
): Promise<SyncRunRow[]> {
  const db = dbClient(env);
  const sources = await db.select<SourceRow>(
    'spreadsheet_sources',
    `select=id,source_type,year,name,spreadsheet_id,is_active,deleted_at&spreadsheet_id=eq.${spreadsheetId}&is_active=eq.true&deleted_at=is.null`,
  );
  const runs: SyncRunRow[] = [];
  for (const source of sources) {
    runs.push(await syncSource(env, source.id, trigger));
  }
  return runs;
}

/** Rekonsiliasi terjadwal: seluruh sumber aktif. */
export async function syncAllActive(env: ServerEnv): Promise<SyncRunRow[]> {
  const db = dbClient(env);
  const sources = await db.select<SourceRow>(
    'spreadsheet_sources',
    'select=id,source_type,year,name,spreadsheet_id,is_active,deleted_at&is_active=eq.true&deleted_at=is.null',
  );
  const runs: SyncRunRow[] = [];
  for (const source of sources) {
    runs.push(await syncSource(env, source.id, 'JADWAL'));
  }
  return runs;
}

// ---------------------------------------------------------------------------
// PIP progress: Pemberian (detail) + REKAP PROGRESS (kontrol)
// ---------------------------------------------------------------------------

interface SyncResult {
  rowsRead: number;
  rowsUpserted: number;
  status: SyncRunRow['status'];
  message: string | null;
}

interface JenjangTotals {
  siswa: number;
  dana: number;
}

async function syncPipProgress(
  _env: ServerEnv,
  db: DbClient,
  source: SourceRow,
  bindings: BindingRow[],
  token: string,
  errors: SyncErrorInput[],
): Promise<SyncResult> {
  const detailBinding = bindings.find((b) => b.binding_type === 'detail_realisasi');
  const rekapBinding = bindings.find((b) => b.binding_type === 'allocation_summary');
  if (!detailBinding || !rekapBinding) {
    throw new Error('Binding "Pemberian" dan "REKAP PROGRESS" wajib ada pada sumber penyaluran.');
  }

  const detailMappings = await db.select<MappingRow>(
    'spreadsheet_column_mappings',
    `select=*&binding_id=eq.${detailBinding.id}`,
  );
  const rekapMappings = await db.select<MappingRow>(
    'spreadsheet_column_mappings',
    `select=*&binding_id=eq.${rekapBinding.id}`,
  );

  const detail = await readBinding(token, source.spreadsheet_id, detailBinding);
  const rekap = await readBinding(token, source.spreadsheet_id, rekapBinding);

  const detailCols = resolveColumns(detail.headers, detailMappings);
  const rekapCols = resolveColumns(rekap.headers, rekapMappings);
  if (detailCols.missing.length > 0 || rekapCols.missing.length > 0) {
    // Struktur sheet berubah — jangan timpa data; tandai perlu validasi.
    await db.update(
      'spreadsheet_sheet_bindings',
      `source_id=eq.${source.id}`,
      { mapping_status: 'PERLU_VALIDASI' },
    );
    return {
      rowsRead: 0,
      rowsUpserted: 0,
      status: 'PERLU_VALIDASI',
      message: `Struktur sheet berubah — kolom hilang: ${[...detailCols.missing, ...rekapCols.missing].join(', ')}. Snapshot valid terakhir dipertahankan.`,
    };
  }

  // ---- Baca detail Pemberian (agregat per baris SK — bukan data siswa) ----
  const cols = detailCols.columns;
  const detailTotals = new Map<string, JenjangTotals>();
  const records: Array<Record<string, unknown>> = [];
  const seenKeys = new Set<string>();
  let rowsRead = 0;

  for (let i = 0; i < detail.rows.length; i += 1) {
    const row = detail.rows[i] ?? [];
    if (isNoiseRow(row)) continue;
    const jenjang = parseJenjang(cell(row, cols.get('jenjang')));
    if (!jenjang) continue; // judul/subtotal/blok lain
    const rowYearRaw = cell(row, cols.get('tahun'));
    if (rowYearRaw) {
      const rowYear = parseIdNumber(rowYearRaw);
      if (rowYear !== null && rowYear !== source.year) continue;
    }
    const siswa = parseIdNumber(cell(row, cols.get('jumlah_siswa')));
    const dana = parseIdNumber(cell(row, cols.get('jumlah_dana')));
    if (siswa === null && dana === null) continue;
    if (siswa === null || dana === null) {
      errors.push({
        sheet_name: detailBinding.sheet_name,
        row_ref: `baris ${detailBinding.data_start_row + i}`,
        detail: `Angka tidak dapat diparse (siswa="${cell(row, cols.get('jumlah_siswa'))}", dana="${cell(row, cols.get('jumlah_dana'))}").`,
      });
      continue;
    }
    rowsRead += 1;
    const tahap = cell(row, cols.get('tahap'));
    const skNomor = cell(row, cols.get('sk_nomor'));
    const skKet = cell(row, cols.get('sk_keterangan'));
    const skTanggal = parseIdDate(cell(row, cols.get('sk_tanggal')));

    // Fingerprint stabil dari kombinasi nilai identitas baris (§X).
    let key = await sha256Hex(
      [jenjang, tahap, skNomor, skKet, skTanggal ?? ''].join('|').toLowerCase(),
    );
    let suffix = 0;
    while (seenKeys.has(key)) {
      suffix += 1;
      key = await sha256Hex(`${key}|${suffix}`);
    }
    seenKeys.add(key);

    const totals = detailTotals.get(jenjang) ?? { siswa: 0, dana: 0 };
    totals.siswa += siswa;
    totals.dana += dana;
    detailTotals.set(jenjang, totals);

    records.push({
      source_id: source.id,
      source_year: source.year,
      source_row_key: key,
      jenjang,
      tahap,
      sk_keterangan: skKet,
      sk_nomor: skNomor,
      sk_tanggal: skTanggal,
      jumlah_siswa: siswa,
      jumlah_dana: dana,
      status: cell(row, cols.get('status')),
      updated_on: parseIdDate(cell(row, cols.get('updated_on'))),
      catatan: cell(row, cols.get('catatan')),
      deleted_at: null,
    });
  }

  // ---- Baca blok kontrol REKAP PROGRESS (hanya blok tahun sumber) ----
  const rcols = rekapCols.columns;
  interface ControlRow {
    jenjang: string;
    alokasiSiswa: number;
    alokasiAnggaran: number;
    realisasiSiswa: number;
    realisasiDana: number;
  }
  const control = new Map<string, ControlRow>();
  for (let i = 0; i < rekap.rows.length; i += 1) {
    const row = rekap.rows[i] ?? [];
    if (isNoiseRow(row)) continue;
    const jenjang = parseJenjang(cell(row, rcols.get('jenjang')));
    if (!jenjang || control.has(jenjang)) continue; // blok pertama yang cocok
    const rowYearRaw = cell(row, rcols.get('tahun'));
    if (rowYearRaw) {
      const rowYear = parseIdNumber(rowYearRaw);
      if (rowYear !== null && rowYear !== source.year) continue;
    }
    const alokasiSiswa = parseIdNumber(cell(row, rcols.get('alokasi_siswa')));
    const alokasiAnggaran = parseIdNumber(cell(row, rcols.get('alokasi_anggaran')));
    const realisasiSiswa = parseIdNumber(cell(row, rcols.get('realisasi_siswa')));
    const realisasiDana = parseIdNumber(cell(row, rcols.get('realisasi_dana')));
    if (alokasiSiswa === null || alokasiAnggaran === null) continue;
    control.set(jenjang, {
      jenjang,
      alokasiSiswa,
      alokasiAnggaran,
      realisasiSiswa: realisasiSiswa ?? 0,
      realisasiDana: realisasiDana ?? 0,
    });
  }
  if (control.size === 0) {
    return {
      rowsRead,
      rowsUpserted: 0,
      status: 'PERLU_VALIDASI',
      message:
        'Blok alokasi/pagu untuk tahun sumber tidak ditemukan pada REKAP PROGRESS. Snapshot valid terakhir dipertahankan.',
    };
  }

  // ---- Validasi silang detail vs kontrol (per jenjang + total) ----
  const validationNotes: Array<Record<string, unknown>> = [];
  for (const [jenjang, ctl] of control) {
    const det = detailTotals.get(jenjang) ?? { siswa: 0, dana: 0 };
    const selisihSiswa = det.siswa - ctl.realisasiSiswa;
    const selisihDana = det.dana - ctl.realisasiDana;
    if (selisihSiswa !== 0 || Math.abs(selisihDana) > 1) {
      validationNotes.push({
        jenjang,
        selisih_siswa: selisihSiswa,
        selisih_dana: selisihDana,
      });
    }
  }
  const valid = validationNotes.length === 0;

  // ---- Upsert detail (idempotent) + soft delete baris yang hilang ----
  if (records.length > 0) {
    await db.insert('pip_progress_records', records, {
      upsertOn: 'source_id,source_row_key',
    });
  }
  const keyList = [...seenKeys];
  if (keyList.length > 0) {
    // Baris yang tidak lagi ada di sheet → soft delete (tetap di histori).
    const existing = await db.select<{ id: string; source_row_key: string }>(
      'pip_progress_records',
      `select=id,source_row_key&source_id=eq.${source.id}&deleted_at=is.null`,
    );
    const gone = existing.filter((r) => !seenKeys.has(r.source_row_key));
    for (const r of gone.slice(0, 200)) {
      await db.update('pip_progress_records', `id=eq.${r.id}`, {
        deleted_at: new Date().toISOString(),
      });
    }
  }

  // ---- Snapshot rekap (histori + fallback) ----
  const snapshotRows = [...control.values()].map((ctl) => {
    const det = detailTotals.get(ctl.jenjang) ?? { siswa: 0, dana: 0 };
    return {
      jenjang: ctl.jenjang,
      alokasiSiswa: ctl.alokasiSiswa,
      alokasiAnggaran: ctl.alokasiAnggaran,
      skSiswa: det.siswa,
      skAnggaran: det.dana,
      salurSiswa: ctl.realisasiSiswa,
      salurAnggaran: ctl.realisasiDana,
    };
  });
  if (valid) {
    await db.update('pip_progress_snapshots', `source_id=eq.${source.id}&is_last_valid=eq.true`, {
      is_last_valid: false,
    });
  }
  await db.insert('pip_progress_snapshots', {
    source_id: source.id,
    source_year: source.year,
    rows: snapshotRows,
    detail_totals: Object.fromEntries(detailTotals),
    control_totals: Object.fromEntries([...control].map(([k, v]) => [k, v])),
    validation_status: valid ? 'VALID' : 'PERLU_VALIDASI',
    validation_notes: validationNotes,
    is_last_valid: valid,
  });

  // ---- Snapshot tampilan Dashboard (hanya bila valid — §U, §Y) ----
  if (valid) {
    const period = 'Google Sheets';
    const existing = await db.select<{ id: string }>(
      'distribution_snapshots',
      `select=id&year=eq.${source.year}&period=eq.${encodeURIComponent(period)}&status=eq.ACTIVE`,
    );
    const note = `Sinkronisasi otomatis dari "${source.name}"`;
    if (existing[0]) {
      await db.update('distribution_snapshots', `id=eq.${existing[0].id}`, {
        rows: snapshotRows,
        note,
        updated_at: new Date().toISOString(),
      });
    } else {
      await db.insert('distribution_snapshots', {
        year: source.year,
        period,
        status: 'ACTIVE',
        rows: snapshotRows,
        source_file_name: null,
        note,
        activated_at: new Date().toISOString(),
      });
    }
  }

  const selisihMsg = validationNotes
    .map((n) => `${String(n.jenjang)}: siswa ${String(n.selisih_siswa)}, dana ${String(n.selisih_dana)}`)
    .join('; ');
  return {
    rowsRead,
    rowsUpserted: records.length,
    status: valid ? 'BERHASIL' : 'PERLU_VALIDASI',
    message: valid
      ? `Detail ${records.length} baris SK & rekap ${control.size} jenjang tersinkron.`
      : `Status: Perlu Validasi. Selisih detail vs kontrol — ${selisihMsg}. Snapshot valid terakhir dipertahankan.`,
  };
}

// ---------------------------------------------------------------------------
// Rencana Kegiatan (activity_plan)
// ---------------------------------------------------------------------------

async function syncActivityPlan(
  _env: ServerEnv,
  db: DbClient,
  source: SourceRow,
  bindings: BindingRow[],
  token: string,
  errors: SyncErrorInput[],
): Promise<SyncResult> {
  const binding = bindings.find((b) => b.binding_type === 'activity_rows');
  if (!binding) throw new Error('Binding sheet Rencana Kegiatan tidak ditemukan.');

  const mappings = await db.select<MappingRow>(
    'spreadsheet_column_mappings',
    `select=*&binding_id=eq.${binding.id}`,
  );
  const { headers, rows } = await readBinding(token, source.spreadsheet_id, binding);
  const { columns: cols, missing } = resolveColumns(headers, mappings);
  if (missing.length > 0) {
    await db.update('spreadsheet_sheet_bindings', `id=eq.${binding.id}`, {
      mapping_status: 'PERLU_VALIDASI',
    });
    return {
      rowsRead: 0,
      rowsUpserted: 0,
      status: 'PERLU_VALIDASI',
      message: `Struktur sheet berubah — kolom hilang: ${missing.join(', ')}. Data terakhir dipertahankan.`,
    };
  }

  // Pegawai untuk pencocokan PIC (nama lengkap ATAU tag board).
  const employees = await db.select<{ id: string; full_name: string; display_name: string }>(
    'employees',
    'select=id,full_name,display_name',
  );
  const matchPic = (name: string): string | null => {
    const n = name.trim().toLowerCase();
    if (!n) return null;
    for (const e of employees) {
      if (e.display_name.toLowerCase() === n || e.full_name.toLowerCase() === n) return e.id;
      if (e.full_name.toLowerCase().startsWith(n) && n.length >= 4) return e.id;
    }
    return null;
  };

  const items: Array<Record<string, unknown>> = [];
  const seenKeys = new Set<string>();
  let rowsRead = 0;
  let unmatchedPic = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (isNoiseRow(row)) continue;
    const title = cell(row, cols.get('title'));
    if (!title) continue;
    const startDate = parseIdDate(cell(row, cols.get('start_date')));
    if (!startDate) {
      errors.push({
        sheet_name: binding.sheet_name,
        row_ref: `baris ${binding.data_start_row + i}`,
        detail: `Tanggal mulai tidak valid: "${cell(row, cols.get('start_date'))}".`,
      });
      continue;
    }
    const rowYearRaw = cell(row, cols.get('tahun'));
    const rowYear = rowYearRaw ? parseIdNumber(rowYearRaw) : null;
    const year = rowYear ?? Number(startDate.slice(0, 4));
    rowsRead += 1;

    // Jika hanya satu tanggal → tanggal selesai = tanggal mulai (§V).
    const endDate = parseIdDate(cell(row, cols.get('end_date'))) ?? startDate;
    const startTime = parseIdTime(cell(row, cols.get('start_time')));
    const endTime = parseIdTime(cell(row, cols.get('end_time')));

    // PIC: cocokkan ke pegawai; yang tidak cocok TETAP disimpan sebagai nama (§V).
    const picNames = cell(row, cols.get('pic'))
      .split(/[,;/&]|\bdan\b/i)
      .map((s) => s.trim())
      .filter(Boolean);
    const picEmployeeIds: string[] = [];
    for (const name of picNames) {
      const id = matchPic(name);
      if (id) {
        if (!picEmployeeIds.includes(id)) picEmployeeIds.push(id);
      } else {
        unmatchedPic += 1;
      }
    }

    let key = await sha256Hex(`${title}|${startDate}`.toLowerCase());
    let suffix = 0;
    while (seenKeys.has(key)) {
      suffix += 1;
      key = await sha256Hex(`${key}|${suffix}`);
    }
    seenKeys.add(key);

    const linkOrNull = (v: string): string | null =>
      /^https?:\/\//i.test(v.trim()) ? v.trim() : null;

    items.push({
      source_id: source.id,
      year,
      title,
      start_date: startDate,
      end_date: endDate >= startDate ? endDate : startDate,
      start_time: startTime,
      end_time: endTime,
      all_day: startTime === null,
      location: cell(row, cols.get('location')),
      category: cell(row, cols.get('category')),
      pic_names: picNames,
      pic_employee_ids: picEmployeeIds,
      participants: cell(row, cols.get('participants')),
      status: parseActivityStatus(cell(row, cols.get('status'))),
      notes: cell(row, cols.get('notes')),
      meeting_link: linkOrNull(cell(row, cols.get('meeting_link'))),
      document_link: linkOrNull(cell(row, cols.get('document_link'))),
      source_row_key: key,
      deleted_at: null,
    });
  }

  if (items.length > 0) {
    await db.insert('activity_plan_items', items, { upsertOn: 'source_id,source_row_key' });
  }
  // Baris yang hilang dari sheet → soft delete.
  const existing = await db.select<{ id: string; source_row_key: string }>(
    'activity_plan_items',
    `select=id,source_row_key&source_id=eq.${source.id}&deleted_at=is.null`,
  );
  const gone = existing.filter((r) => !seenKeys.has(r.source_row_key));
  for (const r of gone.slice(0, 200)) {
    await db.update('activity_plan_items', `id=eq.${r.id}`, {
      deleted_at: new Date().toISOString(),
    });
  }

  return {
    rowsRead,
    rowsUpserted: items.length,
    status: 'BERHASIL',
    message:
      `${items.length} kegiatan tersinkron.` +
      (unmatchedPic > 0 ? ` ${unmatchedPic} PIC belum cocok dengan master pegawai.` : ''),
  };
}
