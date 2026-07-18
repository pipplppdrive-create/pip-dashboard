import { create } from 'zustand';
import { getDataService } from '@/services';
import type { Role, SessionInfo } from '@/services/types';
import { readCollection, writeCollection } from '@/services/local/storage';

const ACTOR_KEY = 'actorId';

interface SessionState {
  status: 'loading' | 'ready';
  session: SessionInfo | null;
  role: Role | null;
  /** Pegawai pelaku yang dipilih pada perangkat ini. */
  actorId: string | null;
  actorPickerOpen: boolean;
  init(): Promise<void>;
  refresh(): Promise<void>;
  /** Login terpadu — role ditentukan server setelah kredensial terverifikasi. */
  login(username: string, password: string): Promise<Role>;
  logout(): Promise<void>;
  setActor(id: string | null): void;
  openActorPicker(): void;
  closeActorPicker(): void;
  /** Dipanggil jembatan realtime saat ada sesi dicabut. */
  onSessionsChanged(revokedSessionId?: string): Promise<void>;
}

let initPromise: Promise<void> | null = null;

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'loading',
  session: null,
  role: null,
  actorId: readCollection<string | null>(ACTOR_KEY, null),
  actorPickerOpen: false,

  async init() {
    if (!initPromise) {
      initPromise = (async () => {
        const state = await getDataService().auth.getState();
        set({ session: state.session, role: state.role, status: 'ready' });
      })();
    }
    return initPromise;
  },

  async refresh() {
    const state = await getDataService().auth.getState();
    set({ session: state.session, role: state.role, status: 'ready' });
  },

  async login(username, password) {
    const session = await getDataService().auth.login(username, password);
    set({ session, role: session.role });
    return session.role;
  },

  async logout() {
    await getDataService().auth.logout();
    set({ session: null, role: null });
  },

  setActor(id) {
    writeCollection(ACTOR_KEY, id);
    set({ actorId: id, actorPickerOpen: false });
  },

  openActorPicker() {
    set({ actorPickerOpen: true });
  },

  closeActorPicker() {
    set({ actorPickerOpen: false });
  },

  async onSessionsChanged(revokedSessionId) {
    const current = get().session;
    if (!current) return;
    if (revokedSessionId && revokedSessionId !== current.id) return;
    // Sesi ini mungkin dicabut — verifikasi ulang ke service.
    const state = await getDataService().auth.getState();
    if (!state.session) {
      set({ session: null, role: null });
    }
  },
}));

/** Konteks pelaku untuk mutasi; null bila pegawai pelaku belum dipilih. */
export function getActorContext(): { employeeId: string } | null {
  const { actorId } = useSessionStore.getState();
  return actorId ? { employeeId: actorId } : null;
}
