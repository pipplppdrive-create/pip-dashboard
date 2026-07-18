import { uid } from '@/lib/utils';
import { ConflictError, NotFoundError, ValidationError } from '@/services/errors';
import type {
  ActorContext,
  AuditEntry,
  BoardInfo,
  BoardService,
  CommentType,
  Step,
  StepKind,
  Task,
  TaskComment,
  TaskCreateInput,
  TaskPatch,
  TaskService,
} from '@/services/types';
import { localBus } from './bus';
import { COL, db, ensureSeeded, nowISO, writeAudit } from './db';
import { requireActor, requireAdmin, requireSession } from './guard-util';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getBoardOrThrow(): BoardInfo {
  const board = db.board();
  if (!board) throw new NotFoundError('Board tidak ditemukan.');
  return board;
}

function getStepOrThrow(id: string): Step {
  const step = db.steps().find((s) => s.id === id);
  if (!step) throw new NotFoundError('Step tidak ditemukan.');
  return step;
}

function getTaskOrThrow(id: string): Task {
  const t = db.tasks().find((x) => x.id === id);
  if (!t) throw new NotFoundError('Pekerjaan tidak ditemukan. Mungkin sudah dihapus.');
  return t;
}

function activeSteps(): Step[] {
  return db
    .steps()
    .filter((s) => !s.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Kartu hidup (belum terhapus) pada sebuah step, terurut. */
function tasksInStep(stepId: string): Task[] {
  return db
    .tasks()
    .filter((t) => t.stepId === stepId && !t.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function saveTasks(tasks: Task[]): void {
  db.write(COL.tasks, tasks);
  localBus.emit({ topic: 'tasks' });
}

function saveSteps(steps: Step[]): void {
  db.write(COL.steps, steps);
  localBus.emit({ topic: 'steps' });
}

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

// ---------------------------------------------------------------------------
// BoardService
// ---------------------------------------------------------------------------

export const localBoard: BoardService = {
  async get(): Promise<BoardInfo> {
    await ensureSeeded();
    requireSession();
    return getBoardOrThrow();
  },

  async rename(title, expectedVersion, ctx): Promise<BoardInfo> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const trimmed = title.trim();
    if (!trimmed) throw new ValidationError('Judul board tidak boleh kosong.');
    if (trimmed.length > 80) throw new ValidationError('Judul board maksimal 80 karakter.');
    const board = getBoardOrThrow();
    if (board.version !== expectedVersion) throw new ConflictError();
    const next: BoardInfo = {
      ...board,
      title: trimmed,
      updatedAt: nowISO(),
      version: board.version + 1,
    };
    db.write(COL.board, next);
    localBus.emit({ topic: 'board' });
    writeAudit({
      ...auditBase(employeeId),
      action: 'UPDATE',
      entityType: 'BOARD',
      entityId: board.id,
      entityLabel: trimmed,
      before: { title: board.title },
      after: { title: trimmed },
    });
    return next;
  },

  async listSteps(opts): Promise<Step[]> {
    await ensureSeeded();
    requireSession();
    const all = [...db.steps()].sort((a, b) => a.sortOrder - b.sortOrder);
    return opts?.includeDeleted ? all : all.filter((s) => !s.deletedAt);
  },

  async createStep(input, ctx): Promise<Step> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const name = input.name.trim();
    if (!name) throw new ValidationError('Nama step tidak boleh kosong.');
    if (name.length > 40) throw new ValidationError('Nama step maksimal 40 karakter.');
    const steps = activeSteps();
    const step: Step = {
      id: uid('step'),
      boardId: getBoardOrThrow().id,
      name,
      kind: input.kind ?? 'NORMAL',
      color: input.color ?? '#94a3b8',
      sortOrder: (steps[steps.length - 1]?.sortOrder ?? -1) + 1,
      deletedAt: null,
      version: 1,
    };
    saveSteps([...db.steps(), step]);
    writeAudit({
      ...auditBase(employeeId),
      action: 'CREATE',
      entityType: 'STEP',
      entityId: step.id,
      entityLabel: name,
      after: { name, kind: step.kind },
    });
    return step;
  },

  async updateStep(id, patch, expectedVersion, ctx): Promise<Step> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const step = getStepOrThrow(id);
    if (step.deletedAt) throw new ValidationError('Step sudah dihapus.');
    if (step.version !== expectedVersion) throw new ConflictError();
    const name = patch.name?.trim();
    if (name !== undefined) {
      if (!name) throw new ValidationError('Nama step tidak boleh kosong.');
      if (name.length > 40) throw new ValidationError('Nama step maksimal 40 karakter.');
    }
    const next: Step = {
      ...step,
      name: name ?? step.name,
      kind: (patch.kind as StepKind | undefined) ?? step.kind,
      color: patch.color ?? step.color,
      version: step.version + 1,
    };
    saveSteps(db.steps().map((s) => (s.id === id ? next : s)));
    writeAudit({
      ...auditBase(employeeId),
      action: 'UPDATE',
      entityType: 'STEP',
      entityId: id,
      entityLabel: next.name,
      before: { name: step.name, kind: step.kind, color: step.color },
      after: { name: next.name, kind: next.kind, color: next.color },
    });
    return next;
  },

  async reorderSteps(orderedIds, ctx): Promise<void> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const current = activeSteps();
    const currentIds = new Set(current.map((s) => s.id));
    if (
      orderedIds.length !== current.length ||
      orderedIds.some((id) => !currentIds.has(id))
    ) {
      throw new ValidationError('Urutan step tidak valid. Muat ulang lalu coba lagi.');
    }
    const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
    saveSteps(
      db.steps().map((s) => {
        const idx = orderMap.get(s.id);
        return idx === undefined ? s : { ...s, sortOrder: idx, version: s.version + 1 };
      }),
    );
    writeAudit({
      ...auditBase(employeeId),
      action: 'UPDATE',
      entityType: 'BOARD',
      entityId: getBoardOrThrow().id,
      entityLabel: 'Urutan step diubah',
      before: { order: current.map((s) => s.name) },
      after: { order: orderedIds.map((id) => current.find((s) => s.id === id)?.name) },
    });
  },

  async deleteStep(id, opts, ctx): Promise<void> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const step = getStepOrThrow(id);
    if (step.deletedAt) return;
    const remaining = activeSteps().filter((s) => s.id !== id);
    if (remaining.length === 0) {
      throw new ValidationError('Step terakhir tidak dapat dihapus.');
    }
    const cards = db.tasks().filter((t) => t.stepId === id && !t.deletedAt);
    if (cards.length > 0) {
      // Pengamanan: step berisi kartu — wajib pindahkan seluruh kartu dulu.
      const targetId = opts.moveCardsToStepId;
      if (!targetId) {
        throw new ValidationError(
          `Step "${step.name}" berisi ${cards.length} kartu. Pilih step tujuan pemindahan.`,
        );
      }
      const target = getStepOrThrow(targetId);
      if (target.id === id || target.deletedAt) {
        throw new ValidationError('Step tujuan tidak valid.');
      }
      const baseOrder = tasksInStep(targetId).length;
      let offset = 0;
      const movedIds = new Set(cards.map((c) => c.id));
      saveTasks(
        db.tasks().map((t) => {
          if (!movedIds.has(t.id)) return t;
          const moved: Task = {
            ...t,
            stepId: targetId,
            sortOrder: baseOrder + offset,
            updatedAt: nowISO(),
            version: t.version + 1,
          };
          offset += 1;
          return moved;
        }),
      );
      writeAudit({
        ...auditBase(employeeId),
        action: 'MOVE',
        entityType: 'STEP',
        entityId: id,
        entityLabel: `${cards.length} kartu dipindahkan dari "${step.name}" ke "${target.name}"`,
        before: { stepId: id },
        after: { stepId: targetId, count: cards.length },
      });
    }
    saveSteps(
      db.steps().map((s) =>
        s.id === id ? { ...s, deletedAt: nowISO(), version: s.version + 1 } : s,
      ),
    );
    writeAudit({
      ...auditBase(employeeId),
      action: 'SOFT_DELETE',
      entityType: 'STEP',
      entityId: id,
      entityLabel: step.name,
      before: { name: step.name },
    });
  },

  async restoreStep(id, ctx): Promise<Step> {
    await ensureSeeded();
    requireAdmin();
    const employeeId = requireActor(ctx);
    const step = getStepOrThrow(id);
    if (!step.deletedAt) return step;
    const maxOrder = Math.max(-1, ...activeSteps().map((s) => s.sortOrder));
    const next: Step = { ...step, deletedAt: null, sortOrder: maxOrder + 1, version: step.version + 1 };
    saveSteps(db.steps().map((s) => (s.id === id ? next : s)));
    writeAudit({
      ...auditBase(employeeId),
      action: 'RESTORE',
      entityType: 'STEP',
      entityId: id,
      entityLabel: step.name,
    });
    return next;
  },
};

// ---------------------------------------------------------------------------
// TaskService
// ---------------------------------------------------------------------------

const EDITABLE_FIELDS: Array<keyof TaskPatch> = [
  'title',
  'description',
  'durationType',
  'categoryId',
  'labelIds',
  'priority',
  'startDate',
  'dueDate',
  'progressMode',
  'manualProgress',
  'picMainIds',
  'picMainId',
  'picIds',
  'checklist',
  'isFocus',
];

function validateTaskFields(patch: TaskPatch): void {
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new ValidationError('Judul pekerjaan tidak boleh kosong.');
    if (t.length > 160) throw new ValidationError('Judul pekerjaan maksimal 160 karakter.');
  }
  if (patch.manualProgress !== undefined) {
    if (patch.manualProgress < 0 || patch.manualProgress > 100) {
      throw new ValidationError('Progres harus di antara 0 dan 100.');
    }
  }
  if (patch.startDate && patch.dueDate && patch.startDate > patch.dueDate) {
    throw new ValidationError('Target selesai tidak boleh sebelum tanggal mulai.');
  }
  const pics = new Set<string>();
  if (patch.picMainId) pics.add(patch.picMainId);
  for (const id of patch.picMainIds ?? []) pics.add(id);
  for (const id of patch.picIds ?? []) pics.add(id);
  if (pics.size > 0) {
    const employees = db.employees();
    for (const id of pics) {
      const emp = employees.find((e) => e.id === id);
      if (!emp) throw new ValidationError('PIC tidak ditemukan pada master pegawai.');
    }
  }
}

/** PIC nonaktif tidak boleh DITAMBAHKAN; PIC lama yang nonaktif boleh bertahan. */
function assertNoNewInactivePic(
  prev: Pick<Task, 'picMainIds' | 'picMainId' | 'picIds'> | null,
  patch: TaskPatch,
): void {
  const employees = db.employees();
  const prevSet = new Set([
    ...(prev?.picMainIds ?? []),
    ...(prev?.picMainId ? [prev.picMainId] : []),
    ...(prev?.picIds ?? []),
  ]);
  const nextIds = [
    ...(patch.picMainIds ?? []),
    ...(patch.picMainId !== undefined ? (patch.picMainId ? [patch.picMainId] : []) : []),
    ...(patch.picIds ?? []),
  ];
  for (const id of nextIds) {
    if (prevSet.has(id)) continue;
    const emp = employees.find((e) => e.id === id);
    if (emp && !emp.active) {
      throw new ValidationError(`Pegawai "${emp.displayName}" nonaktif dan tidak dapat dipilih sebagai PIC.`);
    }
  }
}

function stepName(id: string): string {
  return db.steps().find((s) => s.id === id)?.name ?? '?';
}

export const localTasks: TaskService = {
  async list(opts): Promise<Task[]> {
    await ensureSeeded();
    requireSession();
    return db
      .tasks()
      .filter((t) => {
        if (t.deletedAt && !opts?.includeDeleted) return false;
        if (t.archivedAt && !opts?.includeArchived) return false;
        return true;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async get(id): Promise<Task> {
    await ensureSeeded();
    requireSession();
    return getTaskOrThrow(id);
  },

  async create(input: TaskCreateInput, ctx: ActorContext): Promise<Task> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const step = getStepOrThrow(input.stepId);
    if (step.deletedAt) throw new ValidationError('Step tujuan sudah dihapus.');
    validateTaskFields(input);
    assertNoNewInactivePic(null, input);
    const title = input.title.trim();
    if (!title) throw new ValidationError('Judul pekerjaan tidak boleh kosong.');
    const order = tasksInStep(input.stepId).length;
    const task: Task = {
      id: uid('task'),
      boardId: step.boardId,
      stepId: input.stepId,
      title,
      description: input.description ?? '',
      durationType: input.durationType,
      categoryId: input.categoryId ?? null,
      labelIds: input.labelIds ?? [],
      priority: input.priority,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      progressMode: input.progressMode ?? 'MANUAL',
      manualProgress: input.manualProgress ?? 0,
      ...(() => {
        const mains = input.picMainIds ?? (input.picMainId ? [input.picMainId] : []);
        return {
          picMainIds: mains,
          picMainId: mains[0] ?? null,
          picIds: (input.picIds ?? []).filter((id) => !mains.includes(id)),
        };
      })(),
      checklist: input.checklist ?? [],
      isFocus: input.isFocus ?? false,
      sortOrder: order,
      archivedAt: null,
      deletedAt: null,
      deleteReason: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      version: 1,
      createdByEmployeeId: employeeId,
      updatedByEmployeeId: employeeId,
    };
    saveTasks([...db.tasks(), task]);
    writeAudit({
      ...auditBase(employeeId),
      action: 'CREATE',
      entityType: 'TASK',
      entityId: task.id,
      entityLabel: title,
      after: { stepId: task.stepId, step: stepName(task.stepId), priority: task.priority },
    });
    return task;
  },

  async update(id, patch, expectedVersion, ctx): Promise<Task> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const task = getTaskOrThrow(id);
    if (task.deletedAt) throw new ValidationError('Pekerjaan sudah dihapus.');
    if (task.version !== expectedVersion) throw new ConflictError();
    validateTaskFields(patch);
    assertNoNewInactivePic(task, patch);

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const next: Task = { ...task };
    for (const key of EDITABLE_FIELDS) {
      if (patch[key] === undefined) continue;
      const prevVal = task[key];
      const nextVal = patch[key];
      if (JSON.stringify(prevVal) === JSON.stringify(nextVal)) continue;
      before[key] = prevVal;
      after[key] = nextVal;
      (next as unknown as Record<string, unknown>)[key] = nextVal as unknown;
    }
    // Jaga konsistensi: picMainId = elemen pertama picMainIds; PIC tambahan
    // tidak boleh berisi PIC utama.
    if (patch.picMainIds !== undefined || patch.picMainId !== undefined) {
      const mains = patch.picMainIds ?? (patch.picMainId ? [patch.picMainId] : []);
      next.picMainIds = mains;
      next.picMainId = mains[0] ?? null;
    }
    next.picIds = next.picIds.filter((p) => !next.picMainIds.includes(p));
    if (Object.keys(after).length === 0) return task;
    next.title = next.title.trim();
    next.updatedAt = nowISO();
    next.updatedByEmployeeId = employeeId;
    next.version = task.version + 1;
    saveTasks(db.tasks().map((t) => (t.id === id ? next : t)));
    writeAudit({
      ...auditBase(employeeId),
      action: 'UPDATE',
      entityType: 'TASK',
      entityId: id,
      entityLabel: next.title,
      before,
      after,
    });
    return next;
  },

  async move(id, to, ctx): Promise<Task> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const task = getTaskOrThrow(id);
    if (task.deletedAt) throw new ValidationError('Pekerjaan sudah dihapus.');
    const targetStep = getStepOrThrow(to.stepId);
    if (targetStep.deletedAt) throw new ValidationError('Step tujuan sudah dihapus.');

    const fromStepId = task.stepId;
    const source = tasksInStep(fromStepId).filter((t) => t.id !== id);
    const target = fromStepId === to.stepId ? source : tasksInStep(to.stepId);
    const index = Math.max(0, Math.min(to.index, target.length));

    const moved: Task = {
      ...task,
      stepId: to.stepId,
      updatedAt: nowISO(),
      updatedByEmployeeId: employeeId,
      version: task.version + 1,
    };
    target.splice(index, 0, moved);

    const orderMap = new Map<string, number>();
    target.forEach((t, i) => orderMap.set(t.id, i));
    if (fromStepId !== to.stepId) {
      source.forEach((t, i) => orderMap.set(t.id, i));
    }

    saveTasks(
      db.tasks().map((t) => {
        if (t.id === id) return { ...moved, sortOrder: orderMap.get(id) ?? 0 };
        const order = orderMap.get(t.id);
        return order === undefined || t.sortOrder === order ? t : { ...t, sortOrder: order };
      }),
    );

    if (fromStepId !== to.stepId) {
      writeAudit({
        ...auditBase(employeeId),
        action: 'MOVE',
        entityType: 'TASK',
        entityId: id,
        entityLabel: task.title,
        before: { step: stepName(fromStepId) },
        after: { step: targetStep.name, stepKind: targetStep.kind },
      });
    }
    return { ...moved, sortOrder: orderMap.get(id) ?? 0 };
  },

  async archive(id, ctx): Promise<Task> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const task = getTaskOrThrow(id);
    if (task.archivedAt) return task;
    const next: Task = {
      ...task,
      archivedAt: nowISO(),
      updatedAt: nowISO(),
      updatedByEmployeeId: employeeId,
      version: task.version + 1,
    };
    saveTasks(db.tasks().map((t) => (t.id === id ? next : t)));
    writeAudit({
      ...auditBase(employeeId),
      action: 'ARCHIVE',
      entityType: 'TASK',
      entityId: id,
      entityLabel: task.title,
    });
    return next;
  },

  async unarchive(id, ctx): Promise<Task> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const task = getTaskOrThrow(id);
    if (!task.archivedAt) return task;
    const next: Task = {
      ...task,
      archivedAt: null,
      updatedAt: nowISO(),
      updatedByEmployeeId: employeeId,
      version: task.version + 1,
      sortOrder: tasksInStep(task.stepId).length,
    };
    saveTasks(db.tasks().map((t) => (t.id === id ? next : t)));
    writeAudit({
      ...auditBase(employeeId),
      action: 'UNARCHIVE',
      entityType: 'TASK',
      entityId: id,
      entityLabel: task.title,
    });
    return next;
  },

  async softDelete(id, reason, ctx): Promise<void> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const task = getTaskOrThrow(id);
    if (task.deletedAt) return;
    const trimmed = reason.trim();
    if (!trimmed) throw new ValidationError('Alasan penghapusan wajib diisi.');
    const next: Task = {
      ...task,
      deletedAt: nowISO(),
      deleteReason: trimmed,
      updatedAt: nowISO(),
      updatedByEmployeeId: employeeId,
      version: task.version + 1,
    };
    saveTasks(db.tasks().map((t) => (t.id === id ? next : t)));
    writeAudit({
      ...auditBase(employeeId),
      action: 'SOFT_DELETE',
      entityType: 'TASK',
      entityId: id,
      entityLabel: task.title,
      after: { reason: trimmed },
    });
  },

  async restore(id, ctx): Promise<Task> {
    await ensureSeeded();
    requireAdmin();
    const employeeId = requireActor(ctx);
    const task = getTaskOrThrow(id);
    if (!task.deletedAt) return task;
    const stepExists = activeSteps().some((s) => s.id === task.stepId);
    const fallbackStep = activeSteps()[0];
    const next: Task = {
      ...task,
      deletedAt: null,
      deleteReason: null,
      stepId: stepExists ? task.stepId : (fallbackStep?.id ?? task.stepId),
      updatedAt: nowISO(),
      updatedByEmployeeId: employeeId,
      version: task.version + 1,
    };
    saveTasks(db.tasks().map((t) => (t.id === id ? next : t)));
    writeAudit({
      ...auditBase(employeeId),
      action: 'RESTORE',
      entityType: 'TASK',
      entityId: id,
      entityLabel: task.title,
    });
    return next;
  },

  async permanentDelete(id, ctx): Promise<void> {
    await ensureSeeded();
    requireAdmin();
    const employeeId = requireActor(ctx);
    const task = getTaskOrThrow(id);
    saveTasks(db.tasks().filter((t) => t.id !== id));
    db.write(
      COL.comments,
      db.comments().filter((c) => c.taskId !== id),
    );
    db.write(
      COL.attachments,
      db.attachments().filter((a) => a.taskId !== id),
    );
    localBus.emit({ topic: 'comments' });
    localBus.emit({ topic: 'attachments' });
    writeAudit({
      ...auditBase(employeeId),
      action: 'PERMANENT_DELETE',
      entityType: 'TASK',
      entityId: id,
      entityLabel: task.title,
      before: { title: task.title, deletedAt: task.deletedAt },
    });
  },

  async listComments(taskId): Promise<TaskComment[]> {
    await ensureSeeded();
    requireSession();
    return db
      .comments()
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  },

  async listAllComments(): Promise<TaskComment[]> {
    await ensureSeeded();
    requireSession();
    return [...db.comments()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  async addComment(taskId, type: CommentType, text, ctx): Promise<TaskComment> {
    await ensureSeeded();
    requireSession();
    const employeeId = requireActor(ctx);
    const task = getTaskOrThrow(taskId);
    const trimmed = text.trim();
    if (!trimmed) throw new ValidationError('Isi catatan tidak boleh kosong.');
    if (trimmed.length > 2000) throw new ValidationError('Catatan maksimal 2000 karakter.');
    const comment: TaskComment = {
      id: uid('cmt'),
      taskId,
      type,
      text: trimmed,
      employeeId,
      createdAt: nowISO(),
    };
    db.write(COL.comments, [...db.comments(), comment]);
    localBus.emit({ topic: 'comments', entityId: taskId });
    // Sentuh task agar "waktu update terakhir" ikut bergerak.
    saveTasks(
      db.tasks().map((t) =>
        t.id === taskId
          ? { ...t, updatedAt: nowISO(), updatedByEmployeeId: employeeId, version: t.version + 1 }
          : t,
      ),
    );
    const labelByType: Record<CommentType, string> = {
      KOMENTAR: 'Komentar',
      KENDALA: 'Kendala',
      TINDAK_LANJUT: 'Tindak lanjut',
    };
    writeAudit({
      ...auditBase(employeeId),
      action: 'CREATE',
      entityType: 'COMMENT',
      entityId: taskId,
      entityLabel: `${labelByType[type]} pada "${task.title}"`,
      after: { type, text: trimmed.slice(0, 200) },
    });
    return comment;
  },

  async history(taskId): Promise<AuditEntry[]> {
    await ensureSeeded();
    requireSession();
    return db
      .audit()
      .filter((e) => e.entityId === taskId)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  },
};
