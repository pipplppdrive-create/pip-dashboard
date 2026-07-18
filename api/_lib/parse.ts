/**
 * Parser nilai spreadsheet format Indonesia:
 * angka "1.234.567", rupiah "Rp 1.234.567,89", persen "82,5%",
 * tanggal "17/07/2026" / "17-07-2026" / "2026-07-17" / "17 Juli 2026".
 * Nilai mentah selalu dipertahankan pemanggil (kolom raw) bila diperlukan.
 */

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Angka Indonesia → number; null bila tidak dapat diparse. */
export function parseIdNumber(value: string): number | null {
  const cleaned = value
    .replace(/rp/gi, '')
    .replace(/\s/g, '')
    .replace(/%$/, '')
    .trim();
  if (!cleaned || /[a-z]/i.test(cleaned)) return null;
  let normalized = cleaned;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  if (hasComma && hasDot) {
    // Format ID: titik ribuan, koma desimal — kecuali pola sebaliknya (1,234.56)
    if (cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
      normalized = cleaned.replace(/,/g, '');
    } else {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma) {
    // "12,5" = desimal; "1,234,567" = ribuan
    normalized = /^\d{1,3}(,\d{3})+$/.test(cleaned)
      ? cleaned.replace(/,/g, '')
      : cleaned.replace(',', '.');
  } else if (hasDot) {
    // "1.234.567" = ribuan; "12.5" = desimal
    normalized = /^\d{1,3}(\.\d{3})+$/.test(cleaned) ? cleaned.replace(/\./g, '') : cleaned;
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

const MONTHS_ID: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8, sep: 9, okt: 10, nov: 11, des: 12,
};

/** Tanggal → ISO yyyy-MM-dd; null bila tidak valid. */
export function parseIdDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  // ISO langsung
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // dd/mm/yyyy atau dd-mm-yyyy
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v);
  if (m) {
    const [, d = '', mo = '', y = ''] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // "17 Juli 2026"
  m = /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/.exec(v);
  if (m) {
    const [, d = '', monthName = '', y = ''] = m;
    const mo = MONTHS_ID[monthName.toLowerCase()];
    if (mo) return `${y}-${String(mo).padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

/** Waktu → HH:mm; null bila tidak valid. Menerima "09.00", "9:00", "09:00:00". */
export function parseIdTime(value: string): string | null {
  const m = /^(\d{1,2})[.:](\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const JENJANG_ALIASES: Record<string, string> = {
  sd: 'SD', 'sd sederajat': 'SD', 'sd/sederajat': 'SD', 'sd paket a': 'SD',
  smp: 'SMP', 'smp sederajat': 'SMP',
  sma: 'SMA', 'sma sederajat': 'SMA',
  smk: 'SMK', 'smk sederajat': 'SMK',
};

/** Normalisasi jenjang; null bila bukan jenjang dikenal (baris judul/total). */
export function parseJenjang(value: string): string | null {
  const key = normalizeHeader(value);
  if (JENJANG_ALIASES[key]) return JENJANG_ALIASES[key];
  const first = key.split(' ')[0] ?? '';
  return JENJANG_ALIASES[first] ?? null;
}

/** Baris subtotal/judul/kosong yang harus diabaikan pembaca sheet. */
export function isNoiseRow(cells: string[]): boolean {
  const joined = cells.join('').trim();
  if (!joined) return true;
  const first = (cells.find((c) => c.trim()) ?? '').toLowerCase();
  return /^(total|jumlah|grand total|sub ?total|rekap|no\.?$)/.test(first.trim());
}

/** Status kegiatan bebas → enum aplikasi. */
export function parseActivityStatus(value: string): string {
  const v = normalizeHeader(value);
  if (/batal/.test(v)) return 'DIBATALKAN';
  if (/tunda|reschedul|pending/.test(v)) return 'DITUNDA';
  if (/selesai|done|terlaksana/.test(v)) return 'SELESAI';
  if (/berlangsung|proses|progress/.test(v)) return 'BERLANGSUNG';
  if (/jadwal|fix|pasti|confirmed/.test(v)) return 'TERJADWAL';
  return 'RENCANA';
}

// ---------------------------------------------------------------------------
// Deteksi header → target field (mapping berbasis header, bukan posisi)
// ---------------------------------------------------------------------------

export interface HeaderRule {
  targetField: string;
  parserType: 'text' | 'number' | 'currency' | 'date' | 'time' | 'percent';
  required: boolean;
  /** Pola dicocokkan terhadap header ternormalisasi. */
  patterns: RegExp[];
}

export const PIP_DETAIL_RULES: HeaderRule[] = [
  { targetField: 'tahun', parserType: 'number', required: false, patterns: [/^tahun/] },
  { targetField: 'jenjang', parserType: 'text', required: true, patterns: [/jenjang|bentuk pendidikan/] },
  { targetField: 'tahap', parserType: 'text', required: false, patterns: [/tahap|termin|batch/] },
  { targetField: 'sk_keterangan', parserType: 'text', required: false, patterns: [/keterangan|jenis sk|kategori sk|cutoff|cut off/] },
  { targetField: 'sk_nomor', parserType: 'text', required: false, patterns: [/no(mor)? ?sk|nomor surat/] },
  { targetField: 'sk_tanggal', parserType: 'date', required: false, patterns: [/tanggal ?sk|tgl ?sk/] },
  { targetField: 'jumlah_siswa', parserType: 'number', required: true, patterns: [/jumlah ?sisw|siswa|penerima/] },
  { targetField: 'jumlah_dana', parserType: 'currency', required: true, patterns: [/dana|nominal|anggaran|rupiah/] },
  { targetField: 'status', parserType: 'text', required: false, patterns: [/^status/] },
  { targetField: 'updated_on', parserType: 'date', required: false, patterns: [/tanggal update|update|pembaruan/] },
  { targetField: 'catatan', parserType: 'text', required: false, patterns: [/catatan|ket$|note/] },
];

export const PIP_REKAP_RULES: HeaderRule[] = [
  { targetField: 'tahun', parserType: 'number', required: false, patterns: [/^tahun/] },
  { targetField: 'jenjang', parserType: 'text', required: true, patterns: [/jenjang|bentuk pendidikan/] },
  { targetField: 'alokasi_siswa', parserType: 'number', required: true, patterns: [/alokasi ?sisw|target ?sisw|kuota/] },
  { targetField: 'alokasi_anggaran', parserType: 'currency', required: true, patterns: [/pagu|alokasi ?(anggaran|dana)|target ?(anggaran|dana)/] },
  { targetField: 'realisasi_siswa', parserType: 'number', required: true, patterns: [/realisasi ?sisw|salur ?sisw|tersalur ?sisw|sisw.*(salur|realisasi)/] },
  { targetField: 'realisasi_dana', parserType: 'currency', required: true, patterns: [/realisasi ?dan|salur ?dan|tersalur ?dan|dan.*(salur|realisasi)/] },
  { targetField: 'sisa_siswa', parserType: 'number', required: false, patterns: [/sisa ?sisw/] },
  { targetField: 'sisa_dana', parserType: 'currency', required: false, patterns: [/sisa ?dan|sisa ?anggaran/] },
  { targetField: 'progres_siswa', parserType: 'percent', required: false, patterns: [/progres ?sisw|persen ?sisw|% ?sisw/] },
  { targetField: 'progres_dana', parserType: 'percent', required: false, patterns: [/progres ?dan|persen ?dan|% ?dan/] },
];

export const ACTIVITY_RULES: HeaderRule[] = [
  { targetField: 'tahun', parserType: 'number', required: false, patterns: [/^tahun/] },
  { targetField: 'title', parserType: 'text', required: true, patterns: [/kegiatan|agenda|acara|judul|nama kegiatan|uraian/] },
  { targetField: 'start_date', parserType: 'date', required: true, patterns: [/tanggal ?mulai|tgl ?mulai|mulai|^tanggal$|^tgl$|waktu pelaksanaan/] },
  { targetField: 'end_date', parserType: 'date', required: false, patterns: [/tanggal ?selesai|tgl ?selesai|selesai|sampai|s d$/] },
  { targetField: 'start_time', parserType: 'time', required: false, patterns: [/jam ?mulai|waktu ?mulai|pukul/] },
  { targetField: 'end_time', parserType: 'time', required: false, patterns: [/jam ?selesai|waktu ?selesai/] },
  { targetField: 'location', parserType: 'text', required: false, patterns: [/lokasi|tempat|venue/] },
  { targetField: 'category', parserType: 'text', required: false, patterns: [/kategori|jenis/] },
  { targetField: 'pic', parserType: 'text', required: false, patterns: [/^pic|penanggung ?jawab|pj$/] },
  { targetField: 'participants', parserType: 'text', required: false, patterns: [/peserta|undangan/] },
  { targetField: 'status', parserType: 'text', required: false, patterns: [/^status/] },
  { targetField: 'notes', parserType: 'text', required: false, patterns: [/keterangan|catatan|note/] },
  { targetField: 'meeting_link', parserType: 'text', required: false, patterns: [/link ?(rapat|meeting|zoom)|zoom|meet/] },
  { targetField: 'document_link', parserType: 'text', required: false, patterns: [/link ?dokumen|dokumen|berkas|drive/] },
];

export interface DetectedMapping {
  detectedHeader: string;
  columnIndex: number;
  targetField: string;
  parserType: HeaderRule['parserType'];
  required: boolean;
}

/**
 * Cocokkan header aktual terhadap aturan. Header ambigu TIDAK ditebak:
 * hanya kecocokan pola pertama per target field yang dipakai.
 */
export function detectMappings(headers: string[], rules: HeaderRule[]): DetectedMapping[] {
  const result: DetectedMapping[] = [];
  const usedFields = new Set<string>();
  const usedColumns = new Set<number>();
  for (const rule of rules) {
    for (let i = 0; i < headers.length; i += 1) {
      if (usedColumns.has(i) || usedFields.has(rule.targetField)) continue;
      const header = normalizeHeader(headers[i] ?? '');
      if (!header) continue;
      if (rule.patterns.some((p) => p.test(header))) {
        result.push({
          detectedHeader: headers[i] ?? '',
          columnIndex: i,
          targetField: rule.targetField,
          parserType: rule.parserType,
          required: rule.required,
        });
        usedFields.add(rule.targetField);
        usedColumns.add(i);
      }
    }
  }
  return result;
}

/** Field wajib yang belum terpetakan. */
export function missingRequiredFields(
  detected: DetectedMapping[],
  rules: HeaderRule[],
): string[] {
  const found = new Set(detected.map((d) => d.targetField));
  return rules.filter((r) => r.required && !found.has(r.targetField)).map((r) => r.targetField);
}
