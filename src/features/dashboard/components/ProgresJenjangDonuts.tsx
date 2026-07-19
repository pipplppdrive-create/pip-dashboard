import type { DistributionRow } from '@/services/types';
import { formatNumber, formatCompactNumber, formatPercent } from '@/lib/format';
import { EmptyState } from '@/components/feedback/empty-state';
import { PieChart } from 'lucide-react';
import { ORDINAL_RAMP } from '../chart-tokens';

interface ProgresJenjangDonutsProps {
  rows: DistributionRow[];
}

const RADIUS = 42;
const CIRC = 2 * Math.PI * RADIUS;

/**
 * Progres per jenjang — ring kompak (satu hue magnitude, bukan warna
 * kategorikal): persentase, realisasi, dan alokasi per jenjang. Sisa tidak
 * diulang di sini (sudah tersirat dari progres; angka eksak ada di tabel
 * Rekap per Jenjang). Ring SVG murni — ringan & terbaca dari jarak TV.
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
    <div
      className={`grid content-stretch gap-2.5 lg:h-full lg:min-h-0 short:gap-2 ${withData.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}
    >
      {withData.map((r) => {
        const pct = r.alokasiSiswa > 0 ? Math.min(r.salurSiswa / r.alokasiSiswa, 1) : 0;
        const dash = pct * CIRC;
        return (
          <div
            key={r.jenjang}
            className="flex min-h-0 items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-2.5 short:p-1.5"
          >
            <div
              className="relative aspect-square h-14 shrink-0 lg:h-full lg:max-h-14 lg:min-h-9 2xl:max-h-18 short:max-h-10"
              role="img"
              aria-label={`${r.jenjang}: ${formatPercent(pct)} — realisasi ${formatNumber(
                r.salurSiswa,
              )} dari alokasi ${formatNumber(r.alokasiSiswa)} siswa`}
            >
              <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="12" />
                <circle
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  stroke={ORDINAL_RAMP.sk}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${CIRC - dash}`}
                />
              </svg>
              <span className="tnum absolute inset-0 flex items-center justify-center text-xs font-extrabold text-slate-900 2xl:text-sm short:text-[10px]">
                {formatPercent(pct, 0)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{r.jenjang}</p>
              <p className="tnum mt-0.5 truncate text-xs text-slate-600 short:mt-0">
                <span className="font-semibold text-slate-900">
                  {formatCompactNumber(r.salurSiswa)}
                </span>{' '}
                <span className="text-slate-400">/</span> {formatCompactNumber(r.alokasiSiswa)}{' '}
                siswa
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
