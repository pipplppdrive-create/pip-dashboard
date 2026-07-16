import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { formatCompactNumber, formatDate, formatNumber } from '@/lib/format';
import { CHART_INK } from '../chart-tokens';
import type { TrendPoint } from '../lib';

interface TrendChartProps {
  points: TrendPoint[];
}

interface DotLabelProps {
  x?: number;
  y?: number;
  index?: number;
  value?: number;
}

/** Tren penyaluran siswa dari riwayat pembaruan snapshot (satu seri, satu hue). */
export function TrendChart({ points }: TrendChartProps) {
  if (points.length < 2) {
    return (
      <EmptyState
        compact
        icon={TrendingUp}
        title="Belum cukup riwayat"
        description="Tren tampil setelah data penyaluran diperbarui beberapa kali."
      />
    );
  }

  const data = points.map((p) => ({ ...p, dateLabel: formatDate(p.date) }));
  const lastIndex = data.length - 1;

  // Label langsung hanya pada titik terakhir (angka kunci terbaca tanpa hover).
  const LastPointLabel = ({ x, y, index, value }: DotLabelProps) => {
    if (index !== lastIndex || x === undefined || y === undefined || value === undefined) {
      return null;
    }
    return (
      <text
        x={x}
        y={y - 10}
        textAnchor="end"
        style={{ fill: CHART_INK.label, fontSize: 11, fontWeight: 700 }}
      >
        {formatCompactNumber(value)}
      </text>
    );
  };

  return (
    <div className="h-64 w-full 2xl:h-72" role="img" aria-label="Grafik tren siswa tersalur">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_INK.areaFillFrom} />
              <stop offset="100%" stopColor={CHART_INK.areaFillTo} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
          <XAxis
            dataKey="dateLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fill: CHART_INK.axis, fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis
            width={44}
            axisLine={false}
            tickLine={false}
            tick={{ fill: CHART_INK.axis, fontSize: 11 }}
            tickFormatter={(v: number) => formatCompactNumber(v)}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(value: number | string) => [
              `${formatNumber(Number(value))} siswa`,
              'Tersalur',
            ]}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              fontSize: 12,
              boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
            }}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="salurSiswa"
            stroke={CHART_INK.areaStroke}
            strokeWidth={2}
            fill="url(#trendFill)"
            dot={{ r: 2.5, strokeWidth: 0, fill: CHART_INK.areaStroke }}
            activeDot={{ r: 4 }}
            label={LastPointLabel}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
