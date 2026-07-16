import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { navItemsForRole } from '@/lib/nav';
import type { Role } from '@/services/types';
import { useClock } from '@/hooks/useClock';
import { BrandMark } from './BrandMark';

interface AppShellProps {
  children: ReactNode;
  role?: Role;
  appName?: string;
  logoDataUrl?: string | null;
  /** Slot kanan header (chip pegawai aktif, status realtime — Fase 3+). */
  headerExtra?: ReactNode;
}

/**
 * Kerangka aplikasi:
 * - ≥lg  : sidebar kiri gelap + area konten.
 * - <lg  : app bar atas + bottom tab navigation.
 */
export function AppShell({
  children,
  role = 'ADMIN',
  appName = 'Dashboard PIP',
  logoDataUrl = null,
  headerExtra,
}: AppShellProps) {
  const items = navItemsForRole(role);
  const location = useLocation();
  const now = useClock();
  const active = items.find(
    (i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`),
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Lewati ke konten utama
      </a>

      {/* Sidebar — desktop */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-brand-950 lg:flex"
        aria-label="Navigasi utama"
      >
        <div className="flex items-center gap-3 px-5 pt-6 pb-8">
          <BrandMark logoDataUrl={logoDataUrl} />
          <div className="min-w-0">
            <p className="truncate text-[15px] leading-tight font-bold text-white">{appName}</p>
            <p className="text-[11px] font-medium text-slate-400">Puslapdik · Kemendikdasmen</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Menu">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-white/12 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]'
                    : 'text-slate-300 hover:bg-white/6 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    aria-hidden
                    className={cn(
                      'size-5 transition-colors',
                      isActive ? 'text-brand-300' : 'text-slate-400 group-hover:text-slate-200',
                    )}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Program Indonesia Pintar
            <br />
            Monitoring penyaluran &amp; pekerjaan tim
          </p>
        </div>
      </aside>

      {/* App bar — mobile/tablet */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <BrandMark logoDataUrl={logoDataUrl} className="size-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-bold text-slate-900">
            {active?.label ?? appName}
          </p>
          <p className="text-[11px] font-medium text-slate-500">{appName}</p>
        </div>
        {headerExtra}
      </header>

      {/* Header — desktop */}
      <header className="sticky top-0 z-30 hidden items-center justify-between gap-4 border-b border-slate-200/80 bg-slate-100/85 px-8 py-4 backdrop-blur lg:flex">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {active?.label ?? appName}
        </h1>
        <div className="flex items-center gap-4">
          <p className="tnum text-sm font-medium text-slate-500" aria-label="Waktu saat ini">
            {format(now, 'EEEE, d MMMM yyyy · HH.mm', { locale: localeId })}
          </p>
          {headerExtra}
        </div>
      </header>

      {/* Konten */}
      <main id="konten-utama" className="px-4 pt-4 pb-24 sm:px-6 lg:px-8 lg:pt-6 lg:pb-10">
        {children}
      </main>

      {/* Bottom nav — mobile/tablet */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[max(env(safe-area-inset-bottom),0.25rem)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex min-w-16 flex-col items-center gap-0.5 px-3 pt-2 pb-1.5 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-brand-100',
                    )}
                  >
                    <item.icon aria-hidden className="size-5" />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
