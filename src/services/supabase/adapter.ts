/**
 * Adapter PRODUKSI — Supabase (Postgres + RLS + Realtime + Storage + Auth).
 *
 * Kontrak identik dengan adapter lokal (DataService). Role & izin ditegakkan
 * server-side lewat RLS (lihat supabase/migrations); pemeriksaan role di file
 * ini hanya untuk umpan balik cepat di UI.
 *
 * CATATAN: adapter ini lengkap tetapi BELUM TERUJI terhadap project Supabase
 * nyata karena kredensial belum tersedia — lihat DEPLOYMENT.md.
 */
import { fileExtension, sanitizeFileName, uid } from '@/lib/utils';
import {
  AppError,
  AuthError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  StorageError,
  ValidationError,
} from '@/services/errors';
import { validateRows, validateScope } from '@/services/distribution-validation';
import { readCollection, writeCollection } from '@/services/local/storage';
import type {
  ActorContext,
  AppSettings,
  AuditEntry,
  AuthState,
  BackupPayload,
  ChangeEvent,
  ChangeTopic,
  DataService,
  Role,
  SessionInfo,
  Step,
  Task,
  TaskPatch,
} from '@/services/types';
import { toActivityEvent } from '@/services/local/audit.service';
import { authEmailDomain, getSupabase, userAccountEmail } from './client';
import {
  toAttachment,
  toAudit,
  toBoard,
  toComment,
  toEmployee,
  toSession,
  toSettings,
  toSnapshot,
  toStep,
  toTask,
  toTaxonomy,
  toTemplate,
  type AttachmentRow,
  type AuditRow,
  type BoardRow,
  type CommentRow,
  type EmployeeRow,
  type SessionRow,
  type SettingsRow,
  type SnapshotRow,
  type StepRow,
  type TaskRow,
  type TaxonomyRow,
  type TemplateRow,
} from './rows';

// ---------------------------------------------------------------------------
// Util umum
// ---------------------------------------------------------------------------

const SESSION_KEY = 'supabaseDeviceSessionId';
const nowISO = () => new Date().toISOString();

interface PgError {
  message?: string;
  code?: string;
}

/** Petakan error Supabase/Postgres ke AppError berpesan Indonesia. */
function wrap(err: PgError | null, fallback: string): never {
  const msg = err?.message ?? fallback;
  if (msg.includes('FORBIDDEN')) throw new ForbiddenError();
  if (msg.includes('NOT_FOUND')) throw new NotFoundError();
  if (msg.includes('VALIDATION:')) {
    throw new ValidationError(msg.split('VALIDATION:')[1]?.trim() ?? fallback);
  }
  if (err?.code === '23505') {
    throw new ValidationError('Data duplikat — periksa kembali isian Anda.');
  }
  if (err?.code === '42501') throw new ForbiddenError();
  throw new AppError('UNAVAILABLE', `${fallback}: ${msg}`);
}

let cachedRole: { userId: string; role: Role; account: string } | null = null;

async function fetchRole(): Promise<{ role: Role; account: string } | null> {
  const sb = getSupabase();
  const { data: authData } = await sb.auth.getUser();
  const user = authData.user;
  if (!user) return null;
  if (cachedRole && cachedRole.userId === user.id) {
    return { role: cachedRole.role, account: cachedRole.account };
  }
  const { data, error } = await sb
    .from('account_roles')
    .select('role, account_label')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !data) return null;
  cachedRole = { userId: user.id, role: data.role as Role, account: data.account_label as string };
  return { role: cachedRole.role, account: cachedRole.account };
}

async function requireRole(): Promise<{ role: Role; account: string }> {
  const info = await fetchRole();
  if (!info) throw new AuthError('Sesi Anda berakhir. Silakan masuk kembali.');
  return info;
}

async function requireAdmin(): Promise<{ role: Role; account: string }> {
  const info = await requireRole();
  if (info.role !== 'ADMIN') {
    throw new ForbiddenError('Tindakan ini hanya dapat dilakukan Admin.');
  }
  return info;
}

function deviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Perangkat';
  return `${browser} · ${os}`;
}

/** Tulis audit (best-effort; kegagalan audit tidak menggagalkan operasi utama). */
async function auditWrite(entry: {
  action: AuditEntry['action'];
  entityType: AuditEntry['entityType'];
  entityId?: string | null;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
  employeeId?: string | null;
  success?: boolean;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    const info = await fetchRole();
    if (!info) return;
    await getSupabase()
      .from('audit_log')
      .insert({
        actor_role: info.role,
        actor_account: info.account,
        employee_id: entry.employeeId ?? null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        entity_label: entry.entityLabel ?? null,
        before: entry.before ?? null,
        after: entry.after ?? null,
        success: entry.success ?? true,
        error_message: entry.errorMessage ?? null,
        session_id: readCollection<string | null>(SESSION_KEY, null),
        device_label: deviceLabel(),
      });
  } catch {
    // audit best-effort
  }
}

/** Pegawai pelaku wajib valid & aktif. */
async function assertActor(ctx: ActorContext): Promise<string> {
  const { data, error } = await getSupabase()
    .from('employees')
    .select('id, active')
    .eq('id', ctx.employeeId)
    .maybeSingle();
  if (error) wrap(error, 'Gagal memeriksa pegawai pelaku');
  if (!data) throw new ValidationError('Pegawai pelaku tidak ditemukan. Pilih pegawai pelaku Anda.');
  if (!data.active) throw new ValidationError('Pegawai pelaku nonaktif tidak dapat melakukan perubahan.');
  return ctx.employeeId;
}

async function createDeviceSession(role: Role, account: string): Promise<SessionInfo> {
  const sb = getSupabase();
  const { data: authData } = await sb.auth.getUser();
  const { data, error } = await sb
    .from('device_sessions')
    .insert({
      user_id: authData.user!.id,
      role,
      account,
      device_label: deviceLabel(),
    })
    .select()
    .single();
  if (error || !data) wrap(error, 'Gagal mencatat sesi perangkat');
  writeCollection(SESSION_KEY, (data as SessionRow).id);
  return toSession(data as SessionRow);
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const supabaseAdapter: DataService = {
  mode: 'supabase',

  // ------------------------------------------------------------------ auth
  auth: {
    async getState(): Promise<AuthState> {
      const sb = getSupabase();
      const { data } = await sb.auth.getSession();
      if (!data.session) return { session: null, role: null };
      const info = await fetchRole();
      if (!info) {
        await sb.auth.signOut();
        return { session: null, role: null };
      }
      const sessionId = readCollection<string | null>(SESSION_KEY, null);
      let session: SessionInfo | null = null;
      if (sessionId) {
        const { data: row } = await sb
          .from('device_sessions')
          .select()
          .eq('id', sessionId)
          .maybeSingle();
        if (row) session = toSession(row as SessionRow);
      }
      if (!session) {
        session = await createDeviceSession(info.role, info.account);
      }
      if (session.revokedAt) {
        writeCollection(SESSION_KEY, null);
        await sb.auth.signOut();
        cachedRole = null;
        return { session: null, role: null };
      }
      // Heartbeat (throttle 5 menit)
      if (Date.now() - Date.parse(session.lastActiveAt) > 5 * 60_000) {
        await sb
          .from('device_sessions')
          .update({ last_active_at: nowISO() })
          .eq('id', session.id);
      }
      return { session, role: info.role };
    },

    async loginUser(password: string): Promise<SessionInfo> {
      const sb = getSupabase();
      const { error } = await sb.auth.signInWithPassword({
        email: userAccountEmail(),
        password,
      });
      if (error) {
        throw new AuthError(
          error.message.includes('rate') ? 'Terlalu banyak percobaan. Coba lagi nanti.' : 'Password tim salah. Periksa kembali.',
        );
      }
      cachedRole = null;
      const info = await requireRole();
      const session = await createDeviceSession(info.role, info.account);
      await auditWrite({ action: 'LOGIN', entityType: 'AUTH', entityLabel: 'Login User' });
      return session;
    },

    async loginAdmin(username: string, password: string): Promise<SessionInfo> {
      const sb = getSupabase();
      const email = username.includes('@') ? username : `${username}@${authEmailDomain()}`;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new AuthError('Username atau password Admin salah.');
      cachedRole = null;
      const info = await requireRole();
      if (info.role !== 'ADMIN') {
        await sb.auth.signOut();
        throw new AuthError('Akun ini bukan akun Admin.');
      }
      const session = await createDeviceSession(info.role, info.account);
      await auditWrite({ action: 'LOGIN', entityType: 'AUTH', entityLabel: 'Login Admin' });
      return session;
    },

    async logout(): Promise<void> {
      const sb = getSupabase();
      const sessionId = readCollection<string | null>(SESSION_KEY, null);
      await auditWrite({ action: 'LOGOUT', entityType: 'AUTH', entityLabel: 'Logout' });
      if (sessionId) {
        await sb.from('device_sessions').update({ revoked_at: nowISO() }).eq('id', sessionId);
        writeCollection(SESSION_KEY, null);
      }
      await sb.auth.signOut();
      cachedRole = null;
    },

    async listSessions(): Promise<SessionInfo[]> {
      await requireAdmin();
      const { data, error } = await getSupabase()
        .from('device_sessions')
        .select()
        .order('last_active_at', { ascending: false })
        .limit(100);
      if (error) wrap(error, 'Gagal memuat sesi');
      return ((data ?? []) as SessionRow[]).map(toSession);
    },

    async revokeSession(sessionId: string): Promise<void> {
      await requireAdmin();
      const { error } = await getSupabase()
        .from('device_sessions')
        .update({ revoked_at: nowISO() })
        .eq('id', sessionId);
      if (error) wrap(error, 'Gagal mencabut sesi');
      await auditWrite({
        action: 'REVOKE_SESSION',
        entityType: 'SESSION',
        entityId: sessionId,
        entityLabel: 'Sesi dicabut Admin',
      });
    },
  },

  // ------------------------------------------------------------- employees
  employees: {
    async list(opts) {
      await requireRole();
      let q = getSupabase().from('employees').select().order('sort_order');
      if (!opts?.includeInactive) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) wrap(error, 'Gagal memuat pegawai');
      return ((data ?? []) as EmployeeRow[]).map(toEmployee);
    },
    async create(input, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      const { data, error } = await getSupabase()
        .from('employees')
        .insert({
          full_name: input.fullName.trim(),
          display_name: input.displayName.trim(),
          initials: input.initials.trim().toUpperCase(),
          color: input.color,
          position: input.position.trim(),
          team: input.team.trim(),
          sort_order: input.sortOrder ?? 999,
          active: input.active ?? true,
        })
        .select()
        .single();
      if (error || !data) wrap(error, 'Gagal menambah pegawai');
      const emp = toEmployee(data as EmployeeRow);
      await auditWrite({
        action: 'CREATE',
        entityType: 'EMPLOYEE',
        entityId: emp.id,
        entityLabel: emp.fullName,
        employeeId,
        after: { fullName: emp.fullName, position: emp.position },
      });
      return emp;
    },
    async update(id, patch, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      const row: Record<string, unknown> = { updated_at: nowISO() };
      if (patch.fullName !== undefined) row.full_name = patch.fullName.trim();
      if (patch.displayName !== undefined) row.display_name = patch.displayName.trim();
      if (patch.initials !== undefined) row.initials = patch.initials.trim().toUpperCase();
      if (patch.color !== undefined) row.color = patch.color;
      if (patch.position !== undefined) row.position = patch.position.trim();
      if (patch.team !== undefined) row.team = patch.team.trim();
      if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
      if (patch.active !== undefined) row.active = patch.active;
      const { data, error } = await getSupabase()
        .from('employees')
        .update(row)
        .eq('id', id)
        .select()
        .single();
      if (error || !data) wrap(error, 'Gagal memperbarui pegawai');
      const emp = toEmployee(data as EmployeeRow);
      await auditWrite({
        action: 'UPDATE',
        entityType: 'EMPLOYEE',
        entityId: id,
        entityLabel: emp.fullName,
        employeeId,
        after: patch,
      });
      return emp;
    },
    async setActive(id, active, ctx) {
      return supabaseAdapter.employees.update(id, { active }, ctx);
    },
    async reorder(orderedIds, ctx) {
      await requireAdmin();
      await assertActor(ctx);
      const sb = getSupabase();
      await Promise.all(
        orderedIds.map((id, i) => sb.from('employees').update({ sort_order: i }).eq('id', id)),
      );
    },
  },

  // ----------------------------------------------------------------- board
  board: {
    async get() {
      await requireRole();
      const { data, error } = await getSupabase()
        .from('board')
        .select()
        .eq('id', 'board-utama')
        .single();
      if (error || !data) wrap(error, 'Gagal memuat board');
      return toBoard(data as BoardRow);
    },
    async rename(title, expectedVersion, ctx) {
      await requireRole();
      const employeeId = await assertActor(ctx);
      const trimmed = title.trim();
      if (!trimmed) throw new ValidationError('Judul board tidak boleh kosong.');
      const { data, error } = await getSupabase()
        .from('board')
        .update({ title: trimmed, updated_at: nowISO(), version: expectedVersion + 1 })
        .eq('id', 'board-utama')
        .eq('version', expectedVersion)
        .select();
      if (error) wrap(error, 'Gagal mengubah judul board');
      const row = (data as BoardRow[] | null)?.[0];
      if (!row) throw new ConflictError();
      await auditWrite({
        action: 'UPDATE',
        entityType: 'BOARD',
        entityId: 'board-utama',
        entityLabel: trimmed,
        employeeId,
        after: { title: trimmed },
      });
      return toBoard(row);
    },
    async listSteps(opts) {
      await requireRole();
      let q = getSupabase().from('steps').select().order('sort_order');
      if (!opts?.includeDeleted) q = q.is('deleted_at', null);
      const { data, error } = await q;
      if (error) wrap(error, 'Gagal memuat step');
      return ((data ?? []) as StepRow[]).map(toStep);
    },
    async createStep(input, ctx) {
      await requireRole();
      const employeeId = await assertActor(ctx);
      const name = input.name.trim();
      if (!name) throw new ValidationError('Nama step tidak boleh kosong.');
      const { data, error } = await getSupabase()
        .from('steps')
        .insert({
          board_id: 'board-utama',
          name,
          kind: input.kind ?? 'NORMAL',
          color: input.color ?? '#94a3b8',
          sort_order: 999,
        })
        .select()
        .single();
      if (error || !data) wrap(error, 'Gagal menambah step');
      const step = toStep(data as StepRow);
      await auditWrite({
        action: 'CREATE',
        entityType: 'STEP',
        entityId: step.id,
        entityLabel: name,
        employeeId,
      });
      return step;
    },
    async updateStep(id, patch, expectedVersion, ctx) {
      await requireRole();
      const employeeId = await assertActor(ctx);
      const row: Record<string, unknown> = { version: expectedVersion + 1 };
      if (patch.name !== undefined) row.name = patch.name.trim();
      if (patch.kind !== undefined) row.kind = patch.kind;
      if (patch.color !== undefined) row.color = patch.color;
      const { data, error } = await getSupabase()
        .from('steps')
        .update(row)
        .eq('id', id)
        .eq('version', expectedVersion)
        .select();
      if (error) wrap(error, 'Gagal memperbarui step');
      const updated = (data as StepRow[] | null)?.[0];
      if (!updated) throw new ConflictError();
      const step = toStep(updated);
      await auditWrite({
        action: 'UPDATE',
        entityType: 'STEP',
        entityId: id,
        entityLabel: step.name,
        employeeId,
        after: patch,
      });
      return step;
    },
    async reorderSteps(orderedIds, ctx) {
      await requireRole();
      await assertActor(ctx);
      const sb = getSupabase();
      await Promise.all(
        orderedIds.map((id, i) => sb.from('steps').update({ sort_order: i }).eq('id', id)),
      );
    },
    async deleteStep(id, opts, ctx) {
      await requireRole();
      const employeeId = await assertActor(ctx);
      const { error } = await getSupabase().rpc('delete_step_safe', {
        p_step_id: id,
        p_move_to: opts.moveCardsToStepId ?? null,
      });
      if (error) wrap(error, 'Gagal menghapus step');
      await auditWrite({
        action: 'SOFT_DELETE',
        entityType: 'STEP',
        entityId: id,
        entityLabel: 'Step dihapus (soft delete)',
        employeeId,
        after: opts.moveCardsToStepId ? { moveCardsTo: opts.moveCardsToStepId } : null,
      });
    },
    async restoreStep(id, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      const { data, error } = await getSupabase()
        .from('steps')
        .update({ deleted_at: null, sort_order: 999 })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) wrap(error, 'Gagal memulihkan step');
      const step = toStep(data as StepRow);
      await auditWrite({
        action: 'RESTORE',
        entityType: 'STEP',
        entityId: id,
        entityLabel: step.name,
        employeeId,
      });
      return step;
    },
  },

  // ----------------------------------------------------------------- tasks
  tasks: {
    async list(opts) {
      await requireRole();
      let q = getSupabase().from('tasks').select().order('sort_order');
      if (!opts?.includeDeleted) q = q.is('deleted_at', null);
      if (!opts?.includeArchived) q = q.is('archived_at', null);
      const { data, error } = await q;
      if (error) wrap(error, 'Gagal memuat pekerjaan');
      return ((data ?? []) as TaskRow[]).map(toTask);
    },
    async get(id) {
      await requireRole();
      const { data, error } = await getSupabase().from('tasks').select().eq('id', id).maybeSingle();
      if (error) wrap(error, 'Gagal memuat pekerjaan');
      if (!data) throw new NotFoundError();
      return toTask(data as TaskRow);
    },
    async create(input, ctx) {
      await requireRole();
      const employeeId = await assertActor(ctx);
      const title = input.title.trim();
      if (!title) throw new ValidationError('Judul pekerjaan tidak boleh kosong.');
      const { data, error } = await getSupabase()
        .from('tasks')
        .insert({
          board_id: 'board-utama',
          step_id: input.stepId,
          title,
          description: input.description ?? '',
          duration_type: input.durationType,
          category_id: input.categoryId ?? null,
          label_ids: input.labelIds ?? [],
          priority: input.priority,
          start_date: input.startDate ?? null,
          due_date: input.dueDate ?? null,
          progress_mode: input.progressMode ?? 'MANUAL',
          manual_progress: input.manualProgress ?? 0,
          pic_main_id: input.picMainId ?? null,
          pic_ids: (input.picIds ?? []).filter((p) => p !== input.picMainId),
          checklist: input.checklist ?? [],
          is_focus: input.isFocus ?? false,
          sort_order: 9999,
          created_by_employee_id: employeeId,
          updated_by_employee_id: employeeId,
        })
        .select()
        .single();
      if (error || !data) wrap(error, 'Gagal membuat pekerjaan');
      const task = toTask(data as TaskRow);
      await auditWrite({
        action: 'CREATE',
        entityType: 'TASK',
        entityId: task.id,
        entityLabel: title,
        employeeId,
        after: { stepId: task.stepId, priority: task.priority },
      });
      return task;
    },
    async update(id, patch: TaskPatch, expectedVersion, ctx) {
      await requireRole();
      const employeeId = await assertActor(ctx);
      const row: Record<string, unknown> = {
        updated_at: nowISO(),
        updated_by_employee_id: employeeId,
        version: expectedVersion + 1,
      };
      if (patch.title !== undefined) row.title = patch.title.trim();
      if (patch.description !== undefined) row.description = patch.description;
      if (patch.durationType !== undefined) row.duration_type = patch.durationType;
      if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
      if (patch.labelIds !== undefined) row.label_ids = patch.labelIds;
      if (patch.priority !== undefined) row.priority = patch.priority;
      if (patch.startDate !== undefined) row.start_date = patch.startDate;
      if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
      if (patch.progressMode !== undefined) row.progress_mode = patch.progressMode;
      if (patch.manualProgress !== undefined) row.manual_progress = patch.manualProgress;
      if (patch.picMainId !== undefined) row.pic_main_id = patch.picMainId;
      if (patch.picIds !== undefined) row.pic_ids = patch.picIds;
      if (patch.checklist !== undefined) row.checklist = patch.checklist;
      if (patch.isFocus !== undefined) row.is_focus = patch.isFocus;
      const { data, error } = await getSupabase()
        .from('tasks')
        .update(row)
        .eq('id', id)
        .eq('version', expectedVersion)
        .select();
      if (error) wrap(error, 'Gagal memperbarui pekerjaan');
      const updated = (data as TaskRow[] | null)?.[0];
      if (!updated) throw new ConflictError();
      const task = toTask(updated);
      await auditWrite({
        action: 'UPDATE',
        entityType: 'TASK',
        entityId: id,
        entityLabel: task.title,
        employeeId,
        after: patch,
      });
      return task;
    },
    async move(id, to, ctx) {
      await requireRole();
      const employeeId = await assertActor(ctx);
      const before = await supabaseAdapter.tasks.get(id);
      const { data, error } = await getSupabase().rpc('move_task', {
        p_task_id: id,
        p_step_id: to.stepId,
        p_index: to.index,
      });
      if (error) wrap(error, 'Gagal memindahkan kartu');
      const task = toTask(data as TaskRow);
      if (before.stepId !== to.stepId) {
        const steps = await supabaseAdapter.board.listSteps({ includeDeleted: true });
        const fromStep = steps.find((s: Step) => s.id === before.stepId);
        const toStepRow = steps.find((s: Step) => s.id === to.stepId);
        await auditWrite({
          action: 'MOVE',
          entityType: 'TASK',
          entityId: id,
          entityLabel: task.title,
          employeeId,
          before: { step: fromStep?.name ?? '?' },
          after: { step: toStepRow?.name ?? '?', stepKind: toStepRow?.kind },
        });
      }
      return task;
    },
    async archive(id, ctx) {
      return setTaskFlag(id, { archived_at: nowISO() }, 'ARCHIVE', ctx);
    },
    async unarchive(id, ctx) {
      return setTaskFlag(id, { archived_at: null }, 'UNARCHIVE', ctx);
    },
    async softDelete(id, reason, ctx) {
      const trimmed = reason.trim();
      if (!trimmed) throw new ValidationError('Alasan penghapusan wajib diisi.');
      await setTaskFlag(id, { deleted_at: nowISO(), delete_reason: trimmed }, 'SOFT_DELETE', ctx);
    },
    async restore(id, ctx) {
      await requireAdmin();
      return setTaskFlag(id, { deleted_at: null, delete_reason: null }, 'RESTORE', ctx);
    },
    async permanentDelete(id, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      const task = await supabaseAdapter.tasks.get(id);
      // Hapus berkas lampiran di storage lebih dulu.
      const attachments = await supabaseAdapter.attachments.list(id);
      const sb = getSupabase();
      if (attachments.length > 0) {
        const { data: rows } = await sb.from('attachments').select('storage_path').eq('task_id', id);
        const paths = ((rows ?? []) as Array<{ storage_path: string }>).map((r) => r.storage_path);
        if (paths.length > 0) await sb.storage.from('lampiran').remove(paths);
      }
      const { error } = await sb.from('tasks').delete().eq('id', id);
      if (error) wrap(error, 'Gagal menghapus permanen');
      await auditWrite({
        action: 'PERMANENT_DELETE',
        entityType: 'TASK',
        entityId: id,
        entityLabel: task.title,
        employeeId,
      });
    },
    async listComments(taskId) {
      await requireRole();
      const { data, error } = await getSupabase()
        .from('task_comments')
        .select()
        .eq('task_id', taskId)
        .order('created_at');
      if (error) wrap(error, 'Gagal memuat catatan');
      return ((data ?? []) as CommentRow[]).map(toComment);
    },
    async listAllComments() {
      await requireRole();
      const { data, error } = await getSupabase()
        .from('task_comments')
        .select()
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) wrap(error, 'Gagal memuat catatan');
      return ((data ?? []) as CommentRow[]).map(toComment);
    },
    async addComment(taskId, type, text, ctx) {
      await requireRole();
      const employeeId = await assertActor(ctx);
      const trimmed = text.trim();
      if (!trimmed) throw new ValidationError('Isi catatan tidak boleh kosong.');
      const { data, error } = await getSupabase()
        .from('task_comments')
        .insert({ task_id: taskId, type, text: trimmed, employee_id: employeeId })
        .select()
        .single();
      if (error || !data) wrap(error, 'Gagal menambah catatan');
      await auditWrite({
        action: 'CREATE',
        entityType: 'COMMENT',
        entityId: taskId,
        entityLabel: `Catatan (${type}) ditambahkan`,
        employeeId,
        after: { type, text: trimmed.slice(0, 200) },
      });
      return toComment(data as CommentRow);
    },
    async history(taskId) {
      await requireRole();
      const { data, error } = await getSupabase()
        .from('audit_log')
        .select()
        .eq('entity_id', taskId)
        .order('at', { ascending: false })
        .limit(200);
      // Catatan: RLS membatasi baca audit ke Admin; untuk riwayat per-kartu,
      // policy tambahan dapat dibuka bila dibutuhkan User (lihat DEPLOYMENT.md).
      if (error) return [];
      return ((data ?? []) as AuditRow[]).map(toAudit);
    },
  },

  // ----------------------------------------------------------- attachments
  attachments: {
    async list(taskId) {
      await requireRole();
      const { data, error } = await getSupabase()
        .from('attachments')
        .select()
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) wrap(error, 'Gagal memuat lampiran');
      return ((data ?? []) as AttachmentRow[]).map(toAttachment);
    },
    async upload(taskId, file, ctx) {
      await requireRole();
      const employeeId = await assertActor(ctx);
      const settings = await supabaseAdapter.settings.get();
      const name = sanitizeFileName(file.name);
      const ext = fileExtension(name);
      const BLOCKED = new Set(['exe','bat','cmd','com','msi','scr','pif','sh','ps1','psm1','js','mjs','vbs','vbe','wsf','jar','apk','app','dll','so','dylib']);
      if (BLOCKED.has(ext)) throw new ValidationError('Berkas executable tidak diizinkan.');
      if (!ext || !settings.attachmentAllowedExt.includes(ext)) {
        throw new ValidationError(`Tipe berkas .${ext || '?'} tidak diizinkan.`);
      }
      if (file.size <= 0 || file.size > settings.attachmentMaxMB * 1024 * 1024) {
        throw new ValidationError(`Ukuran berkas melebihi batas ${settings.attachmentMaxMB} MB.`);
      }
      const id = uid('att');
      const path = `${taskId}/${id}-${name}`;
      const sb = getSupabase();
      const { error: upErr } = await sb.storage.from('lampiran').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (upErr) throw new StorageError(`Unggah gagal: ${upErr.message}`);
      const { data, error } = await sb
        .from('attachments')
        .insert({
          task_id: taskId,
          file_name: name,
          size: file.size,
          mime_type: file.type || 'application/octet-stream',
          storage_path: path,
          uploaded_by_employee_id: employeeId,
        })
        .select()
        .single();
      if (error || !data) {
        await sb.storage.from('lampiran').remove([path]);
        wrap(error, 'Gagal menyimpan metadata lampiran');
      }
      await auditWrite({
        action: 'CREATE',
        entityType: 'ATTACHMENT',
        entityId: taskId,
        entityLabel: `Lampiran "${name}"`,
        employeeId,
        after: { fileName: name, size: file.size },
      });
      return toAttachment(data as AttachmentRow);
    },
    async getDownloadUrl(id) {
      await requireRole();
      const sb = getSupabase();
      const { data, error } = await sb
        .from('attachments')
        .select('storage_path')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) throw new NotFoundError('Lampiran tidak ditemukan.');
      const { data: signed, error: signErr } = await sb.storage
        .from('lampiran')
        .createSignedUrl((data as { storage_path: string }).storage_path, 120);
      if (signErr || !signed) throw new StorageError('Gagal membuat tautan unduhan.');
      return signed.signedUrl;
    },
    async remove(id, ctx) {
      await requireRole();
      const employeeId = await assertActor(ctx);
      const sb = getSupabase();
      const { data } = await sb.from('attachments').select().eq('id', id).maybeSingle();
      if (!data) return;
      const row = data as AttachmentRow;
      await sb.storage.from('lampiran').remove([row.storage_path]);
      const { error } = await sb.from('attachments').delete().eq('id', id);
      if (error) wrap(error, 'Gagal menghapus lampiran');
      await auditWrite({
        action: 'PERMANENT_DELETE',
        entityType: 'ATTACHMENT',
        entityId: row.task_id,
        entityLabel: `Lampiran "${row.file_name}" dihapus`,
        employeeId,
      });
    },
  },

  // -------------------------------------------------------------- taxonomy
  taxonomy: {
    async listCategories(opts) {
      await requireRole();
      let q = getSupabase().from('categories').select().order('sort_order');
      if (!opts?.includeInactive) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) wrap(error, 'Gagal memuat kategori');
      return ((data ?? []) as TaxonomyRow[]).map(toTaxonomy);
    },
    async saveCategory(input, ctx) {
      return saveTaxonomy('categories', 'CATEGORY', input, ctx);
    },
    async reorderCategories(orderedIds, ctx) {
      await requireAdmin();
      await assertActor(ctx);
      const sb = getSupabase();
      await Promise.all(
        orderedIds.map((id, i) => sb.from('categories').update({ sort_order: i }).eq('id', id)),
      );
    },
    async listLabels(opts) {
      await requireRole();
      let q = getSupabase().from('labels').select().order('sort_order');
      if (!opts?.includeInactive) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) wrap(error, 'Gagal memuat label');
      return ((data ?? []) as TaxonomyRow[]).map(toTaxonomy);
    },
    async saveLabel(input, ctx) {
      return saveTaxonomy('labels', 'LABEL', input, ctx);
    },
    async reorderLabels(orderedIds, ctx) {
      await requireAdmin();
      await assertActor(ctx);
      const sb = getSupabase();
      await Promise.all(
        orderedIds.map((id, i) => sb.from('labels').update({ sort_order: i }).eq('id', id)),
      );
    },
  },

  // -------------------------------------------------------------- templates
  templates: {
    async list(opts) {
      await requireRole();
      let q = getSupabase().from('templates').select().order('sort_order');
      if (!opts?.includeInactive) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) wrap(error, 'Gagal memuat template');
      return ((data ?? []) as TemplateRow[]).map(toTemplate);
    },
    async save(input, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      const row = {
        name: input.name.trim(),
        title: input.title.trim(),
        description: input.description,
        category_id: input.categoryId,
        label_ids: input.labelIds,
        duration_type: input.durationType,
        priority: input.priority,
        initial_step_id: input.initialStepId,
        target_offset_days: input.targetOffsetDays,
        checklist: input.checklist,
        active: input.active,
        updated_at: nowISO(),
      };
      const sb = getSupabase();
      const query = input.id
        ? sb.from('templates').update(row).eq('id', input.id).select().single()
        : sb.from('templates').insert(row).select().single();
      const { data, error } = await query;
      if (error || !data) wrap(error, 'Gagal menyimpan template');
      const tpl = toTemplate(data as TemplateRow);
      await auditWrite({
        action: input.id ? 'UPDATE' : 'CREATE',
        entityType: 'TEMPLATE',
        entityId: tpl.id,
        entityLabel: tpl.name,
        employeeId,
      });
      return tpl;
    },
    async remove(id, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      const { error } = await getSupabase().from('templates').delete().eq('id', id);
      if (error) wrap(error, 'Gagal menghapus template');
      await auditWrite({
        action: 'PERMANENT_DELETE',
        entityType: 'TEMPLATE',
        entityId: id,
        entityLabel: 'Template dihapus',
        employeeId,
      });
    },
    async reorder(orderedIds, ctx) {
      await requireAdmin();
      await assertActor(ctx);
      const sb = getSupabase();
      await Promise.all(
        orderedIds.map((id, i) => sb.from('templates').update({ sort_order: i }).eq('id', id)),
      );
    },
  },

  // ------------------------------------------------------------ distribution
  distribution: {
    async getActive(year, period) {
      await requireRole();
      let q = getSupabase()
        .from('distribution_snapshots')
        .select()
        .eq('status', 'ACTIVE')
        .order('activated_at', { ascending: false })
        .limit(1);
      if (year !== undefined) q = q.eq('year', year);
      if (period !== undefined) q = q.eq('period', period);
      const { data, error } = await q;
      if (error) wrap(error, 'Gagal memuat data penyaluran');
      const row = (data as SnapshotRow[] | null)?.[0];
      return row ? toSnapshot(row) : null;
    },
    async list() {
      await requireRole();
      const { data, error } = await getSupabase()
        .from('distribution_snapshots')
        .select()
        .order('year', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) wrap(error, 'Gagal memuat histori penyaluran');
      return ((data ?? []) as SnapshotRow[]).map(toSnapshot);
    },
    async get(id) {
      await requireRole();
      const { data, error } = await getSupabase()
        .from('distribution_snapshots')
        .select()
        .eq('id', id)
        .maybeSingle();
      if (error || !data) throw new NotFoundError('Snapshot tidak ditemukan.');
      return toSnapshot(data as SnapshotRow);
    },
    async createDraft(input, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      const errors = [...validateScope(input.year, input.period), ...validateRows(input.rows)];
      if (errors.length > 0) throw new ValidationError(errors[0] ?? 'Data tidak valid.');
      const { data, error } = await getSupabase()
        .from('distribution_snapshots')
        .insert({
          year: input.year,
          period: input.period.trim(),
          status: 'DRAFT',
          rows: input.rows,
          source_file_name: input.sourceFileName ?? null,
          note: input.note ?? null,
          created_by_employee_id: employeeId,
        })
        .select()
        .single();
      if (error || !data) wrap(error, 'Gagal menyimpan draft');
      const snap = toSnapshot(data as SnapshotRow);
      await auditWrite({
        action: 'IMPORT',
        entityType: 'SNAPSHOT',
        entityId: snap.id,
        entityLabel: `Penyaluran ${snap.year} · ${snap.period}`,
        employeeId,
        after: { fileName: snap.sourceFileName, rows: snap.rows.length },
      });
      return snap;
    },
    async activate(id, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      const { data, error } = await getSupabase().rpc('activate_snapshot', { p_id: id });
      if (error) wrap(error, 'Gagal mengaktifkan snapshot');
      const snap = toSnapshot(data as SnapshotRow);
      await auditWrite({
        action: 'ACTIVATE',
        entityType: 'SNAPSHOT',
        entityId: id,
        entityLabel: `Penyaluran ${snap.year} · ${snap.period}`,
        employeeId,
        after: { status: 'ACTIVE' },
      });
      return snap;
    },
    async deactivate(id, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      const { data, error } = await getSupabase()
        .from('distribution_snapshots')
        .update({ status: 'DRAFT', activated_at: null, updated_at: nowISO() })
        .eq('id', id)
        .eq('status', 'ACTIVE')
        .select();
      if (error) wrap(error, 'Gagal membatalkan aktivasi');
      const row = (data as SnapshotRow[] | null)?.[0];
      if (!row) throw new ValidationError('Hanya snapshot aktif yang dapat dibatalkan aktivasinya.');
      const snap = toSnapshot(row);
      await auditWrite({
        action: 'DEACTIVATE',
        entityType: 'SNAPSHOT',
        entityId: id,
        entityLabel: `Penyaluran ${snap.year} · ${snap.period}`,
        employeeId,
      });
      return snap;
    },
    async correct(id, rows, reason, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      if (!reason.trim()) throw new ValidationError('Alasan koreksi wajib diisi.');
      const rowErrors = validateRows(rows);
      if (rowErrors.length > 0) throw new ValidationError(rowErrors[0] ?? 'Data koreksi tidak valid.');
      const source = await supabaseAdapter.distribution.get(id);
      const corrected = await supabaseAdapter.distribution.createDraft(
        {
          year: source.year,
          period: source.period,
          rows,
          sourceFileName: source.sourceFileName,
          note: `Koreksi manual: ${reason.trim()}`,
        },
        ctx,
      );
      await auditWrite({
        action: 'CORRECTION',
        entityType: 'SNAPSHOT',
        entityId: corrected.id,
        entityLabel: `Penyaluran ${corrected.year} · ${corrected.period}`,
        employeeId,
        before: { sourceSnapshotId: id },
        after: { reason: reason.trim() },
      });
      if (source.status === 'ACTIVE') {
        return supabaseAdapter.distribution.activate(corrected.id, ctx);
      }
      return corrected;
    },
    async remove(id, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      const snap = await supabaseAdapter.distribution.get(id);
      if (snap.status === 'ACTIVE') {
        throw new ValidationError('Snapshot aktif tidak dapat dihapus. Batalkan aktivasi dahulu.');
      }
      const { error } = await getSupabase().from('distribution_snapshots').delete().eq('id', id);
      if (error) wrap(error, 'Gagal menghapus snapshot');
      await auditWrite({
        action: 'PERMANENT_DELETE',
        entityType: 'SNAPSHOT',
        entityId: id,
        entityLabel: `Penyaluran ${snap.year} · ${snap.period}`,
        employeeId,
      });
    },
    async listScopes() {
      await requireRole();
      const { data, error } = await getSupabase()
        .from('distribution_snapshots')
        .select('year, period');
      if (error) wrap(error, 'Gagal memuat scope');
      const seen = new Set<string>();
      const scopes: { year: number; period: string }[] = [];
      for (const r of (data ?? []) as Array<{ year: number; period: string }>) {
        const key = `${r.year}|${r.period}`;
        if (!seen.has(key)) {
          seen.add(key);
          scopes.push(r);
        }
      }
      return scopes.sort((a, b) => b.year - a.year || a.period.localeCompare(b.period));
    },
  },

  // ------------------------------------------------------------------ audit
  audit: {
    async list(filter) {
      await requireAdmin();
      let q = getSupabase().from('audit_log').select('*', { count: 'exact' });
      if (filter?.action) q = q.eq('action', filter.action);
      if (filter?.entityType) q = q.eq('entity_type', filter.entityType);
      if (filter?.employeeId) q = q.eq('employee_id', filter.employeeId);
      if (filter?.dateFrom) q = q.gte('at', filter.dateFrom);
      if (filter?.dateTo) q = q.lte('at', `${filter.dateTo}T23:59:59.999Z`);
      if (filter?.search) q = q.ilike('entity_label', `%${filter.search}%`);
      const offset = filter?.offset ?? 0;
      const limit = filter?.limit ?? 50;
      const { data, error, count } = await q
        .order('at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) wrap(error, 'Gagal memuat audit');
      return { entries: ((data ?? []) as AuditRow[]).map(toAudit), total: count ?? 0 };
    },
    async recentActivity(limit = 20) {
      await requireRole();
      // Feed aktivitas memakai view/policy khusus? Di produksi, audit hanya Admin;
      // aktivitas untuk semua akun dibaca lewat tabel yang sama dengan kolom terbatas.
      const { data, error } = await getSupabase()
        .from('audit_log')
        .select()
        .order('at', { ascending: false })
        .limit(limit * 4);
      if (error) return [];
      const events = [];
      for (const row of (data ?? []) as AuditRow[]) {
        const evt = toActivityEvent(toAudit(row));
        if (evt) events.push(evt);
        if (events.length >= limit) break;
      }
      return events;
    },
  },

  // --------------------------------------------------------------- settings
  settings: {
    async get(): Promise<AppSettings> {
      const { data, error } = await getSupabase()
        .from('app_settings')
        .select()
        .eq('id', 1)
        .single();
      if (error || !data) wrap(error, 'Gagal memuat pengaturan');
      return toSettings(data as SettingsRow);
    },
    async update(patch, expectedVersion, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      const row: Record<string, unknown> = {
        updated_at: nowISO(),
        version: expectedVersion + 1,
      };
      if (patch.appName !== undefined) row.app_name = patch.appName.trim();
      if (patch.logoDataUrl !== undefined) row.logo_data_url = patch.logoDataUrl;
      if (patch.activeYear !== undefined) row.active_year = patch.activeYear;
      if (patch.userSessionDays !== undefined) row.user_session_days = patch.userSessionDays;
      if (patch.staleDays !== undefined) row.stale_days = patch.staleDays;
      if (patch.attachmentMaxMB !== undefined) row.attachment_max_mb = patch.attachmentMaxMB;
      if (patch.attachmentAllowedExt !== undefined) {
        row.attachment_allowed_ext = patch.attachmentAllowedExt;
      }
      const { data, error } = await getSupabase()
        .from('app_settings')
        .update(row)
        .eq('id', 1)
        .eq('version', expectedVersion)
        .select();
      if (error) wrap(error, 'Gagal menyimpan pengaturan');
      const updated = (data as SettingsRow[] | null)?.[0];
      if (!updated) throw new ConflictError();
      await auditWrite({
        action: 'SETTINGS_UPDATE',
        entityType: 'SETTINGS',
        entityLabel: 'Pengaturan aplikasi',
        employeeId,
        after: patch,
      });
      return toSettings(updated);
    },
    async changeUserPassword(newPassword, ctx) {
      await requireAdmin();
      const employeeId = await assertActor(ctx);
      if (newPassword.length < 8) throw new ValidationError('Password User minimal 8 karakter.');
      const { error } = await getSupabase().functions.invoke('admin-actions', {
        body: { action: 'change-user-password', newPassword },
      });
      if (error) {
        throw new AppError('UNAVAILABLE', `Gagal mengganti password: ${error.message}`);
      }
      await auditWrite({
        action: 'PASSWORD_CHANGE',
        entityType: 'SETTINGS',
        entityLabel: 'Password akun User diganti',
        employeeId,
      });
    },
    async exportBackup(): Promise<BackupPayload> {
      await requireAdmin();
      const sb = getSupabase();
      const tables = [
        'employees', 'board', 'steps', 'tasks', 'task_comments', 'attachments',
        'categories', 'labels', 'templates', 'distribution_snapshots', 'app_settings',
      ];
      const data: Record<string, unknown> = {};
      for (const table of tables) {
        const { data: rows } = await sb.from(table).select();
        data[table] = rows ?? [];
      }
      await auditWrite({ action: 'BACKUP', entityType: 'SETTINGS', entityLabel: 'Ekspor backup JSON' });
      return { exportedAt: nowISO(), appVersion: '1.0-supabase', data };
    },
    async importBackup() {
      throw new ValidationError(
        'Pada mode produksi, pemulihan dilakukan lewat backup database Supabase (PITR/pg_restore) — lihat DEPLOYMENT.md.',
      );
    },
  },

  // ---------------------------------------------------------------- realtime
  realtime: {
    subscribe(listener) {
      const TABLE_TOPIC: Record<string, ChangeTopic> = {
        board: 'board',
        steps: 'steps',
        tasks: 'tasks',
        task_comments: 'comments',
        attachments: 'attachments',
        employees: 'employees',
        categories: 'categories',
        labels: 'labels',
        templates: 'templates',
        distribution_snapshots: 'distribution',
        app_settings: 'settings',
        device_sessions: 'sessions',
        audit_log: 'audit',
      };
      const channel = getSupabase()
        .channel('pip-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          const topic = TABLE_TOPIC[payload.table];
          if (!topic) return;
          const event: ChangeEvent = { topic };
          if (topic === 'sessions') {
            const newRow = payload.new as { id?: string; revoked_at?: string | null } | null;
            if (newRow?.revoked_at && newRow.id) {
              event.revokedSessionId = newRow.id;
            }
          }
          listener(event);
        })
        .subscribe();
      return () => {
        void getSupabase().removeChannel(channel);
      };
    },
  },
};

// ---------------------------------------------------------------------------
// Helper internal
// ---------------------------------------------------------------------------

async function setTaskFlag(
  id: string,
  row: Record<string, unknown>,
  action: AuditEntry['action'],
  ctx: ActorContext,
): Promise<Task> {
  await requireRole();
  const employeeId = await assertActor(ctx);
  const { data, error } = await getSupabase()
    .from('tasks')
    .update({ ...row, updated_at: nowISO(), updated_by_employee_id: employeeId })
    .eq('id', id)
    .select()
    .single();
  if (error || !data) wrap(error, 'Gagal memperbarui pekerjaan');
  const task = toTask(data as TaskRow);
  await auditWrite({
    action,
    entityType: 'TASK',
    entityId: id,
    entityLabel: task.title,
    employeeId,
    after: row,
  });
  return task;
}

async function saveTaxonomy(
  table: 'categories' | 'labels',
  entityType: 'CATEGORY' | 'LABEL',
  input: { id?: string; name: string; color: string; active?: boolean },
  ctx: ActorContext,
) {
  await requireAdmin();
  const employeeId = await assertActor(ctx);
  const name = input.name.trim();
  if (!name) throw new ValidationError('Nama wajib diisi.');
  const sb = getSupabase();
  // Tolak duplikat nama (case-insensitive)
  const { data: dup } = await sb.from(table).select('id, name').ilike('name', name);
  const exists = ((dup ?? []) as Array<{ id: string; name: string }>).some(
    (d) => d.name.toLowerCase() === name.toLowerCase() && d.id !== input.id,
  );
  if (exists) throw new ValidationError(`"${name}" sudah ada.`);
  const row = { name, color: input.color, ...(input.active !== undefined ? { active: input.active } : {}) };
  const query = input.id
    ? sb.from(table).update(row).eq('id', input.id).select().single()
    : sb.from(table).insert({ ...row, sort_order: 999 }).select().single();
  const { data, error } = await query;
  if (error || !data) wrap(error, 'Gagal menyimpan');
  await auditWrite({
    action: input.id ? 'UPDATE' : 'CREATE',
    entityType,
    entityId: (data as TaxonomyRow).id,
    entityLabel: name,
    employeeId,
  });
  return toTaxonomy(data as TaxonomyRow);
}
