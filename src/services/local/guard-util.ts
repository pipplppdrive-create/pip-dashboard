import { AuthError, ForbiddenError, ValidationError } from '@/services/errors';
import type { ActorContext, SessionInfo } from '@/services/types';
import { db } from './db';
import { findCurrentSession } from './session-util';

/** Sesi valid wajib ada untuk setiap operasi data. */
export function requireSession(): SessionInfo {
  const session = findCurrentSession();
  if (!session || session.revokedAt) {
    throw new AuthError('Sesi Anda berakhir. Silakan masuk kembali.');
  }
  return session;
}

/** Operasi khusus Admin (mencerminkan penegakan server-side di produksi). */
export function requireAdmin(): SessionInfo {
  const session = requireSession();
  if (session.role !== 'ADMIN') {
    throw new ForbiddenError('Tindakan ini hanya dapat dilakukan Admin.');
  }
  return session;
}

/** Pegawai pelaku wajib valid & aktif (dipilih dari master pegawai). */
export function requireActor(ctx: ActorContext): string {
  const employee = db.employees().find((e) => e.id === ctx.employeeId);
  if (!employee) {
    throw new ValidationError('Pegawai pelaku tidak ditemukan. Pilih pegawai pelaku Anda.');
  }
  if (!employee.active) {
    throw new ValidationError('Pegawai pelaku nonaktif tidak dapat melakukan perubahan.');
  }
  return employee.id;
}
