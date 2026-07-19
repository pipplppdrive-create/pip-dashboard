import type { DistributionRow } from '@/services/types';
import { formatCompactNumber, formatPercent } from '@/lib/format';
import { EmptyState } from '@/components/feedback/empty-state';
import { PieChart } from 'lucide-react';
import { JENJANG_COLORS } from '../chart-tokens';

interface ProgresJenjangDonutsProps {
  rows: DistributionRow[];
}

/**
 * Progres per jenjang — kartu progres horizontal (bukan donut kecil): nama
 * jenjang + realisasi/alokasi siswa, persentase besar, dan bar progres. Setiap
 * jenjang mendapat baris penuh yang terdistribusi merata sepanjang tinggi kartu
 * agar terbaca jelas dari jarak TV. Warna bar mengikuti kategori jenjang (sama
 * dengan legend chart & titik tabel Rekap). Angka eksak tetap di tabel Rekap.
 */
export function ProgresJenjangDonuts({ rows }: ProgresJenjangDonutsProps) {
  const withData = rows.filter((r) => r.alokasiSiswa > 0 || r.salurSiswa > 0);
  if (withData.length === 0) {
    return (
      <EmptyState
        compact
        icon={PieChart}
        title="Belum ada alokasi per jenjang"
        description="Progres per jenjang tampil setelah alokasi dan realisasi tersedia."
      />
    );
  }

  return (
    <ul className="flex h-full min-h-0 flex-col gap-2.5">
      {withData.map((r) => {
        const pct = r.alokasiSiswa > 0 ? Math.min(r.salurSiswa / r.alokasiSiswa, 1) : 0;
        const color = JENJANG_COLORS[r.jenjang];
        return (
          <li
            key={r.jenjang}
            className="flex min-h-0 flex-1 flex-col justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5"
            aria-label={`${r.jenjang}: ${formatPercent(pct)} — realisasi ${formatCompactNumber(
              r.salurSiswa,
            )} dari alokasi ${formatCompactNumber(r.alokasiSiswa)} siswa`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-slate-800 2xl:text-base">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {r.jenjang}
                </span>
                <span className="tnum truncate text-xs text-slate-500 2xl:text-sm">
                  <span className="font-semibold text-slate-700">
                    {formatCompactNumber(r.salurSiswa)}
                  </span>{' '}
                  <span className="text-slate-400">/</span> {formatCompactNumber(r.alokasiSiswa)}{' '}
                  siswa
                </span>
              </div>
              <span className="tnum shrink-0 text-xl leading-none font-extrabold text-slate-900 2xl:text-2xl">
                {formatPercent(pct, 0)}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
              role="presentation"
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${pct * 100}%`, backgroundColor: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
