import type {
  ActivityPlanItem,
  AppSettings,
  AuditAction,
  AuditEntityType,
  AuditEntry,
  Attachment,
  BoardInfo,
  Category,
  ColumnMapping,
  DistributionSnapshot,
  Employee,
  Label,
  Role,
  SessionInfo,
  SheetBinding,
  SpreadsheetSource,
  Step,
  SyncRun,
  Task,
  TaskComment,
  TaskTemplate,
} from '@/services/types';
import { uid } from '@/lib/utils';
import { localBus } from './bus';
import { buildSeedData } from './seed';
import { readCollection, writeCollection } from './storage';

// ---------------------------------------------------------------------------
// Koleksi
// ---------------------------------------------------------------------------

export const COL = {
  meta: 'meta',
  auth: 'auth',
  sessions: 'sessions',
  loginAttempts: 'loginAttempts',
  employees: 'employees',
  board: 'board',
  steps: 'steps',
  tasks: 'tasks',
  comments: 'comments',
  attachments: 'attachments',
  categories: 'categories',
  labels: 'labels',
  templates: 'templates',
  snapshots: 'snapshots',
  settings: 'settings',
  audit: 'audit',
  sources: 'sources',
  bindings: 'bindings',
  columnMappings: 'columnMappings',
  syncRuns: 'syncRuns',
  activities: 'activities',
} as const;

export interface AuthRecord {
  userAccount: string;
  userPasswordHash: string;
  adminUsername: string;
  adminPasswordHash: string;
  updatedAt: string;
}

interface MetaRecord {
  seedVersion: number;
  seededAt: string;
}

export interface LoginAttemptRecord {
  count: number;
  firstAt: number;
  lockedUntil: number | null;
}

// ---------------------------------------------------------------------------
// Util umum
// ---------------------------------------------------------------------------

export const nowISO = (): string => new Date().toISOString();

const SALT = 'pipdash-local';

/** Hash password mode lokal (SHA-256 + salt). Produksi memakai auth backend. */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Seed sekali pakai
// ---------------------------------------------------------------------------

const SEED_VERSION = 2;
let seedPromise: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const meta = readCollection<MetaRecord | null>(COL.meta, null);
      if (meta && meta.seedVersion >= SEED_VERSION) return;
      const auth: AuthRecord = {
        userAccount: 'tim-pip',
        userPasswordHash: await hashPassword('pip2026'),
        adminUsername: 'admin',
        adminPasswordHash: await hashPassword('admin2026'),
        updatedAt: nowISO(),
      };
      const seed = buildSeedData();
      writeCollection(COL.auth, auth);
      writeCollection(COL.employees, seed.employees);
      writeCollection(COL.board, seed.board);
      writeCollection(COL.steps, seed.steps);
      writeCollection(COL.tasks, seed.tasks);
      writeCollection(COL.comments, seed.comments);
      writeCollection<Attachment[]>(COL.attachments, []);
      writeCollection(COL.categories, seed.categories);
      writeCollection(COL.labels, seed.labels);
      writeCollection(COL.templates, seed.templates);
      writeCollection(COL.snapshots, seed.snapshots);
      writeCollection(COL.settings, seed.settings);
      writeCollection(COL.audit, seed.audit);
      writeCollection(COL.sources, seed.sources);
      writeCollection(COL.bindings, seed.bindings);
      writeCollection(COL.columnMappings, seed.columnMappings);
      writeCollection(COL.syncRuns, seed.syncRuns);
      writeCollection(COL.activities, seed.activities);
      writeCollection<SessionInfo[]>(COL.sessions, []);
      writeCollection<Record<string, LoginAttemptRecord>>(COL.loginAttempts, {});
      writeCollection<MetaRecord>(COL.meta, { seedVersion: SEED_VERSION, seededAt: nowISO() });
    })();
  }
  return seedPromise;
}

/** Dipakai reset data contoh / impor backup: paksa seed ulang pada akses berikutnya. */
export function resetSeedMemo(): void {
  seedPromise = null;
}

// ---------------------------------------------------------------------------
// Akses koleksi bertipe
// ---------------------------------------------------------------------------

/** Normalisasi data tersimpan lama (pra-foto & pra-multi-PIC-utama). */
function normalizeEmployee(e: Employee): Employee {
  return {
    ...e,
    avatarPath: e.avatarPath ?? null,
    avatarUpdatedAt: e.avatarUpdatedAt ?? null,
  };
}

function normalizeTask(t: Task): Task {
  const mains =
    t.picMainIds && t.picMainIds.length > 0
      ? t.picMainIds
      : t.picMainId
        ? [t.picMainId]
        : [];
  return {
    ...t,
    picMainIds: mains,
    picMainId: mains[0] ?? null,
    picIds: (t.picIds ?? []).filter((id) => !mains.includes(id)),
  };
}

export const db = {
  employees: () => readCollection<Employee[]>(COL.employees, []).map(normalizeEmployee),
  board: () => readCollection<BoardInfo | null>(COL.board, null),
  steps: () => readCollection<Step[]>(COL.steps, []),
  tasks: () => readCollection<Task[]>(COL.tasks, []).map(normalizeTask),
  comments: () => readCollection<TaskComment[]>(COL.comments, []),
  attachments: () => readCollection<Attachment[]>(COL.attachments, []),
  categories: () => readCollection<Category[]>(COL.categories, []),
  labels: () => readCollection<Label[]>(COL.labels, []),
  templates: () => readCollection<TaskTemplate[]>(COL.templates, []),
  snapshots: () => readCollection<DistributionSnapshot[]>(COL.snapshots, []),
  settings: () => readCollection<AppSettings | null>(COL.settings, null),
  audit: () => readCollection<AuditEntry[]>(COL.audit, []),
  sessions: () => readCollection<SessionInfo[]>(COL.sessions, []),
  sources: () => readCollection<SpreadsheetSource[]>(COL.sources, []),
  bindings: () => readCollection<SheetBinding[]>(COL.bindings, []),
  columnMappings: () => readCollection<ColumnMapping[]>(COL.columnMappings, []),
  syncRuns: () => readCollection<SyncRun[]>(COL.syncRuns, []),
  activities: () => readCollection<ActivityPlanItem[]>(COL.activities, []),
  auth: () => readCollection<AuthRecord | null>(COL.auth, null),
  loginAttempts: () => readCollection<Record<string, LoginAttemptRecord>>(COL.loginAttempts, {}),
  write: writeCollection,
};

// ---------------------------------------------------------------------------
// Audit writer
// ---------------------------------------------------------------------------

export interface AuditInput {
  actorRole: Role;
  actorAccount: string;
  employeeId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
  success?: boolean;
  errorMessage?: string | null;
  sessionId?: string | null;
  deviceLabel?: string | null;
}

const AUDIT_CAP = 2000;

export function writeAudit(input: AuditInput): AuditEntry {
  const entry: AuditEntry = {
    id: uid('aud'),
    at: nowISO(),
    actorRole: input.actorRole,
    actorAccount: input.actorAccount,
    employeeId: input.employeeId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    entityLabel: input.entityLabel ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    success: input.success ?? true,
    errorMessage: input.errorMessage ?? null,
    sessionId: input.sessionId ?? null,
    deviceLabel: input.deviceLabel ?? null,
  };
  const all = db.audit();
  const next = [entry, ...all].slice(0, AUDIT_CAP);
  db.write(COL.audit, next);
  localBus.emit({ topic: 'audit' });
  return entry;
}
