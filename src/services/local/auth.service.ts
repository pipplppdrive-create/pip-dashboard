import { uid } from '@/lib/utils';
import { AuthError, ForbiddenError, NotFoundError, RateLimitError } from '@/services/errors';
import type { AuthService, AuthState, SessionInfo } from '@/services/types';
import { localBus } from './bus';
import { COL, db, ensureSeeded, hashPassword, nowISO, writeAudit, type LoginAttemptRecord } from './db';
import { deviceLabel, findCurrentSession, getCurrentSessionId, setCurrentSessionId } from './session-util';

const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60_000;
const LOCK_MS = 5 * 60_000;
const ADMIN_SESSION_DAYS = 7;
const HEARTBEAT_MS = 5 * 60_000;
const SESSION_CAP = 60;

function sessionExpired(session: SessionInfo, userSessionDays: number): boolean {
  const days = session.role === 'ADMIN' ? ADMIN_SESSION_DAYS : userSessionDays;
  const last = Date.parse(session.lastActiveAt);
  return Number.isFinite(last) && Date.now() - last > days * 86_400_000;
}

function checkRateLimit(account: string): void {
  const attempts = db.loginAttempts();
  const rec = attempts[account];
  if (rec?.lockedUntil && Date.now() < rec.lockedUntil) {
    const menit = Math.ceil((rec.lockedUntil - Date.now()) / 60_000);
    throw new RateLimitError(
      `Terlalu banyak percobaan gagal. Coba lagi dalam ${menit} menit.`,
    );
  }
}

function recordFail(account: string): void {
  const attempts = { ...db.loginAttempts() };
  const prev = attempts[account];
  const withinWindow = prev && Date.now() - prev.firstAt < FAIL_WINDOW_MS;
  const rec: LoginAttemptRecord = withinWindow
    ? { count: prev.count + 1, firstAt: prev.firstAt, lockedUntil: null }
    : { count: 1, firstAt: Date.now(), lockedUntil: null };
  if (rec.count >= MAX_FAILS) {
    rec.lockedUntil = Date.now() + LOCK_MS;
    rec.count = 0;
    rec.firstAt = Date.now();
  }
  attempts[account] = rec;
  db.write(COL.loginAttempts, attempts);
}

function clearFails(account: string): void {
  const attempts = { ...db.loginAttempts() };
  if (attempts[account]) {
    delete attempts[account];
    db.write(COL.loginAttempts, attempts);
  }
}

function createSession(role: SessionInfo['role'], account: string): SessionInfo {
  const session: SessionInfo = {
    id: uid('ses'),
    role,
    account,
    deviceLabel: deviceLabel(),
    createdAt: nowISO(),
    lastActiveAt: nowISO(),
    revokedAt: null,
  };
  const sessions = [session, ...db.sessions()].slice(0, SESSION_CAP);
  db.write(COL.sessions, sessions);
  setCurrentSessionId(session.id);
  localBus.emit({ topic: 'sessions' });
  return session;
}

export const localAuth: AuthService = {
  async getState(): Promise<AuthState> {
    await ensureSeeded();
    const session = findCurrentSession();
    if (!session) return { session: null, role: null };
    if (session.revokedAt) {
      setCurrentSessionId(null);
      return { session: null, role: null };
    }
    const settings = db.settings();
    if (settings && sessionExpired(session, settings.userSessionDays)) {
      setCurrentSessionId(null);
      return { session: null, role: null };
    }
    // Heartbeat (di-throttle): sesi persisten berbasis aktivitas terakhir.
    if (Date.now() - Date.parse(session.lastActiveAt) > HEARTBEAT_MS) {
      const sessions = db
        .sessions()
        .map((s) => (s.id === session.id ? { ...s, lastActiveAt: nowISO() } : s));
      db.write(COL.sessions, sessions);
    }
    return { session, role: session.role };
  },

  async loginUser(password: string): Promise<SessionInfo> {
    await ensureSeeded();
    const auth = db.auth();
    if (!auth) throw new AuthError('Penyimpanan lokal belum siap. Muat ulang halaman.');
    checkRateLimit(auth.userAccount);
    const hash = await hashPassword(password);
    if (hash !== auth.userPasswordHash) {
      recordFail(auth.userAccount);
      writeAudit({
        actorRole: 'USER',
        actorAccount: auth.userAccount,
        employeeId: null,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        entityLabel: 'Login User gagal',
        success: false,
        errorMessage: 'Password salah',
        deviceLabel: deviceLabel(),
      });
      throw new AuthError('Password tim salah. Periksa kembali.');
    }
    clearFails(auth.userAccount);
    const session = createSession('USER', auth.userAccount);
    writeAudit({
      actorRole: 'USER',
      actorAccount: auth.userAccount,
      employeeId: null,
      action: 'LOGIN',
      entityType: 'AUTH',
      entityLabel: 'Login User',
      sessionId: session.id,
      deviceLabel: session.deviceLabel,
    });
    return session;
  },

  async loginAdmin(username: string, password: string): Promise<SessionInfo> {
    await ensureSeeded();
    const auth = db.auth();
    if (!auth) throw new AuthError('Penyimpanan lokal belum siap. Muat ulang halaman.');
    checkRateLimit(`admin:${username.toLowerCase()}`);
    const hash = await hashPassword(password);
    const ok = username.trim().toLowerCase() === auth.adminUsername && hash === auth.adminPasswordHash;
    if (!ok) {
      recordFail(`admin:${username.toLowerCase()}`);
      writeAudit({
        actorRole: 'ADMIN',
        actorAccount: username,
        employeeId: null,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        entityLabel: 'Login Admin gagal',
        success: false,
        errorMessage: 'Kredensial salah',
        deviceLabel: deviceLabel(),
      });
      throw new AuthError('Username atau password Admin salah.');
    }
    clearFails(`admin:${username.toLowerCase()}`);
    const session = createSession('ADMIN', auth.adminUsername);
    writeAudit({
      actorRole: 'ADMIN',
      actorAccount: auth.adminUsername,
      employeeId: null,
      action: 'LOGIN',
      entityType: 'AUTH',
      entityLabel: 'Login Admin',
      sessionId: session.id,
      deviceLabel: session.deviceLabel,
    });
    return session;
  },

  async logout(): Promise<void> {
    await ensureSeeded();
    const session = findCurrentSession();
    setCurrentSessionId(null);
    if (session) {
      const sessions = db
        .sessions()
        .map((s) => (s.id === session.id ? { ...s, revokedAt: nowISO() } : s));
      db.write(COL.sessions, sessions);
      writeAudit({
        actorRole: session.role,
        actorAccount: session.account,
        employeeId: null,
        action: 'LOGOUT',
        entityType: 'AUTH',
        entityLabel: 'Logout',
        sessionId: session.id,
        deviceLabel: session.deviceLabel,
      });
      localBus.emit({ topic: 'sessions' });
    }
  },

  async listSessions(): Promise<SessionInfo[]> {
    await ensureSeeded();
    const current = findCurrentSession();
    if (current?.role !== 'ADMIN') {
      throw new ForbiddenError('Hanya Admin yang dapat melihat daftar sesi.');
    }
    return [...db.sessions()].sort(
      (a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt),
    );
  },

  async revokeSession(sessionId: string): Promise<void> {
    await ensureSeeded();
    const current = findCurrentSession();
    if (current?.role !== 'ADMIN') {
      throw new ForbiddenError('Hanya Admin yang dapat mencabut sesi.');
    }
    const sessions = db.sessions();
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) throw new NotFoundError('Sesi tidak ditemukan.');
    if (target.revokedAt) return;
    db.write(
      COL.sessions,
      sessions.map((s) => (s.id === sessionId ? { ...s, revokedAt: nowISO() } : s)),
    );
    if (getCurrentSessionId() === sessionId) {
      setCurrentSessionId(null);
    }
    writeAudit({
      actorRole: 'ADMIN',
      actorAccount: current.account,
      employeeId: null,
      action: 'REVOKE_SESSION',
      entityType: 'SESSION',
      entityId: sessionId,
      entityLabel: `Sesi ${target.role} · ${target.deviceLabel}`,
      sessionId: current.id,
      deviceLabel: current.deviceLabel,
    });
    localBus.emit({ topic: 'sessions', revokedSessionId: sessionId });
  },
};
