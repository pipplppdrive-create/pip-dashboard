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
            <th className="py-2 pr-3 short:py-1">Jenjang</th>
            <th className="tnum px-3 py-2 text-right short:py-1">Alokasi Siswa</th>
            <th className="tnum px-3 py-2 text-right short:py-1">SK Pemberian</th>
            <th className="tnum px-3 py-2 text-right short:py-1">Jumlah SK</th>
            <th className="tnum px-3 py-2 text-right short:py-1">Dana SK</th>
            <th className="w-40 px-3 py-2 short:py-1">Progres Siswa</th>
            <th className="tnum px-3 py-2 text-right short:py-1">Progres Dana</th>
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
                <td className="py-2 pr-3 font-bold text-slate-800 short:py-1">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: JENJANG_COLORS[r.jenjang] }}
                    />
                    {r.jenjang}
                  </span>
                </td>
                <td className="tnum px-3 py-2 text-right short:py-1">
                  {formatNumber(r.alokasiSiswa)}
                </td>
                <td className="tnum px-3 py-2 text-right font-semibold text-slate-900 short:py-1">
                  {formatNumber(r.skSiswa)}
                </td>
                <td className="tnum px-3 py-2 text-right short:py-1">
                  {skPerJenjang ? formatNumber(skPerJenjang[r.jenjang] ?? 0) : '–'}
                </td>
                <td className="tnum px-3 py-2 text-right short:py-1">
                  {formatRupiahCompact(r.skAnggaran)}
                </td>
                <td className="px-3 py-2 short:py-1">
                  <ProgressBar
                    value={progresSiswa * 100}
                    size="sm"
                    showValue
                    label={`Progres siswa ${r.jenjang}`}
                  />
                </td>
                <td className="tnum px-3 py-2 text-right short:py-1">
                  {formatPercent(progresDana)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-slate-900">
            <td className="py-2 pr-3 font-bold short:py-1">Total</td>
            <td className="tnum px-3 py-2 text-right font-bold short:py-1">
              {formatNumber(total.alokasiSiswa)}
            </td>
            <td className="tnum px-3 py-2 text-right font-bold short:py-1">
              {formatNumber(total.skSiswa)}
            </td>
            <td className="tnum px-3 py-2 text-right font-bold short:py-1">
              {skTotal !== null ? formatNumber(skTotal) : '–'}
              {crossJenjangNote && <span aria-hidden>*</span>}
            </td>
            <td className="tnum px-3 py-2 text-right font-bold short:py-1">
              {formatRupiahCompact(total.skAnggaran)}
            </td>
            <td className="px-3 py-2 short:py-1">
              <ProgressBar
                value={total.progresSiswa * 100}
                size="sm"
                showValue
                label="Progres siswa total"
              />
            </td>
            <td className="tnum px-3 py-2 text-right font-bold short:py-1">
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
