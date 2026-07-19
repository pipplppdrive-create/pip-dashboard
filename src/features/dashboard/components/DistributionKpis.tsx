import { BadgeCheck, GraduationCap, Hourglass, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { formatNumber, formatPercent, formatRupiahCompact } from '@/lib/format';
import type { DistributionTotals } from '../lib';

interface KpiCardProps {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
  sub: string;
  progress?: number; // rasio 0–1
  progressLabel?: string;
  children?: ReactNode;
}

function KpiCard({
  icon: Icon,
  iconClass,
  label,
  value,
  sub,
  progress,
  progressLabel,
  children,
}: KpiCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
          <p className="tnum mt-1 truncate text-2xl font-extrabold text-slate-900 2xl:text-3xl">
            {value}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>
        </div>
        <span
          aria-hidden
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon className="size-4.5" />
        </span>
      </div>
      {progress !== undefined && (
        <div className="mt-3">
          <ProgressBar
            value={progress * 100}
            showValue
            label={progressLabel ?? `Progres ${label}`}
          />
        </div>
      )}
      {children}
    </Card>
  );
}

/**
 * Empat KPI penyaluran tanpa duplikasi angka.
 *
 * Pada data produksi, realisasi (siswa/dana tersalur) selalu identik dengan
 * SK Pemberian — realisasi diturunkan dari sheet Pemberian (kolom TOTAL).
 * Karena itu "Siswa Tersalur" tidak lagi ditampilkan sebagai KPI terpisah;
 * angka yang sama tidak diulang dengan judul berbeda.
 *
 * Susunan: Alokasi · SK Pemberian · Sisa · Capaian.
 */
export function DistributionKpis({ totals }: { totals: DistributionTotals }) {
  const skPct = totals.alokasiSiswa > 0 ? totals.skSiswa / totals.alokasiSiswa : 0;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={GraduationCap}
        iconClass="bg-slate-100 text-slate-600"
        label="Alokasi"
        value={`${formatNumber(totals.alokasiSiswa)} siswa`}
        sub={`Anggaran ${formatRupiahCompact(totals.alokasiAnggaran)}`}
      />
      <KpiCard
        icon={BadgeCheck}
        iconClass="bg-brand-50 text-brand-600"
        label="SK Pemberian"
        value={`${formatNumber(totals.skSiswa)} siswa`}
        sub={`${formatRupiahCompact(totals.skAnggaran)} · ${formatPercent(skPct)} dari alokasi`}
        progress={skPct}
        progressLabel="SK Pemberian terhadap alokasi siswa"
      />
      <KpiCard
        icon={Hourglass}
        iconClass="bg-warning-50 text-warning-600"
        label="Sisa"
        value={`${formatNumber(totals.sisaSiswa)} siswa`}
        sub={`Dana ${formatRupiahCompact(totals.sisaAnggaran)}`}
      />
      <Card className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Capaian</p>
          <span
            aria-hidden
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600"
          >
            <Target className="size-4.5" />
          </span>
        </div>
        <div className="mt-2 space-y-2.5">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Siswa</p>
            <ProgressBar value={totals.progresSiswa * 100} showValue label="Progres siswa" />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Dana</p>
            <ProgressBar value={totals.progresDana * 100} showValue label="Progres dana" />
          </div>
        </div>
      </Card>
    </div>
  );
}
