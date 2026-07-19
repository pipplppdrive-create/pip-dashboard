import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatRupiahCompact } from '@/lib/format';
import type { DistributionRow, Jenjang } from '@/services/types';
import { ProgressBar } from '@/components/ui/progress';
import { totalsFromRows, type JenjangFilter } from '../lib';
import { JENJANG_COLORS } from '../chart-tokens';

interface RekapJenjangTableProps {
  rows: DistributionRow[];
  highlight: JenjangFilter;
  /** Jumlah SK unik per jenjang; null bila detail SK belum tersedia. */
  skPerJenjang: Partial<Record<Jenjang, number>> | null;
  /** Jumlah SK unik global (SK lintas jenjang dihitung sekali). */
  skTotal: number | null;
}

/**
 * Satu-satunya sumber angka DETAIL per jenjang di Dashboard: alokasi,
 * SK Pemberian, jumlah SK unik, dana SK, dan progres. Kolom "Sisa" tidak
 * diulang di sini — tersirat dari progres dan sudah ada di kartu Capaian.
 */
export function RekapJenjangTable({
  rows,
  highlight,
  skPerJenjang,
  skTotal,
}: RekapJenjangTableProps) {
  const total = totalsFromRows(rows);
  const skSum = skPerJenjang ? Object.values(skPerJenjang).reduce((a, v) => a + (v ?? 0), 0) : 0;
  const crossJenjangNote = skTotal !== null && skPerJenjang !== null && skSum !== skTotal;
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            <th className="py-2.5 tall:py-1.5 short:py-1.5 pr-3">Jenjang</th>
            <th className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right">Alokasi Siswa</th>
            <th className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right">SK Pemberian</th>
            <th className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right">Jumlah SK</th>
            <th className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right">Dana SK</th>
            <th className="w-44 px-3 py-2.5 tall:py-1.5 short:py-1.5">Progres Siswa</th>
            <th className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right">Progres Dana</th>
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
                <td className="py-2.5 tall:py-1.5 short:py-1.5 pr-3 font-bold text-slate-800">
                  <span className="inline-flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: JENJANG_COLORS[r.jenjang] }}
                    />
                    {r.jenjang}
                  </span>
                </td>
                <td className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right text-slate-600">
                  {formatNumber(r.alokasiSiswa)}
                </td>
                <td className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right font-semibold text-slate-900">
                  {formatNumber(r.skSiswa)}
                </td>
                <td className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right text-slate-600">
                  {skPerJenjang ? formatNumber(skPerJenjang[r.jenjang] ?? 0) : '–'}
                </td>
                <td className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right text-slate-600">
                  {formatRupiahCompact(r.skAnggaran)}
                </td>
                <td className="px-3 py-2.5 tall:py-1.5 short:py-1.5">
                  <ProgressBar
                    value={progresSiswa * 100}
                    showValue
                    label={`Progres siswa ${r.jenjang}`}
                  />
                </td>
                <td className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right text-slate-600">
                  {formatPercent(progresDana)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 text-slate-900">
            <td className="py-2.5 tall:py-1.5 short:py-1.5 pr-3 font-extrabold">Total</td>
            <td className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right font-bold">
              {formatNumber(total.alokasiSiswa)}
            </td>
            <td className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right font-bold">{formatNumber(total.skSiswa)}</td>
            <td className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right font-bold">
              {skTotal !== null ? formatNumber(skTotal) : '–'}
              {crossJenjangNote && <span aria-hidden>*</span>}
            </td>
            <td className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right font-bold">
              {formatRupiahCompact(total.skAnggaran)}
            </td>
            <td className="px-3 py-2.5 tall:py-1.5 short:py-1.5">
              <ProgressBar
                value={total.progresSiswa * 100}
                showValue
                label="Progres siswa total"
              />
            </td>
            <td className="tnum px-3 py-2.5 tall:py-1.5 short:py-1.5 text-right font-bold">
              {formatPercent(total.progresDana)}
            </td>
          </tr>
        </tfoot>
      </table>
      {crossJenjangNote && (
        <p className="mt-1 text-[11px] text-slate-500">
          * Total menghitung nomor SK unik global; SK yang mencakup lebih dari satu jenjang dihitung
          pada tiap jenjang tetapi hanya sekali pada total.
        </p>
      )}
    </div>
  );
}
