import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FileText } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { JENJANG_LIST, type Jenjang } from '@/services/types';
import { CHART_INK, JENJANG_COLORS } from '../chart-tokens';
import type { SkStats } from '../lib';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

interface SkBulananChartProps {
  stats: SkStats;
}

/**
 * Penerbitan SK per bulan (Jan–Des) — bar bertumpuk per jenjang.
 * Satu nomor SK unik dihitung SATU kali pada bulan tanggal SK paling awal;
 * SK tanpa tanggal valid di luar chart (dilaporkan sebagai catatan).
 * Warna kategorikal jenjang berurutan tetap; angka eksak per jenjang selalu
 * tersedia di tabel Rekap per Jenjang (aturan relief kontras).
 */
export function SkBulananChart({ stats }: SkBulananChartProps) {
  if (stats.totalSk === 0) {
    return (
      <EmptyState
        compact
        icon={FileText}
        title="Belum ada data nomor SK"
        description="Jumlah SK tampil setelah sinkronisasi sheet Pemberian (kolom nomor & tanggal SK)."
      />
    );
  }

  const activeJenjang = JENJANG_LIST.filter((j) =>
    stats.perMonth.some((m) => (m.perJenjang[j] ?? 0) > 0),
  );
  const data = stats.perMonth.map((m) => ({
    bulan: MONTH_LABELS[m.month - 1],
    total: m.total,
    ...Object.fromEntries(activeJenjang.map((j) => [j, m.perJenjang[j] ?? 0])),
  }));
  const labelHost: Jenjang | undefined = activeJenjang[activeJenjang.length - 1];

  return (
    <div className="flex flex-col lg:h-full lg:min-h-0">
      <div
        className="h-56 sm:h-64 lg:h-auto lg:min-h-0 lg:flex-1"
        role="img"
        aria-label={`Grafik penerbitan SK per bulan: total ${stats.totalSk} SK unik`}
      >
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
            <XAxis
              dataKey="bulan"
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={{ fill: CHART_INK.axis, fontSize: 11, fontWeight: 600 }}
            />
            <YAxis
              width={30}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fill: CHART_INK.axis, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
              formatter={(value: number | string, name: string) => [`${value} SK`, name]}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                fontSize: 12,
                boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: CHART_INK.label }}
            />
            {activeJenjang.map((j) => (
              <Bar
                key={j}
                dataKey={j}
                stackId="sk"
                fill={JENJANG_COLORS[j]}
                stroke="#ffffff"
                strokeWidth={1}
                maxBarSize={30}
                isAnimationActive={false}
                radius={j === labelHost ? [3, 3, 0, 0] : undefined}
              >
                {j === labelHost && (
                  <LabelList
                    dataKey="total"
                    position="top"
                    formatter={(v: number) => (v > 0 ? v : '')}
                    style={{ fill: CHART_INK.label, fontSize: 11, fontWeight: 700 }}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {(stats.undatedSk > 0 || stats.multiDateNomor.length > 0) && (
        <p className="mt-1 shrink-0 text-[11px] text-slate-500">
          {stats.undatedSk > 0 && `${stats.undatedSk} SK tanpa tanggal valid (di luar grafik)`}
          {stats.undatedSk > 0 && stats.multiDateNomor.length > 0 && ' · '}
          {stats.multiDateNomor.length > 0 &&
            `${stats.multiDateNomor.length} SK perlu validasi tanggal (dipakai tanggal paling awal)`}
        </p>
      )}
    </div>
  );
}
