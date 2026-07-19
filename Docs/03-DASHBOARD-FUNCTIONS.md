# Dashboard Functions

> Diperbarui Juli 2026: Dashboard kini KHUSUS informasi penyaluran PIP.
> Seluruh ringkasan pekerjaan tim (statistik step, Perlu Perhatian, Fokus Hari
> Ini, Aktivitas) berada di **Pekerjaan › Ringkasan** — query/fungsinya tetap
> ada, hanya tidak ditampilkan pada Dashboard.

## Tujuan

Menampilkan kondisi utama penyaluran PIP dalam SATU layar tanpa scroll pada
TV 1920×1080, desktop 1440×900, dan laptop 1366×768 (tablet/mobile boleh
scroll). Satu informasi utama tampil satu kali — tanpa duplikasi.

## Sumber data (semua angka nyata — tanpa tren sintetis/dummy)

| Elemen | Sumber | Perhitungan |
|---|---|---|
| KPI Alokasi (siswa + anggaran) | Snapshot aktif `distribution_snapshots` | Kuota matriks "ALOKASI" REKAP PROGRESS (baris TOTAL) / konfigurasi kuota |
| KPI SK Pemberian (siswa + dana) | Snapshot aktif | Realisasi sheet `Pemberian` kolom TOTAL (identik dengan "tersalur" — tidak diulang) |
| KPI SK Pemberian — "n SK diterbitkan" | `pip_progress_records` | `COUNT(DISTINCT nomor SK)` (trim, case-insensitive; nomor kosong dilewati) |
| KPI Capaian (progres siswa & dana, sisa sebagai subteks) | Snapshot aktif | realisasi ÷ alokasi; sisa = alokasi − realisasi |
| Penerbitan SK per Bulan (bar bertumpuk per jenjang, Jan–Des) | `pip_progress_records` | SK unik per bulan dari tanggal SK; satu nomor = satu SK pada bulan tanggal valid PALING AWAL; tanggal invalid di luar agregasi (dilaporkan sebagai catatan, tanpa menebak bulan) |
| Progres per Jenjang (ring %, realisasi, alokasi) | Snapshot aktif | per jenjang: realisasi ÷ alokasi |
| Rekap per Jenjang (tabel) | Snapshot aktif + `pip_progress_records` | Alokasi siswa, SK Pemberian siswa, Jumlah SK unik, Dana SK, Progres siswa, Progres dana |

Logika agregasi SK: `src/features/dashboard/lib.ts` (`skStats`) — teruji unit
untuk nomor duplikat, nomor kosong, tanggal invalid, satu SK banyak baris,
SK lintas jenjang, dan agregasi bulanan.

## Aturan anti-duplikasi

- Realisasi/tersalur = SK Pemberian pada data produksi → tampil SEKALI.
- Sisa bukan kartu terpisah — subteks pada kartu Capaian.
- Kolom "Sisa" tidak ada di tabel rekap (tersirat dari progres).
- Tooltip bukan satu-satunya tempat angka penting (label langsung + tabel).
- Tabel rekap adalah satu-satunya sumber angka detail per jenjang.

## Perhitungan jumlah SK

1. Normalisasi nomor: trim; pencocokan case-insensitive; format asli dipertahankan.
2. Nomor sama pada banyak baris = SATU SK (bukan jumlah baris).
3. SK lintas jenjang dihitung pada tiap jenjang tercatat; total global tetap
   menghitung nomor unik sekali (footnote muncul otomatis bila berbeda).
4. Satu nomor dengan beberapa tanggal → ditandai "perlu validasi tanggal";
   deterministik memakai tanggal valid paling awal.
5. Nomor kosong tidak dihitung dan tidak dibuatkan ID buatan.

## Status pembaruan data

`Sumber: <nama sumber>` · `Terakhir diperbarui: <tanggal & waktu> WIB` ·
`Sinkronisasi berhasil` (atau Perlu validasi / gagal — data valid terakhir).

## Filter

- tahun;
- periode;
- jenjang (berlaku untuk KPI, chart SK, progres, dan sorotan tabel).

## Larangan

- tidak menampilkan data individual siswa;
- tidak membuat menu Penyaluran PIP terpisah;
- tidak menampilkan tren sintetis/snapshot historis buatan/angka interpolasi;
- tidak mengulang satu angka dengan judul berbeda;
- tidak menampilkan ringkasan pekerjaan tim di Dashboard (ada di Pekerjaan › Ringkasan).
