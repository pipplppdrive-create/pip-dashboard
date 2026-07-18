# Setup Akun USER & ADMIN

Aplikasi memakai satu halaman login (username + password). Role ditentukan
server setelah kredensial terverifikasi; tidak ada pemilihan role di login.

Username dipetakan ke email Supabase Auth pada domain internal
(`VITE_AUTH_EMAIL_DOMAIN` atau `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN`, default
`pip.local`):

| Akun | Username | Email Supabase Auth | Role |
| --- | --- | --- | --- |
| Tim PIP (bersama) | `tim-pip` | `tim-pip@pip.local` | `USER` |
| Admin | `admin` | `admin@pip.local` | `ADMIN` |

Username lain boleh, selama email = `<username>@<domain>` dan ada baris
`account_roles`.

## Langkah Terminal Aman

Jalankan dari root repository:

```powershell
npm run auth:setup
```

Skrip akan meminta username dan password untuk akun USER bersama serta akun
ADMIN. Password dibaca dengan prompt aman PowerShell (`Read-Host
-AsSecureString`), tidak dicetak, dan tidak disimpan di repository.

Skrip hanya membuat atau memperbarui dua akun tersebut, lalu mengisi
`account_roles`.

## Uji Login

- `tim-pip` + password tim: masuk sebagai Tim PIP, tanpa menu Admin.
- `admin` + password admin: masuk sebagai Admin.

## Identitas Pegawai Pelaku

Akun Tim PIP dipakai bersama; setiap aksi penting tetap meminta pegawai pelaku
(dipilih dari 25 pegawai seed) dan tercatat di audit log. Audit menyimpan label
akun, `employee_id`, serta metadata JSON `account_user_id` dan
`employee_actor_id`.

## Ganti Password

- Password akun Tim dapat diganti Admin dari Admin > Pengaturan (memakai edge
  function `admin-actions`), atau lewat Supabase Studio.
- Password Admin diganti lewat Supabase Studio.

## Mode Lokal

Kredensial development mode lokal: `tim-pip` / `pip2026` dan `admin` /
`admin2026` (hanya berlaku di perangkat masing-masing).
