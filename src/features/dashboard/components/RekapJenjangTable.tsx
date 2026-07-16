import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatRupiahCompact } from '@/lib/format';
import type { DistributionRow } from '@/services/types';
import { ProgressBar } from '@/components/ui/progress';
import { totalsFromRows, type JenjangFilter } from '../lib';

interface RekapJenjangTableProps {
  rows: DistributionRow[];
  highlight: JenjangFilter;
}

/** Rekap per jenjang + progres per jenjang (bar magnitude satu hue, label persen terbaca). */
export function RekapJenjangTable({ rows, highlight }: RekapJenjangTableProps) {
  const total = totalsFromRows(rows);
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            <th className="py-2.5 pr-3">Jenjang</th>
            <th className="tnum px-3 py-2.5 text-right">Alokasi</th>
            <th className="tnum px-3 py-2.5 text-right">SK Pemberian</th>
            <th className="tnum px-3 py-2.5 text-right">Tersalur</th>
            <th className="tnum px-3 py-2.5 text-right">Sisa</th>
            <th className="tnum px-3 py-2.5 text-right">Dana Tersalur</th>
            <th className="w-44 px-3 py-2.5">Progres Siswa</th>
            <th className="tnum px-3 py-2.5 text-right">Progres Dana</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const progresSiswa = r.alokasiSiswa > 0 ? r.salurSiswa / r.alokasiSiswa : 0;
            const progresDana = r.alokasiAnggaran > 0 ? r.salurAnggaran / r.alokasiAnggaran : 0;
            return (
              <tr
                key={r.jenjang}
                className={cn(
                  'border-b border-slate-100',
                  highlight === r.jenjang && 'bg-brand-50/60',
                )}
              >
                <td className="py-2.5 pr-3 font-bold text-slate-800">{r.jenjang}</td>
                <td className="tnum px-3 py-2.5 text-right">{formatNumber(r.alokasiSiswa)}</td>
                <td className="tnum px-3 py-2.5 text-right">{formatNumber(r.skSiswa)}</td>
                <td className="tnum px-3 py-2.5 text-right font-semibold text-slate-900">
                  {formatNumber(r.salurSiswa)}
                </td>
                <td className="tnum px-3 py-2.5 text-right">
                  {formatNumber(r.alokasiSiswa - r.salurSiswa)}
                </td>
                <td className="tnum px-3 py-2.5 text-right">
                  {formatRupiahCompact(r.salurAnggaran)}
                </td>
                <td className="px-3 py-2.5">
                  <ProgressBar
                    value={progresSiswa * 100}
                    size="sm"
                    showValue
                    label={`Progres siswa ${r.jenjang}`}
                  />
                </td>
                <td className="tnum px-3 py-2.5 text-right">{formatPercent(progresDana)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-slate-900">
            <td className="py-2.5 pr-3 font-bold">Total</td>
            <td className="tnum px-3 py-2.5 text-right font-bold">
              {formatNumber(total.alokasiSiswa)}
            </td>
            <td className="tnum px-3 py-2.5 text-right font-bold">
              {formatNumber(total.skSiswa)}
            </td>
            <td className="tnum px-3 py-2.5 text-right font-bold">
              {formatNumber(total.salurSiswa)}
            </td>
            <td className="tnum px-3 py-2.5 text-right font-bold">
              {formatNumber(total.sisaSiswa)}
            </td>
            <td className="tnum px-3 py-2.5 text-right font-bold">
              {formatRupiahCompact(total.salurAnggaran)}
            </td>
            <td className="px-3 py-2.5">
              <ProgressBar
                value={total.progresSiswa * 100}
                size="sm"
                showValue
                label="Progres siswa total"
              />
            </td>
            <td className="tnum px-3 py-2.5 text-right font-bold">
              {formatPercent(total.progresDana)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
