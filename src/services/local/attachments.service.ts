import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { fileExtension, sanitizeFileName, uid } from '@/lib/utils';
import { NotFoundError, StorageError, ValidationError } from '@/services/errors';
import type { Attachment, AttachmentService } from '@/services/types';
import { localBus } from './bus';
import { COL, db, ensureSeeded, nowISO, writeAudit } from './db';
import { requireActor, requireSession } from './guard-util';

/** Ekstensi executable yang selalu ditolak. */
const BLOCKED_EXT = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif', 'sh', 'ps1', 'psm1',
  'js', 'mjs', 'vbs', 'vbe', 'wsf', 'jar', 'apk', 'app', 'dll', 'so', 'dylib',
]);

const idbKey = (id: string) => `att-blob:${id}`;

function auditBase(employeeId: string) {
  const session = requireSession();
  return {
    actorRole: session.role,
    actorAccount: session.account,
    employeeId,
    sessionId: session.id,
    deviceLabel: session.deviceLabel,
  } as const;
}

export const localAttachments: AttachmentService = {
  async list(taskId): Promise<Attachment[]> {
    await ensureSeeded();
    requireSession();
    return db
      .attachments()
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  async upload(taskId, file, ctx): Promise<Attachment> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const task = db.tasks().find((t) => t.id === taskId);
    if (!task) throw new NotFoundError('Pekerjaan tidak ditemukan.');

    const settings = db.settings();
    const maxBytes = (settings?.attachmentMaxMB ?? 10) * 1024 * 1024;
    const allowed = settings?.attachmentAllowedExt ?? [];
    const name = sanitizeFileName(file.name);
    const ext = fileExtension(name);

    if (BLOCKED_EXT.has(ext)) {
      throw new ValidationError('Berkas executable tidak diizinkan.');
    }
    if (!ext || !allowed.includes(ext)) {
      throw new ValidationError(
        `Tipe berkas .${ext || '?'} tidak diizinkan. Tipe yang diperbolehkan: ${allowed.map((e) => `.${e}`).join(', ')}.`,
      );
    }
    if (file.size <= 0) throw new ValidationError('Berkas kosong tidak dapat diunggah.');
    if (file.size > maxBytes) {
      throw new ValidationError(
        `Ukuran berkas melebihi batas ${settings?.attachmentMaxMB ?? 10} MB.`,
      );
    }

    const attachment: Attachment = {
      id: uid('att'),
      taskId,
      fileName: name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      uploadedByEmployeeId: employeeId,
      createdAt: nowISO(),
    };
    try {
      await idbSet(idbKey(attachment.id), file);
    } catch {
      throw new StorageError('Gagal menyimpan berkas di penyimpanan lokal.');
    }
    db.write(COL.attachments, [...db.attachments(), attachment]);
    localBus.emit({ topic: 'attachments', entityId: taskId });
    writeAudit({
      ...auditBase(employeeId),
      action: 'CREATE',
      entityType: 'ATTACHMENT',
      entityId: taskId,
      entityLabel: `Lampiran "${name}" pada "${task.title}"`,
      after: { fileName: name, size: file.size, mimeType: attachment.mimeType },
    });
    return attachment;
  },

  async getDownloadUrl(id): Promise<string> {
    await ensureSeeded();
    requireSession();
    const meta = db.attachments().find((a) => a.id === id);
    if (!meta) throw new NotFoundError('Lampiran tidak ditemukan.');
    const blob = await idbGet<Blob>(idbKey(id));
    if (!blob) throw new NotFoundError('Berkas lampiran tidak ditemukan di perangkat ini.');
    return URL.createObjectURL(blob);
  },

  async remove(id, ctx): Promise<void> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const meta = db.attachments().find((a) => a.id === id);
    if (!meta) return;
    await idbDel(idbKey(id)).catch(() => undefined);
    db.write(
      COL.attachments,
      db.attachments().filter((a) => a.id !== id),
    );
    localBus.emit({ topic: 'attachments', entityId: meta.taskId });
    writeAudit({
      ...auditBase(employeeId),
      action: 'PERMANENT_DELETE',
      entityType: 'ATTACHMENT',
      entityId: meta.taskId,
      entityLabel: `Lampiran "${meta.fileName}" dihapus`,
      before: { fileName: meta.fileName },
    });
  },
};
