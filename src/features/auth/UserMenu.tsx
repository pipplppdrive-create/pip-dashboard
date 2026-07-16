import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LogOut, MonitorSmartphone, RefreshCw, UserRound } from 'lucide-react';
import { notify } from '@/components/feedback/toaster';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownRoot,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown';
import { ROUTES } from '@/lib/routes';
import { useEmployees } from '@/hooks/queries';
import { SessionsDialog } from './SessionsDialog';
import { useSessionStore } from './session-store';

/** Chip pengguna di header: pegawai pelaku aktif, ganti pelaku, kelola sesi, keluar. */
export function UserMenu() {
  const { session, role, actorId, openActorPicker, logout } = useSessionStore();
  const { data: employees } = useEmployees(true);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const navigate = useNavigate();

  if (!session) return null;

  const actor = employees?.find((e) => e.id === actorId) ?? null;

  async function handleLogout() {
    await logout();
    notify.info('Anda telah keluar.');
    navigate(ROUTES.login, { replace: true });
  }

  return (
    <>
      <DropdownRoot>
        <DropdownTrigger asChild>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-3 pl-1 shadow-sm transition-colors hover:border-brand-300"
            aria-label="Menu pengguna"
          >
            <Avatar employee={actor} size="md" />
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-32 truncate text-xs leading-tight font-bold text-slate-800">
                {actor ? actor.displayName : 'Pilih pegawai'}
              </span>
              <span className="block text-[10px] leading-tight font-semibold tracking-wide text-slate-400 uppercase">
                {role === 'ADMIN' ? 'Admin' : 'Tim PIP'}
              </span>
            </span>
          </button>
        </DropdownTrigger>
        <DropdownContent className="w-60">
          <DropdownLabel>
            {actor ? `${actor.fullName}` : 'Pegawai pelaku belum dipilih'}
          </DropdownLabel>
          <div className="px-2.5 pb-2">
            <Badge tone={role === 'ADMIN' ? 'brand' : 'neutral'}>
              {role === 'ADMIN' ? 'Akun Admin' : 'Akun bersama Tim PIP'}
            </Badge>
          </div>
          <DropdownSeparator />
          <DropdownItem icon={<UserRound />} onSelect={() => openActorPicker()}>
            {actor ? 'Ganti pegawai pelaku' : 'Pilih pegawai pelaku'}
          </DropdownItem>
          {role === 'ADMIN' && (
            <DropdownItem icon={<MonitorSmartphone />} onSelect={() => setSessionsOpen(true)}>
              Kelola sesi perangkat
            </DropdownItem>
          )}
          <DropdownItem
            icon={<RefreshCw />}
            onSelect={() => {
              window.location.reload();
            }}
          >
            Muat ulang data
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem danger icon={<LogOut />} onSelect={() => void handleLogout()}>
            Keluar
          </DropdownItem>
        </DropdownContent>
      </DropdownRoot>
      {role === 'ADMIN' && (
        <SessionsDialog open={sessionsOpen} onOpenChange={setSessionsOpen} />
      )}
    </>
  );
}
