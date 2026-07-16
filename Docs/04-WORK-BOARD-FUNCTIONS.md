# Work Board Functions

## Board

- Kanban horizontal.
- Drag-and-drop.
- Judul editable.
- Perubahan tanpa reload penuh.
- Search dan filter.
- Responsif.

## Step

Default:

- Will Do
- To Do
- On Progress
- Blocking
- Done

User dapat:

- menambah;
- mengubah nama;
- mengubah urutan;
- menghapus dengan pengamanan.

### Hapus step kosong

- minta konfirmasi;
- soft delete.

### Hapus step berisi kartu

- jangan langsung hapus;
- wajib pilih step tujuan;
- pindahkan seluruh kartu;
- kartu tidak boleh hilang.

## Kartu pekerjaan

Minimal:

- judul;
- deskripsi;
- jenis durasi;
- step;
- kategori;
- label;
- prioritas;
- tanggal mulai;
- target selesai;
- progres;
- PIC utama;
- PIC tambahan;
- checklist;
- kendala;
- tindak lanjut;
- komentar;
- lampiran;
- riwayat;
- status arsip;
- waktu update terakhir.

## PIC

- Multi-PIC.
- Satu PIC utama opsional.
- Dipilih dari master pegawai.
- Pegawai nonaktif tidak dapat dipilih untuk pekerjaan baru.
- Histori lama tetap menampilkan pegawai nonaktif.

## Progres

Mode:

- manual;
- otomatis dari checklist.

Rumus otomatis:

```text
jumlah item selesai / jumlah item keseluruhan × 100
```

## Checklist

- beberapa kelompok;
- tambah;
- edit;
- urutkan;
- centang;
- hapus;
- dapat memengaruhi progres.

## Komentar dan catatan

- komentar umum;
- kendala;
- tindak lanjut;
- pegawai pelaku;
- waktu.

## Lampiran

- tipe dan ukuran dibatasi;
- penyimpanan aman;
- metadata pengunggah;
- tidak digunakan untuk data siswa sensitif tanpa kebijakan tambahan.

## Arsip

- berada sebagai tab atau filter dalam halaman Pekerjaan;
- User dapat mengarsipkan;
- User dapat memulihkan;
- hapus permanen hanya Admin.

## Detail pekerjaan

Claude menentukan UI terbaik, tetapi semua field dan fungsi harus dapat diakses.
