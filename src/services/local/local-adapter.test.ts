import { beforeEach, describe, expect, it } from 'vitest';
import {
  AuthError,
  ConflictError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from '@/services/errors';
import { localAdapter } from './adapter';
import { resetSeedMemo } from './db';
import { clearAllCollections } from './storage';

const svc = localAdapter;
const ACTOR = { employeeId: 'emp-hesti' };

async function loginUser() {
  return svc.auth.login('tim-pip', 'pip2026');
}
async function loginAdmin() {
  return svc.auth.login('admin', 'admin2026');
}

beforeEach(() => {
  clearAllCollections();
  resetSeedMemo();
});

describe('auth lokal', () => {
  it('login User dengan password benar membuat sesi persisten', async () => {
    const session = await loginUser();
    expect(session.role).toBe('USER');
    const state = await svc.auth.getState();
    expect(state.session?.id).toBe(session.id);
    expect(state.role).toBe('USER');
  });

  it('login User dengan password salah ditolak dan tercatat di audit', async () => {
    await expect(svc.auth.login('tim-pip', 'salah')).rejects.toBeInstanceOf(AuthError);
    await loginAdmin();
    const { entries } = await svc.audit.list({ action: 'LOGIN_FAILED' });
    expect(entries.length).toBeGreaterThan(0);
  });

  it('rate limiting: 5 kegagalan mengunci login', async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(svc.auth.login('tim-pip', 'salah')).rejects.toBeInstanceOf(AuthError);
    }
    await expect(svc.auth.login('tim-pip', 'pip2026')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('login terpadu: username menentukan role setelah kredensial terverifikasi', async () => {
    await expect(svc.auth.login('admin', 'salah')).rejects.toBeInstanceOf(AuthError);
    const admin = await loginAdmin();
    expect(admin.role).toBe('ADMIN');
    await svc.auth.logout();
    const user = await loginUser();
    expect(user.role).toBe('USER');
  });

  it('logout mengakhiri sesi', async () => {
    await loginUser();
    await svc.auth.logout();
    const state = await svc.auth.getState();
    expect(state.session).toBeNull();
  });

  it('Admin dapat mencabut sesi User; User tidak boleh mencabut', async () => {
    const userSession = await loginUser();
    await expect(svc.auth.revokeSession(userSession.id)).rejects.toBeInstanceOf(ForbiddenError);
    await loginAdmin();
    await svc.auth.revokeSession(userSession.id);
    const sessions = await svc.auth.listSessions();
    const revoked = sessions.find((s) => s.id === userSession.id);
    expect(revoked?.revokedAt).toBeTruthy();
  });

  it('User tidak dapat melihat daftar sesi maupun audit log', async () => {
    await loginUser();
    await expect(svc.auth.listSessions()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(svc.audit.list()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('pegawai pelaku (actor)', () => {
  it('mutasi tanpa pegawai pelaku valid ditolak', async () => {
    await loginUser();
    await expect(
      svc.tasks.create(
        { title: 'Uji', stepId: 'step-todo', durationType: 'JANGKA_PENDEK', priority: 'SEDANG' },
        { employeeId: 'tidak-ada' },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('pegawai nonaktif tidak dapat menjadi pelaku maupun PIC baru', async () => {
    await loginAdmin();
    await svc.employees.setActive('emp-ferry', false, { employeeId: 'emp-sucianingsih' });
    await svc.auth.logout();
    await loginUser();
    await expect(
      svc.tasks.create(
        { title: 'Uji', stepId: 'step-todo', durationType: 'JANGKA_PENDEK', priority: 'SEDANG' },
        { employeeId: 'emp-ferry' },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      svc.tasks.create(
        {
          title: 'Uji PIC',
          stepId: 'step-todo',
          durationType: 'JANGKA_PENDEK',
          priority: 'SEDANG',
          picMainId: 'emp-ferry',
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('konflik (optimistic concurrency)', () => {
  it('update dengan versi usang memicu ConflictError', async () => {
    await loginUser();
    const created = await svc.tasks.create(
      { title: 'Konflik', stepId: 'step-todo', durationType: 'JANGKA_PENDEK', priority: 'SEDANG' },
      ACTOR,
    );
    await svc.tasks.update(created.id, { title: 'Versi A' }, created.version, ACTOR);
    await expect(
      svc.tasks.update(created.id, { title: 'Versi B' }, created.version, ACTOR),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('pengamanan step', () => {
  it('step berisi kartu tidak dapat dihapus tanpa step tujuan', async () => {
    await loginUser();
    await expect(
      svc.board.deleteStep('step-onprogress', {}, ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('hapus step dengan tujuan memindahkan seluruh kartu (tidak ada yang hilang)', async () => {
    await loginUser();
    const before = await svc.tasks.list({ includeArchived: true });
    const moving = before.filter((t) => t.stepId === 'step-onprogress');
    expect(moving.length).toBeGreaterThan(0);
    await svc.board.deleteStep('step-onprogress', { moveCardsToStepId: 'step-todo' }, ACTOR);
    const after = await svc.tasks.list({ includeArchived: true });
    expect(after.length).toBe(before.length);
    expect(after.filter((t) => t.stepId === 'step-onprogress')).toHaveLength(0);
    const steps = await svc.board.listSteps();
    expect(steps.find((s) => s.id === 'step-onprogress')).toBeUndefined();
    const deletedSteps = await svc.board.listSteps({ includeDeleted: true });
    expect(deletedSteps.find((s) => s.id === 'step-onprogress')?.deletedAt).toBeTruthy();
  });

  it('step kosong terhapus sebagai soft delete', async () => {
    await loginUser();
    const created = await svc.board.createStep({ name: 'Step Uji' }, ACTOR);
    await svc.board.deleteStep(created.id, {}, ACTOR);
    const steps = await svc.board.listSteps({ includeDeleted: true });
    expect(steps.find((s) => s.id === created.id)?.deletedAt).toBeTruthy();
  });
});

describe('hak akses role', () => {
  it('User tidak dapat menghapus permanen', async () => {
    await loginUser();
    const task = (await svc.tasks.list())[0];
    expect(task).toBeDefined();
    await expect(svc.tasks.permanentDelete(task!.id, ACTOR)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('User tidak dapat mengelola master pegawai / pengaturan / penyaluran', async () => {
    await loginUser();
    await expect(
      svc.employees.create(
        {
          fullName: 'Baru',
          displayName: 'Baru',
          initials: 'BR',
          color: 'blue',
          position: 'Staf',
          team: 'Tim',
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(svc.settings.update({ appName: 'X' }, 1, ACTOR)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      svc.distribution.createDraft({ year: 2026, period: 'Termin 2', rows: [] }, ACTOR),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('Admin dapat menghapus permanen pekerjaan terhapus', async () => {
    await loginAdmin();
    const deleted = (await svc.tasks.list({ includeDeleted: true })).find((t) => t.deletedAt);
    expect(deleted).toBeDefined();
    await svc.tasks.permanentDelete(deleted!.id, { employeeId: 'emp-sucianingsih' });
    const after = await svc.tasks.list({ includeDeleted: true });
    expect(after.find((t) => t.id === deleted!.id)).toBeUndefined();
  });
});

describe('password User', () => {
  it('Admin mengganti password User; password baru berlaku', async () => {
    await loginAdmin();
    await svc.settings.changeUserPassword('passwordBaru123', { employeeId: 'emp-sucianingsih' });
    await svc.auth.logout();
    await expect(svc.auth.login('tim-pip', 'pip2026')).rejects.toBeInstanceOf(AuthError);
    const session = await svc.auth.login('tim-pip', 'passwordBaru123');
    expect(session.role).toBe('USER');
  });
});
