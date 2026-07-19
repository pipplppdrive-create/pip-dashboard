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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card className="flex flex-col justify-center p-4 short:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Alokasi</p>
            <p className="tnum mt-1 text-2xl font-extrabold text-slate-900 sm:text-xl xl:text-2xl 2xl:text-3xl short:text-xl">
              {formatNumber(totals.alokasiSiswa)} <span className="text-base font-bold">siswa</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Anggaran {formatRupiahCompact(totals.alokasiAnggaran)}
            </p>
          </div>
          <span
            aria-hidden
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
          >
            <GraduationCap className="size-4.5" />
          </span>
        </div>
      </Card>

      <Card className="flex flex-col justify-center p-4 short:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              SK Pemberian
            </p>
            <p className="tnum mt-1 text-2xl font-extrabold text-slate-900 sm:text-xl xl:text-2xl 2xl:text-3xl short:text-xl">
              {formatNumber(totals.skSiswa)} <span className="text-base font-bold">siswa</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Dana {formatRupiahCompact(totals.skAnggaran)}
              {skCount !== null && (
                <>
                  {' · '}
                  <span className="font-semibold text-slate-700">
                    {formatNumber(skCount)} SK
                  </span>{' '}
                  diterbitkan
                </>
              )}
            </p>
          </div>
          <span
            aria-hidden
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"
          >
            <BadgeCheck className="size-4.5" />
          </span>
        </div>
      </Card>

      <Card className="flex flex-col justify-center p-4 short:p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Capaian</p>
          <span
            aria-hidden
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600"
          >
            <Target className="size-4.5" />
          </span>
        </div>
        <div className="mt-1.5 space-y-2 short:mt-1 short:space-y-1.5">
          <div>
            <p className="mb-0.5 text-xs font-medium text-slate-500">Siswa</p>
            <ProgressBar value={totals.progresSiswa * 100} showValue label="Progres siswa" />
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium text-slate-500">Dana</p>
            <ProgressBar value={totals.progresDana * 100} showValue label="Progres dana" />
          </div>
        </div>
        <p className="tnum mt-1.5 text-xs text-slate-500">
          Sisa {formatNumber(totals.sisaSiswa)} siswa · {formatRupiahCompact(totals.sisaAnggaran)}{' '}
          <span className="text-slate-400">
            ({formatPercent(1 - totals.progresSiswa, 0)} siswa)
          </span>
        </p>
      </Card>
    </div>
  );
}
