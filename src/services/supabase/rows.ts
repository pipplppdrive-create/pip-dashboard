/** Bentuk baris tabel Postgres (snake_case) + konverter ke tipe domain. */
import type {
  AppSettings,
  Attachment,
  AuditEntry,
  BoardInfo,
  Category,
  ChecklistGroup,
  DistributionRow,
  DistributionSnapshot,
  Employee,
  Label,
  Role,
  SessionInfo,
  Step,
  Task,
  TaskComment,
  TaskTemplate,
} from '@/services/types';

export interface EmployeeRow {
  id: string;
  full_name: string;
  display_name: string;
  initials: string;
  color: string;
  position: string;
  team: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const toEmployee = (r: EmployeeRow): Employee => ({
  id: r.id,
  fullName: r.full_name,
  displayName: r.display_name,
  initials: r.initials,
  color: r.color,
  position: r.position,
  team: r.team,
  sortOrder: r.sort_order,
  active: r.active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface BoardRow {
  id: string;
  title: string;
  updated_at: string;
  version: number;
}

export const toBoard = (r: BoardRow): BoardInfo => ({
  id: r.id,
  title: r.title,
  updatedAt: r.updated_at,
  version: r.version,
});

export interface StepRow {
  id: string;
  board_id: string;
  name: string;
  kind: Step['kind'];
  color: string;
  sort_order: number;
  deleted_at: string | null;
  version: number;
}

export const toStep = (r: StepRow): Step => ({
  id: r.id,
  boardId: r.board_id,
  name: r.name,
  kind: r.kind,
  color: r.color,
  sortOrder: r.sort_order,
  deletedAt: r.deleted_at,
  version: r.version,
});

export interface TaskRow {
  id: string;
  board_id: string;
  step_id: string;
  title: string;
  description: string;
  duration_type: Task['durationType'];
  category_id: string | null;
  label_ids: string[];
  priority: Task['priority'];
  start_date: string | null;
  due_date: string | null;
  progress_mode: Task['progressMode'];
  manual_progress: number;
  pic_main_id: string | null;
  pic_ids: string[];
  checklist: ChecklistGroup[];
  is_focus: boolean;
  sort_order: number;
  archived_at: string | null;
  deleted_at: string | null;
  delete_reason: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  created_by_employee_id: string | null;
  updated_by_employee_id: string | null;
}

export const toTask = (r: TaskRow): Task => ({
  id: r.id,
  boardId: r.board_id,
  stepId: r.step_id,
  title: r.title,
  description: r.description,
  durationType: r.duration_type,
  categoryId: r.category_id,
  labelIds: r.label_ids ?? [],
  priority: r.priority,
  startDate: r.start_date,
  dueDate: r.due_date,
  progressMode: r.progress_mode,
  manualProgress: r.manual_progress,
  picMainId: r.pic_main_id,
  picIds: r.pic_ids ?? [],
  checklist: r.checklist ?? [],
  isFocus: r.is_focus,
  sortOrder: r.sort_order,
  archivedAt: r.archived_at,
  deletedAt: r.deleted_at,
  deleteReason: r.delete_reason,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  version: r.version,
  createdByEmployeeId: r.created_by_employee_id,
  updatedByEmployeeId: r.updated_by_employee_id,
});

export interface CommentRow {
  id: string;
  task_id: string;
  type: TaskComment['type'];
  text: string;
  employee_id: string;
  created_at: string;
}

export const toComment = (r: CommentRow): TaskComment => ({
  id: r.id,
  taskId: r.task_id,
  type: r.type,
  text: r.text,
  employeeId: r.employee_id,
  createdAt: r.created_at,
});

export interface AttachmentRow {
  id: string;
  task_id: string;
  file_name: string;
  size: number;
  mime_type: string;
  storage_path: string;
  uploaded_by_employee_id: string;
  created_at: string;
}

export const toAttachment = (r: AttachmentRow): Attachment => ({
  id: r.id,
  taskId: r.task_id,
  fileName: r.file_name,
  size: r.size,
  mimeType: r.mime_type,
  uploadedByEmployeeId: r.uploaded_by_employee_id,
  createdAt: r.created_at,
});

export interface TaxonomyRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  active: boolean;
}

export const toTaxonomy = (r: TaxonomyRow): Category | Label => ({
  id: r.id,
  name: r.name,
  color: r.color,
  sortOrder: r.sort_order,
  active: r.active,
});

export interface TemplateRow {
  id: string;
  name: string;
  title: string;
  description: string;
  category_id: string | null;
  label_ids: string[];
  duration_type: TaskTemplate['durationType'];
  priority: TaskTemplate['priority'];
  initial_step_id: string | null;
  target_offset_days: number | null;
  checklist: ChecklistGroup[];
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const toTemplate = (r: TemplateRow): TaskTemplate => ({
  id: r.id,
  name: r.name,
  title: r.title,
  description: r.description,
  categoryId: r.category_id,
  labelIds: r.label_ids ?? [],
  durationType: r.duration_type,
  priority: r.priority,
  initialStepId: r.initial_step_id,
  targetOffsetDays: r.target_offset_days,
  checklist: r.checklist ?? [],
  sortOrder: r.sort_order,
  active: r.active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface SnapshotRow {
  id: string;
  year: number;
  period: string;
  status: DistributionSnapshot['status'];
  rows: DistributionRow[];
  source_file_name: string | null;
  note: string | null;
  created_at: string;
  created_by_employee_id: string | null;
  activated_at: string | null;
  updated_at: string;
  version: number;
}

export const toSnapshot = (r: SnapshotRow): DistributionSnapshot => ({
  id: r.id,
  year: r.year,
  period: r.period,
  status: r.status,
  rows: r.rows ?? [],
  sourceFileName: r.source_file_name,
  note: r.note,
  createdAt: r.created_at,
  createdByEmployeeId: r.created_by_employee_id,
  activatedAt: r.activated_at,
  updatedAt: r.updated_at,
  version: r.version,
});

export interface AuditRow {
  id: string;
  at: string;
  actor_role: Role;
  actor_account: string;
  employee_id: string | null;
  action: AuditEntry['action'];
  entity_type: AuditEntry['entityType'];
  entity_id: string | null;
  entity_label: string | null;
  before: unknown;
  after: unknown;
  success: boolean;
  error_message: string | null;
  session_id: string | null;
  device_label: string | null;
}

export const toAudit = (r: AuditRow): AuditEntry => ({
  id: r.id,
  at: r.at,
  actorRole: r.actor_role,
  actorAccount: r.actor_account,
  employeeId: r.employee_id,
  action: r.action,
  entityType: r.entity_type,
  entityId: r.entity_id,
  entityLabel: r.entity_label,
  before: r.before,
  after: r.after,
  success: r.success,
  errorMessage: r.error_message,
  sessionId: r.session_id,
  deviceLabel: r.device_label,
});

export interface SessionRow {
  id: string;
  user_id: string;
  role: Role;
  account: string;
  device_label: string;
  created_at: string;
  last_active_at: string;
  revoked_at: string | null;
}

export const toSession = (r: SessionRow): SessionInfo => ({
  id: r.id,
  role: r.role,
  account: r.account,
  deviceLabel: r.device_label,
  createdAt: r.created_at,
  lastActiveAt: r.last_active_at,
  revokedAt: r.revoked_at,
});

export interface SettingsRow {
  id: number;
  app_name: string;
  logo_data_url: string | null;
  active_year: number;
  user_session_days: number;
  stale_days: number;
  attachment_max_mb: number;
  attachment_allowed_ext: string[];
  updated_at: string;
  version: number;
}

export const toSettings = (r: SettingsRow): AppSettings => ({
  appName: r.app_name,
  logoDataUrl: r.logo_data_url,
  activeYear: r.active_year,
  userSessionDays: r.user_session_days,
  staleDays: r.stale_days,
  attachmentMaxMB: r.attachment_max_mb,
  attachmentAllowedExt: r.attachment_allowed_ext ?? [],
  updatedAt: r.updated_at,
  version: r.version,
});
