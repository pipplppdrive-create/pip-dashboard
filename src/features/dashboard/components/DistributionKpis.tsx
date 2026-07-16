import { BadgeCheck, Banknote, GraduationCap, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
}

function KpiCard({ icon: Icon, iconClass, label, value, sub, progress, progressLabel }: KpiCardProps) {
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
    </Card>
  );
}

/** 10 angka wajib penyaluran: alokasi, SK, tersalur, sisa, progres (siswa & dana). */
export function DistributionKpis({ totals }: { totals: DistributionTotals }) {
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
        sub={`${formatRupiahCompact(totals.skAnggaran)} · ${formatPercent(
          totals.alokasiSiswa > 0 ? totals.skSiswa / totals.alokasiSiswa : 0,
        )} dari alokasi`}
      />
      <KpiCard
        icon={Users}
        iconClass="bg-success-50 text-success-600"
        label="Siswa Tersalur"
        value={formatNumber(totals.salurSiswa)}
        sub={`Sisa ${formatNumber(totals.sisaSiswa)} siswa`}
        progress={totals.progresSiswa}
        progressLabel="Progres siswa tersalur"
      />
      <KpiCard
        icon={Banknote}
        iconClass="bg-success-50 text-success-600"
        label="Dana Tersalur"
        value={formatRupiahCompact(totals.salurAnggaran)}
        sub={`Sisa ${formatRupiahCompact(totals.sisaAnggaran)}`}
        progress={totals.progresDana}
        progressLabel="Progres dana tersalur"
      />
    </div>
  );
}
