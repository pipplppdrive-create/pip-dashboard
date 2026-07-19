import type { DistributionRow } from '@/services/types';
import { formatNumber, formatPercent } from '@/lib/format';
import { EmptyState } from '@/components/feedback/empty-state';
import { PieChart } from 'lucide-react';
import { ORDINAL_RAMP } from '../chart-tokens';

interface ProgresJenjangDonutsProps {
  rows: DistributionRow[];
}

const RADIUS = 42;
const CIRC = 2 * Math.PI * RADIUS;

/**
 * Donut progres per jenjang (realisasi/SK Pemberian terhadap alokasi).
 * Setiap donut menampilkan — tanpa hover — nama jenjang, persentase, realisasi,
 * alokasi, dan sisa. Ring SVG murni (ringan, terbaca dari jarak jauh untuk TV).
 * Realisasi = SK Pemberian (identik pada data produksi).
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {withData.map((r) => {
        const pct = r.alokasiSiswa > 0 ? Math.min(r.salurSiswa / r.alokasiSiswa, 1) : 0;
        const sisa = Math.max(r.alokasiSiswa - r.salurSiswa, 0);
        const dash = pct * CIRC;
        return (
          <div
            key={r.jenjang}
            className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm"
          >
            <div
              className="relative shrink-0"
              role="img"
              aria-label={`${r.jenjang}: ${formatPercent(pct)} — ${formatNumber(
                r.salurSiswa,
              )} dari ${formatNumber(r.alokasiSiswa)} siswa`}
            >
              <svg viewBox="0 0 100 100" className="size-20 -rotate-90 2xl:size-24">
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
              <span className="tnum absolute inset-0 flex items-center justify-center text-base font-extrabold text-slate-900 2xl:text-lg">
                {formatPercent(pct, 0)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">{r.jenjang}</p>
              <dl className="mt-1 space-y-0.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Realisasi</dt>
                  <dd className="tnum font-semibold text-slate-900">
                    {formatNumber(r.salurSiswa)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Alokasi</dt>
                  <dd className="tnum font-medium text-slate-700">
                    {formatNumber(r.alokasiSiswa)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Sisa</dt>
                  <dd className="tnum font-medium text-slate-700">{formatNumber(sisa)}</dd>
                </div>
              </dl>
            </div>
          </div>
        );
      })}
    </div>
  );
}
