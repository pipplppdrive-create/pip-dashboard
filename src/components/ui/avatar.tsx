import { cn } from '@/lib/utils';
import type { Employee } from '@/services/types';

/** Palet warna avatar — kunci disimpan pada data pegawai, bukan hex bebas. */
export const AVATAR_COLORS: Record<string, string> = {
  blue: 'bg-brand-600',
  sky: 'bg-info-600',
  emerald: 'bg-success-600',
  amber: 'bg-warning-600',
  rose: 'bg-danger-600',
  violet: 'bg-violet-600',
  fuchsia: 'bg-fuchsia-600',
  teal: 'bg-teal-600',
  slate: 'bg-slate-600',
  orange: 'bg-orange-600',
};

export const AVATAR_COLOR_KEYS = Object.keys(AVATAR_COLORS);

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE: Record<AvatarSize, string> = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-12 text-base',
};

interface AvatarProps {
  employee: Pick<Employee, 'displayName' | 'initials' | 'color' | 'active'> | null | undefined;
  size?: AvatarSize;
  className?: string;
  /** Tampilkan tanda nonaktif (untuk histori pegawai nonaktif). */
  showInactive?: boolean;
}

export function Avatar({ employee, size = 'md', className, showInactive }: AvatarProps) {
  if (!employee) {
    return (
      <span
        aria-hidden
        className={cn(
          'inline-flex items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 font-bold text-slate-400',
          SIZE[size],
          className,
        )}
      >
        ?
      </span>
    );
  }
  const colorClass = AVATAR_COLORS[employee.color] ?? AVATAR_COLORS.slate;
  const inactive = showInactive && !employee.active;
  return (
    <span
      title={employee.displayName}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white',
        colorClass,
        SIZE[size],
        inactive && 'opacity-50 grayscale',
        className,
      )}
    >
      {employee.initials}
    </span>
  );
}

interface AvatarGroupProps {
  employees: Array<Pick<Employee, 'displayName' | 'initials' | 'color' | 'active'>>;
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export function AvatarGroup({ employees, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const shown = employees.slice(0, max);
  const rest = employees.length - shown.length;
  return (
    <span className={cn('inline-flex items-center -space-x-1.5', className)}>
      {shown.map((emp, i) => (
        <Avatar key={`${emp.displayName}-${i}`} employee={emp} size={size} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600 ring-2 ring-white',
            SIZE[size],
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
