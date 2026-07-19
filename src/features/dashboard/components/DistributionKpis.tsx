import { BadgeCheck, GraduationCap, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { formatNumber, formatPercent, formatRupiahCompact } from '@/lib/format';
import type { DistributionTotals } from '../lib';

/**
 * Tiga KPI penyaluran tanpa duplikasi angka (satu informasi tampil satu kali):
 * - Alokasi     : kuota siswa + anggaran tahun berjalan.
 * - SK Pemberian: realisasi siswa + dana + jumlah SK unik terbit (COUNT DISTINCT
 *                 nomor SK dari sheet Pemberian). Pada data produksi realisasi
 *                 tersalur identik dengan SK Pemberian, jadi tidak diulang.
 * - Capaian     : progres siswa & dana terhadap alokasi; SISA cukup jadi
 *                 subteks di sini (bukan kartu terpisah).
 */
export function DistributionKpis({
  totals,
  skCount,
}: {
  totals: DistributionTotals;
  /** Jumlah nomor SK unik; null bila detail SK belum tersedia. */
  skCount: number | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Alokasi */}
      <Card className="flex flex-col justify-between gap-2.5 p-4 tall:gap-2 tall:p-3.5 short:gap-2 short:p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Alokasi</p>
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
          >
            <GraduationCap className="size-5" />
          </span>
        </div>
        <div>
          <p className="tnum text-3xl leading-none font-extrabold text-slate-900 2xl:text-4xl">
            {formatNumber(totals.alokasiSiswa)}{' '}
            <span className="text-base font-bold text-slate-500">siswa</span>
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            Anggaran{' '}
            <span className="font-semibold text-slate-700">
              {formatRupiahCompact(totals.alokasiAnggaran)}
            </span>
          </p>
        </div>
      </Card>

      {/* SK Pemberian */}
      <Card className="flex flex-col justify-between gap-2.5 p-4 tall:gap-2 tall:p-3.5 short:gap-2 short:p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            SK Pemberian
          </p>
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"
          >
            <BadgeCheck className="size-5" />
          </span>
        </div>
        <div>
          <p className="tnum text-3xl leading-none font-extrabold text-slate-900 2xl:text-4xl">
            {formatNumber(totals.skSiswa)}{' '}
            <span className="text-base font-bold text-slate-500">siswa</span>
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <span>
              Dana{' '}
              <span className="font-semibold text-slate-700">
                {formatRupiahCompact(totals.skAnggaran)}
              </span>
            </span>
            {skCount !== null && (
              <span className="tnum inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                {formatNumber(skCount)} SK terbit
              </span>
            )}
          </p>
        </div>
      </Card>

      {/* Capaian */}
      <Card className="flex flex-col justify-between gap-2.5 p-4 tall:gap-2 tall:p-3.5 short:gap-2 short:p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Capaian</p>
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600"
          >
            <Target className="size-5" />
          </span>
        </div>
        <div className="space-y-2">
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs font-medium text-slate-500">Progres siswa</span>
              <span className="tnum text-sm font-bold text-slate-800">
                {formatPercent(totals.progresSiswa, 0)}
              </span>
            </div>
            <ProgressBar value={totals.progresSiswa * 100} label="Progres siswa" />
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs font-medium text-slate-500">Progres dana</span>
              <span className="tnum text-sm font-bold text-slate-800">
                {formatPercent(totals.progresDana, 0)}
              </span>
            </div>
            <ProgressBar value={totals.progresDana * 100} label="Progres dana" />
          </div>
        </div>
        <p className="tnum text-xs text-slate-500">
          Sisa {formatNumber(totals.sisaSiswa)} siswa ·{' '}
          {formatRupiahCompact(totals.sisaAnggaran)}
        </p>
      </Card>
    </div>
  );
}
