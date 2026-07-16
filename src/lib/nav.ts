import { LayoutDashboard, ShieldCheck, SquareKanban, type LucideIcon } from 'lucide-react';
import type { Role } from '@/services/types';
import { ROUTES } from './routes';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Role yang boleh melihat menu ini. */
  roles: Role[];
}

/** Navigasi terkunci sesuai spesifikasi — dilarang menambah menu utama. */
export const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard, roles: ['USER', 'ADMIN'] },
  { to: ROUTES.pekerjaan, label: 'Pekerjaan', icon: SquareKanban, roles: ['USER', 'ADMIN'] },
  { to: ROUTES.admin, label: 'Admin', icon: ShieldCheck, roles: ['ADMIN'] },
];

export function navItemsForRole(role: Role | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
