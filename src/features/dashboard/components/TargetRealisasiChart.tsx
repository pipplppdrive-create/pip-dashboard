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
import type { DistributionRow } from '@/services/types';
import { formatCompactNumber, formatNumber } from '@/lib/format';
import { CHART_INK, ORDINAL_RAMP } from '../chart-tokens';

interface TargetRealisasiChartProps {
  rows: DistributionRow[];
}

/**
 * Target vs realisasi per jenjang (jumlah siswa).
 * Tiga tahap satu funnel → ramp ordinal satu hue (bukan warna kategorikal).
 * Nilai kunci (Tersalur) diberi label langsung agar terbaca tanpa hover.
 */
export function TargetRealisasiChart({ rows }: TargetRealisasiChartProps) {
  const data = rows.map((r) => ({
    jenjang: r.jenjang,
    Alokasi: r.alokasiSiswa,
    'SK Pemberian': r.skSiswa,
    Tersalur: r.salurSiswa,
  }));

  return (
    <div className="h-64 w-full 2xl:h-72" role="img" aria-label="Grafik target dibanding realisasi siswa per jenjang">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
          <XAxis
            dataKey="jenjang"
            axisLine={false}
            tickLine={false}
            tick={{ fill: CHART_INK.axis, fontSize: 12, fontWeight: 600 }}
          />
          <YAxis
            width={44}
            axisLine={false}
            tickLine={false}
            tick={{ fill: CHART_INK.axis, fontSize: 11 }}
            tickFormatter={(v: number) => formatCompactNumber(v)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
            formatter={(value: number | string) => [`${formatNumber(Number(value))} siswa`]}
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
          <Bar
            dataKey="Alokasi"
            fill={ORDINAL_RAMP.alokasi}
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
            isAnimationActive={false}
          />
          <Bar
            dataKey="SK Pemberian"
            fill={ORDINAL_RAMP.sk}
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
            isAnimationActive={false}
          />
          <Bar
            dataKey="Tersalur"
            fill={ORDINAL_RAMP.salur}
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="Tersalur"
              position="top"
              formatter={(v: number) => formatCompactNumber(v)}
              style={{ fill: CHART_INK.label, fontSize: 11, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
