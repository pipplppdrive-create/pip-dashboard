/**
 * Token warna chart (tervalidasi scripts/validate_palette.js — mode light,
 * permukaan kartu putih):
 * - Ramp ordinal 1 hue (Alokasi → SK → Tersalur): #5a9cf5, #2361e3, #14244d.
 */
export const ORDINAL_RAMP = {
  alokasi: '#5a9cf5',
  sk: '#2361e3',
  salur: '#14244d',
} as const;

export const CHART_INK = {
  grid: '#e2e8f0',
  axis: '#64748b',
  label: '#334155',
  areaStroke: '#2361e3',
  areaFillFrom: 'rgba(53, 121, 238, 0.28)',
  areaFillTo: 'rgba(53, 121, 238, 0.02)',
} as const;
