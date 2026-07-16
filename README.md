# Dashboard Pekerjaan PIP Puslapdik

Pusat monitoring bersama untuk **penyaluran PIP** dan **pekerjaan tim PIP Puslapdik** — dapat
diakses dari TV ruang kerja, desktop, laptop, tablet, dan ponsel.

Spesifikasi fungsi lengkap berada di folder [`Docs/`](Docs/) (source of truth).

## Stack

| Bagian        | Teknologi                                                        |
| ------------- | ---------------------------------------------------------------- |
| UI            | React 19 + TypeScript (strict) + Vite                            |
| Styling       | Tailwind CSS 4 + design tokens, Radix UI primitives              |
| Routing       | React Router 7                                                   |
| Data & state  | TanStack Query 5, Zustand                                        |
| Drag-and-drop | @dnd-kit (dukungan keyboard)                                     |
| Grafik        | Recharts                                                         |
| Backend       | Supabase (Postgres + RLS + Realtime + Storage) — via adapter     |
| Mode lokal    | Adapter lokal (data di perangkat, realtime antar-tab)            |
| Test          | Vitest + Testing Library (unit/integration), Playwright + axe (E2E/a11y) |

## Menjalankan

```bash
npm install
npm run dev
```

Aplikasi berjalan pada `http://localhost:5173`.

### Mode data

Atur lewat `.env.local` (salin dari `.env.example`):

- `VITE_DATA_MODE=local` *(default)* — tanpa backend; data contoh tersimpan di perangkat.
  Kredensial development mode lokal didokumentasikan di [`DEVELOPMENT.md`](DEVELOPMENT.md).
- `VITE_DATA_MODE=supabase` — backend produksi; wajib mengisi `VITE_SUPABASE_URL` dan
  `VITE_SUPABASE_ANON_KEY`. Setup lengkap (migration, akun, edge function, hosting):
  [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Skrip

| Perintah               | Fungsi                                   |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Server development                       |
| `npm run build`        | Type-check + build produksi ke `dist/`   |
| `npm run preview`      | Menyajikan hasil build                   |
| `npm run lint`         | ESLint                                   |
| `npm run typecheck`    | TypeScript `--noEmit`                    |
| `npm run test`         | Unit & integration test (Vitest)         |
| `npm run e2e`          | E2E test (Playwright, otomatis build+preview) |
| `npm run format`       | Prettier                                 |

## Struktur

```text
src/
├── components/     # ui primitives, layout, feedback
├── features/       # auth, dashboard, board, admin
├── hooks/          # hooks data (TanStack Query)
├── lib/            # util, format, progress, routes
├── services/       # kontrak domain + adapter (local / supabase)
└── test/           # setup test
e2e/                # Playwright spec
Docs/               # spesifikasi produk (source of truth)
```

Keputusan teknis penting dicatat di [`DECISIONS.md`](DECISIONS.md).
