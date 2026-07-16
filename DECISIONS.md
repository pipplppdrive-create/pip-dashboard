# Catatan Keputusan Teknis

Dokumen ini mencatat keputusan teknis penting beserta alasannya. Fungsi aplikasi mengikuti
`Docs/` dan tidak diubah oleh keputusan di sini.

## D1 — SPA Vite + React, bukan framework SSR

**Keputusan:** Aplikasi dibangun sebagai SPA (Vite + React 19 + TypeScript strict), bukan Next.js/SSR.

**Alasan:**

- Aplikasi bersifat internal, realtime, dan berjalan lama di TV/desktop — tidak butuh SEO/SSR.
- Verifikasi role tetap **server-side** di lapisan backend (Supabase RLS / Postgres policy),
  bukan di client, sesuai `Docs/06-DATA-REALTIME-SECURITY.md`.
- Deploy menjadi statis dan sederhana (nginx/CDN/hosting statis apa pun).

## D2 — Arsitektur service adapter (`local` / `supabase`)

**Keputusan:** Seluruh fitur mengakses data hanya melalui interface `DataService`
(`src/services/types.ts`). Tersedia dua adapter: `local` (data di perangkat, realtime antar-tab
via BroadcastChannel) dan `supabase` (produksi).

**Alasan:**

- Kredensial backend belum tersedia — pembangunan dan pengujian penuh tetap berjalan pada mode
  `local` tanpa mengubah kode fitur.
- Mock data terpisah dari service produksi (aturan pengerjaan): seed hanya ada di adapter lokal.
- Perpindahan ke produksi = mengganti env `VITE_DATA_MODE`, bukan menulis ulang fitur.

## D3 — Supabase sebagai backend produksi

**Keputusan:** Postgres + RLS + Realtime + Storage + Auth dari Supabase (Fase 7).

**Alasan:** kebutuhan spesifikasi terpetakan 1:1 — realtime tanpa reload (Realtime),
role diverifikasi server-side (RLS), lampiran private + signed URL (Storage), audit trail
(tabel append-only + trigger), backup (pg_dump/PITR).

## D4 — Perilaku step lewat `kind`, bukan nama step

**Keputusan:** Step board memiliki properti `kind: NORMAL | BLOCKED | DONE`. Step default
"Blocking" ber-`kind` BLOCKED dan "Done" ber-`kind` DONE.

**Alasan:** Spesifikasi mengharuskan nama step bebas diubah/ditambah oleh User tanpa hard-code,
sementara Dashboard perlu tahu pekerjaan mana yang "blocked" (Perlu Perhatian) dan "selesai"
(Aktivitas). Menandai *perilaku* pada step menjaga keduanya tetap dinamis. "Terlambat" tetap
bukan step — dihitung dari tenggat.

## D5 — Konflik via optimistic concurrency (kolom `version`)

**Keputusan:** Entitas yang bisa diedit bersama (task, step, board, settings, snapshot) memiliki
kolom `version`. Mutasi menyertakan `expectedVersion`; ketidakcocokan → `ConflictError` dan UI
menawarkan muat ulang. Tidak ada penimpaan diam-diam.

## D6 — Satu board kerja

**Keputusan:** Satu board tim (judul dapat diubah). Multi-board tidak dibuat karena tidak
diminta spesifikasi dan menambah kompleksitas navigasi yang dikunci.

## D7 — Library

- **@dnd-kit** untuk drag-and-drop: dukungan keyboard & screen reader (aksesibilitas board).
- **Recharts v2** untuk grafik: stabil dengan React 19; v3 masih baru — dievaluasi terpisah.
- **exceljs** untuk parsing Excel di browser: paket `xlsx` (SheetJS) versi npm tertinggal dan
  memiliki CVE yang tidak dipatch di npm; exceljs dirawat aktif.
- **date-fns + locale `id`** untuk tanggal Indonesia.
- **Plus Jakarta Sans** (self-host via Fontsource): terbaca baik pada TV, karakter modern
  profesional, mendukung angka tabular; tanpa permintaan CDN eksternal.

## D8 — Bahasa antarmuka

Seluruh UI berbahasa Indonesia (pengguna: pimpinan & staf PIP Puslapdik). Kode, komentar, dan
identifier berbahasa Inggris/campuran seperlunya.
