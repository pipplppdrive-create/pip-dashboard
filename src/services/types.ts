/**
 * Kontrak domain & service Dashboard PIP Puslapdik.
 *
 * Seluruh fitur berbicara dengan backend melalui interface `DataService`.
 * Implementasi tersedia dalam dua adapter:
 *  - `local`    : data tersimpan di perangkat (development/demo tanpa credential)
 *  - `supabase` : backend produksi (Postgres + RLS + Realtime + Storage)
 */

// ---------------------------------------------------------------------------
// Enum & tipe dasar
// ---------------------------------------------------------------------------

export type Role = 'USER' | 'ADMIN';

export type Jenjang = 'SD' | 'SMP' | 'SMA' | 'SMK';

export const JENJANG_LIST: readonly Jenjang[] = ['SD', 'SMP', 'SMA', 'SMK'];

export type Priority = 'RENDAH' | 'SEDANG' | 'TINGGI';

export type DurationType = 'JANGKA_PANJANG' | 'JANGKA_PENDEK';

export type ProgressMode = 'MANUAL' | 'CHECKLIST';

/**
 * Perilaku step pada board.
 * - NORMAL  : step biasa.
 * - BLOCKED : kartu pada step ini dianggap terhambat (masuk "Perlu Perhatian").
 * - DONE    : kartu pada step ini dianggap selesai.
 * Penandaan lewat perilaku (bukan nama step) supaya nama step bebas diubah User.
 */
export type StepKind = 'NORMAL' | 'BLOCKED' | 'DONE';

export type CommentType = 'KOMENTAR' | 'KENDALA' | 'TINDAK_LANJUT';

export type SnapshotStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

// ---------------------------------------------------------------------------
// Entitas master
// ---------------------------------------------------------------------------

export interface Employee {
  id: string;
  /** Nama lengkap resmi. */
  fullName: string;
  /** Tag board satu kata (display tag) — unik di antara pegawai aktif. */
  displayName: string;
  initials: string;
  /** Warna avatar (token warna, bukan hex bebas). */
  color: string;
  /** NIP; null bila tidak tersedia. */
  nip: string | null;
  position: string;
  /** Instansi/tim penempatan. */
  team: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  active: boolean;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Board, step, pekerjaan
// ---------------------------------------------------------------------------

export interface BoardInfo {
  id: string;
  title: string;
  updatedAt: string;
  version: number;
}

export interface Step {
  id: string;
  boardId: string;
  name: string;
  kind: StepKind;
  color: string;
  sortOrder: number;
  /** Soft delete; step terhapus masuk Data Terhapus (Admin). */
  deletedAt: string | null;
  version: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  sortOrder: number;
}

export interface ChecklistGroup {
  id: string;
  title: string;
  sortOrder: number;
  items: ChecklistItem[];
}

export interface Task {
  id: string;
  boardId: string;
  stepId: string;
  title: string;
  description: string;
  durationType: DurationType;
  categoryId: string | null;
  labelIds: string[];
  priority: Priority;
  /** ISO date (yyyy-MM-dd) atau null. */
  startDate: string | null;
  dueDate: string | null;
  progressMode: ProgressMode;
  /** Nilai progres saat mode MANUAL (0–100). */
  manualProgress: number;
  picMainId: string | null;
  /** PIC tambahan (tidak termasuk PIC utama). */
  picIds: string[];
  checklist: ChecklistGroup[];
  /** Ditandai "Fokus Hari Ini". */
  isFocus: boolean;
  /** Urutan kartu dalam step. */
  sortOrder: number;
  archivedAt: string | null;
  deletedAt: string | null;
  deleteReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  createdByEmployeeId: string | null;
  updatedByEmployeeId: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  type: CommentType;
  text: string;
  employeeId: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  taskId: string;
  fileName: string;
  size: number;
  mimeType: string;
  uploadedByEmployeeId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Template pekerjaan
// ---------------------------------------------------------------------------

export interface TaskTemplate {
  id: string;
  /** Nama template pada daftar Admin. */
  name: string;
  title: string;
  description: string;
  categoryId: string | null;
  labelIds: string[];
  durationType: DurationType;
  priority: Priority;
  /** Step awal; null = step pertama board. */
  initialStepId: string | null;
  /** Target selesai relatif (hari sejak pembuatan); null = tanpa target. */
  targetOffsetDays: number | null;
  checklist: ChecklistGroup[];
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Data penyaluran (hanya agregat — tanpa data individual siswa)
// ---------------------------------------------------------------------------

export interface DistributionRow {
  jenjang: Jenjang;
  alokasiSiswa: number;
  alokasiAnggaran: number;
  /** Jumlah siswa pada SK Pemberian. */
  skSiswa: number;
  /** Nominal anggaran pada SK Pemberian. */
  skAnggaran: number;
  salurSiswa: number;
  salurAnggaran: number;
}

export interface DistributionSnapshot {
  id: string;
  year: number;
  /** Periode penyaluran, mis. "Termin 1". */
  period: string;
  status: SnapshotStatus;
  rows: DistributionRow[];
  sourceFileName: string | null;
  /** Catatan/alasan (upload, koreksi manual, pemulihan). */
  note: string | null;
  createdAt: string;
  createdByEmployeeId: string | null;
  activatedAt: string | null;
  updatedAt: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Audit & aktivitas
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'MOVE'
  | 'ARCHIVE'
  | 'UNARCHIVE'
  | 'SOFT_DELETE'
  | 'RESTORE'
  | 'PERMANENT_DELETE'
  | 'IMPORT'
  | 'ACTIVATE'
  | 'DEACTIVATE'
  | 'CORRECTION'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'REVOKE_SESSION'
  | 'SETTINGS_UPDATE'
  | 'PASSWORD_CHANGE'
  | 'BACKUP'
  | 'RESTORE_BACKUP'
  | 'SYNC';

export type AuditEntityType =
  | 'TASK'
  | 'STEP'
  | 'BOARD'
  | 'COMMENT'
  | 'ATTACHMENT'
  | 'EMPLOYEE'
  | 'CATEGORY'
  | 'LABEL'
  | 'TEMPLATE'
  | 'SNAPSHOT'
  | 'SETTINGS'
  | 'SESSION'
  | 'AUTH'
  | 'SPREADSHEET_SOURCE'
  | 'SYNC';

export interface AuditEntry {
  id: string;
  at: string;
  actorRole: Role;
  /** Nama akun autentikasi (akun bersama User / akun Admin). */
  actorAccount: string;
  /** Pegawai pelaku; null untuk kejadian tanpa pegawai (mis. percobaan login gagal). */
  employeeId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  /** Label entitas agar histori tetap terbaca setelah entitas berubah/terhapus. */
  entityLabel: string | null;
  before: unknown;
  after: unknown;
  success: boolean;
  errorMessage: string | null;
  sessionId: string | null;
  deviceLabel: string | null;
}

export type ActivityType =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'PROGRESS_CHANGED'
  | 'TASK_MOVED'
  | 'PIC_CHANGED'
  | 'TASK_COMPLETED'
  | 'DISTRIBUTION_UPDATED';

/** Proyeksi ramah-pengguna dari audit log untuk feed "Aktivitas terbaru". */
export interface ActivityEvent {
  id: string;
  at: string;
  type: ActivityType;
  employeeId: string | null;
  taskId: string | null;
  /** Judul entitas terkait (judul pekerjaan / label snapshot). */
  title: string;
  /** Keterangan tambahan, mis. "To Do → On Progress". */
  detail: string | null;
}

// ---------------------------------------------------------------------------
// Integrasi Google Sheets (read-only) — sumber data penyaluran & Rencana Kegiatan
// ---------------------------------------------------------------------------

export type SpreadsheetSourceType = 'pip_progress' | 'activity_plan';

export type SyncStatus = 'BELUM_SINKRON' | 'BERHASIL' | 'PERLU_VALIDASI' | 'GAGAL';

export type SyncTrigger = 'MANUAL' | 'WEBHOOK' | 'JADWAL';

export type MappingStatus = 'BELUM_DIKONFIRMASI' | 'TERKONFIRMASI' | 'PERLU_VALIDASI';

/** Sumber spreadsheet terdaftar (per jenis, per tahun). */
export interface SpreadsheetSource {
  id: string;
  sourceType: SpreadsheetSourceType;
  year: number;
  name: string;
  spreadsheetUrl: string;
  spreadsheetId: string;
  isActive: boolean;
  /** Sumber utama untuk (jenis, tahun) — dipakai Dashboard/Rencana Kegiatan. */
  isPrimary: boolean;
  syncMode: 'WEBHOOK_DAN_INTERVAL' | 'MANUAL';
  lastSyncedAt: string | null;
  lastSyncStatus: SyncStatus;
  lastError: string | null;
  createdByEmployeeId: string | null;
  updatedByEmployeeId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Satu sumber dapat membaca lebih dari satu sheet (mis. Pemberian + REKAP PROGRESS). */
export interface SheetBinding {
  id: string;
  sourceId: string;
  bindingType: 'detail_realisasi' | 'allocation_summary' | 'activity_rows';
  sheetName: string;
  headerRow: number;
  dataStartRow: number;
  optionalRange: string | null;
  mappingStatus: MappingStatus;
}

/** Mapping kolom berbasis header (bukan posisi kolom). */
export interface ColumnMapping {
  id: string;
  bindingId: string;
  detectedHeader: string;
  targetField: string;
  parserType: 'text' | 'number' | 'currency' | 'date' | 'time' | 'percent';
  transformRule: string | null;
  required: boolean;
  validationStatus: 'VALID' | 'BELUM_DIVALIDASI' | 'TIDAK_VALID';
}

/** Catatan satu proses sinkronisasi. */
export interface SyncRun {
  id: string;
  sourceId: string;
  trigger: SyncTrigger;
  status: SyncStatus;
  startedAt: string;
  finishedAt: string | null;
  rowsRead: number;
  rowsUpserted: number;
  message: string | null;
  errorMessage: string | null;
}

/** Status koneksi Google milik Admin (tanpa nilai token). */
export interface GoogleConnectionStatus {
  /** Env Google OAuth terpasang di server. */
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  lastUsedAt: string | null;
  tokenStatus: 'AKTIF' | 'KEDALUWARSA' | 'DICABUT' | null;
}

// ---------------------------------------------------------------------------
// Rencana Kegiatan (read-only dari spreadsheet)
// ---------------------------------------------------------------------------

export type ActivityStatus =
  | 'RENCANA'
  | 'TERJADWAL'
  | 'BERLANGSUNG'
  | 'SELESAI'
  | 'DITUNDA'
  | 'DIBATALKAN';

export const ACTIVITY_STATUS_LIST: readonly ActivityStatus[] = [
  'RENCANA',
  'TERJADWAL',
  'BERLANGSUNG',
  'SELESAI',
  'DITUNDA',
  'DIBATALKAN',
];

export interface ActivityPlanItem {
  id: string;
  sourceId: string | null;
  year: number;
  title: string;
  /** ISO date (yyyy-MM-dd). */
  startDate: string;
  /** ISO date; sama dengan startDate bila hanya satu tanggal. */
  endDate: string;
  /** HH:mm atau null (all day). */
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string;
  category: string;
  /** Nama PIC persis dari spreadsheet (tidak dihapus walau tak cocok pegawai). */
  picNames: string[];
  /** PIC yang berhasil dipetakan ke pegawai. */
  picEmployeeIds: string[];
  participants: string;
  status: ActivityStatus;
  notes: string;
  meetingLink: string | null;
  documentLink: string | null;
  sourceRowKey: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Sesi & pengaturan
// ---------------------------------------------------------------------------

export interface SessionInfo {
  id: string;
  role: Role;
  account: string;
  deviceLabel: string;
  createdAt: string;
  lastActiveAt: string;
  revokedAt: string | null;
}

export interface AuthState {
  session: SessionInfo | null;
  role: Role | null;
}

export interface AppSettings {
  appName: string;
  /** Logo (data URL kecil) atau null untuk logo bawaan. */
  logoDataUrl: string | null;
  activeYear: number;
  /** Durasi sesi User (hari). */
  userSessionDays: number;
  /** Ambang "lama tidak diperbarui" (hari) untuk Perlu Perhatian. */
  staleDays: number;
  attachmentMaxMB: number;
  /** Ekstensi file lampiran yang diizinkan (tanpa titik, lowercase). */
  attachmentAllowedExt: string[];
  updatedAt: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Event realtime
// ---------------------------------------------------------------------------

export type ChangeTopic =
  | 'board'
  | 'steps'
  | 'tasks'
  | 'comments'
  | 'attachments'
  | 'employees'
  | 'categories'
  | 'labels'
  | 'templates'
  | 'distribution'
  | 'activities'
  | 'integrations'
  | 'settings'
  | 'sessions'
  | 'audit';

export interface ChangeEvent {
  topic: ChangeTopic;
  /** Id entitas yang berubah (bila tersedia). */
  entityId?: string;
  /** Sesi yang dicabut — dipakai klien untuk logout paksa. */
  revokedSessionId?: string;
}

export type Unsubscribe = () => void;

// ---------------------------------------------------------------------------
// Input service
// ---------------------------------------------------------------------------

/** Konteks pelaku untuk setiap mutasi penting. */
export interface ActorContext {
  employeeId: string;
}

export interface TaskCreateInput {
  title: string;
  description?: string;
  stepId: string;
  durationType: DurationType;
  categoryId?: string | null;
  labelIds?: string[];
  priority: Priority;
  startDate?: string | null;
  dueDate?: string | null;
  progressMode?: ProgressMode;
  manualProgress?: number;
  picMainId?: string | null;
  picIds?: string[];
  checklist?: ChecklistGroup[];
  isFocus?: boolean;
}

export type TaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'description'
    | 'durationType'
    | 'categoryId'
    | 'labelIds'
    | 'priority'
    | 'startDate'
    | 'dueDate'
    | 'progressMode'
    | 'manualProgress'
    | 'picMainId'
    | 'picIds'
    | 'checklist'
    | 'isFocus'
  >
>;

export interface EmployeeInput {
  fullName: string;
  displayName: string;
  initials: string;
  color: string;
  nip?: string | null;
  position: string;
  team: string;
  sortOrder?: number;
  active?: boolean;
}

export interface SnapshotCreateInput {
  year: number;
  period: string;
  rows: DistributionRow[];
  sourceFileName?: string | null;
  note?: string | null;
}

export interface AuditFilter {
  action?: AuditAction;
  entityType?: AuditEntityType;
  employeeId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface BackupPayload {
  exportedAt: string;
  appVersion: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Interface service
// ---------------------------------------------------------------------------

export interface AuthService {
  getState(): Promise<AuthState>;
  /**
   * Login terpadu: satu form untuk seluruh akun. Role (USER/ADMIN) ditentukan
   * SETELAH kredensial terverifikasi — tidak ada pemilihan role di halaman login.
   */
  login(username: string, password: string): Promise<SessionInfo>;
  logout(): Promise<void>;
  /** Daftar sesi aktif/riwayat sesi (Admin). */
  listSessions(): Promise<SessionInfo[]>;
  revokeSession(sessionId: string): Promise<void>;
}

export interface EmployeeService {
  list(opts?: { includeInactive?: boolean }): Promise<Employee[]>;
  create(input: EmployeeInput, ctx: ActorContext): Promise<Employee>;
  update(id: string, patch: Partial<EmployeeInput>, ctx: ActorContext): Promise<Employee>;
  setActive(id: string, active: boolean, ctx: ActorContext): Promise<Employee>;
  reorder(orderedIds: string[], ctx: ActorContext): Promise<void>;
}

export interface BoardService {
  get(): Promise<BoardInfo>;
  rename(title: string, expectedVersion: number, ctx: ActorContext): Promise<BoardInfo>;
  listSteps(opts?: { includeDeleted?: boolean }): Promise<Step[]>;
  createStep(input: { name: string; kind?: StepKind; color?: string }, ctx: ActorContext): Promise<Step>;
  updateStep(
    id: string,
    patch: Partial<Pick<Step, 'name' | 'kind' | 'color'>>,
    expectedVersion: number,
    ctx: ActorContext,
  ): Promise<Step>;
  reorderSteps(orderedIds: string[], ctx: ActorContext): Promise<void>;
  /**
   * Hapus step (soft delete).
   * Step berisi kartu wajib menyertakan `moveCardsToStepId`; seluruh kartu
   * dipindahkan lebih dulu — kartu tidak boleh hilang.
   */
  deleteStep(id: string, opts: { moveCardsToStepId?: string }, ctx: ActorContext): Promise<void>;
  restoreStep(id: string, ctx: ActorContext): Promise<Step>;
}

export interface TaskService {
  list(opts?: { includeArchived?: boolean; includeDeleted?: boolean }): Promise<Task[]>;
  get(id: string): Promise<Task>;
  create(input: TaskCreateInput, ctx: ActorContext): Promise<Task>;
  update(id: string, patch: TaskPatch, expectedVersion: number, ctx: ActorContext): Promise<Task>;
  move(
    id: string,
    to: { stepId: string; index: number },
    ctx: ActorContext,
  ): Promise<Task>;
  archive(id: string, ctx: ActorContext): Promise<Task>;
  unarchive(id: string, ctx: ActorContext): Promise<Task>;
  softDelete(id: string, reason: string, ctx: ActorContext): Promise<void>;
  restore(id: string, ctx: ActorContext): Promise<Task>;
  /** Hanya Admin. */
  permanentDelete(id: string, ctx: ActorContext): Promise<void>;
  listComments(taskId: string): Promise<TaskComment[]>;
  /** Seluruh komentar (untuk analisis "memerlukan tindak lanjut" di Dashboard). */
  listAllComments(): Promise<TaskComment[]>;
  addComment(taskId: string, type: CommentType, text: string, ctx: ActorContext): Promise<TaskComment>;
  history(taskId: string): Promise<AuditEntry[]>;
}

export interface AttachmentService {
  list(taskId: string): Promise<Attachment[]>;
  upload(taskId: string, file: File, ctx: ActorContext): Promise<Attachment>;
  /** URL unduh berumur pendek (signed URL di produksi, object URL di mode lokal). */
  getDownloadUrl(id: string): Promise<string>;
  remove(id: string, ctx: ActorContext): Promise<void>;
}

export interface TaxonomyService {
  listCategories(opts?: { includeInactive?: boolean }): Promise<Category[]>;
  saveCategory(
    input: { id?: string; name: string; color: string; active?: boolean },
    ctx: ActorContext,
  ): Promise<Category>;
  reorderCategories(orderedIds: string[], ctx: ActorContext): Promise<void>;
  listLabels(opts?: { includeInactive?: boolean }): Promise<Label[]>;
  saveLabel(
    input: { id?: string; name: string; color: string; active?: boolean },
    ctx: ActorContext,
  ): Promise<Label>;
  reorderLabels(orderedIds: string[], ctx: ActorContext): Promise<void>;
}

export interface TemplateService {
  list(opts?: { includeInactive?: boolean }): Promise<TaskTemplate[]>;
  save(
    input: Omit<TaskTemplate, 'createdAt' | 'updatedAt' | 'sortOrder' | 'id'> & { id?: string },
    ctx: ActorContext,
  ): Promise<TaskTemplate>;
  remove(id: string, ctx: ActorContext): Promise<void>;
  reorder(orderedIds: string[], ctx: ActorContext): Promise<void>;
}

export interface DistributionService {
  /** Snapshot aktif untuk scope (tahun, periode); null bila belum ada. */
  getActive(year?: number, period?: string): Promise<DistributionSnapshot | null>;
  /** Seluruh snapshot (histori, draft, arsip). */
  list(): Promise<DistributionSnapshot[]>;
  get(id: string): Promise<DistributionSnapshot>;
  /** Simpan draft hasil upload/mapping/validasi. */
  createDraft(input: SnapshotCreateInput, ctx: ActorContext): Promise<DistributionSnapshot>;
  /** Aktifkan snapshot; snapshot aktif lain pada scope sama diarsipkan. */
  activate(id: string, ctx: ActorContext): Promise<DistributionSnapshot>;
  /** Batalkan aktivasi (kembali ke draft/arsip tanpa snapshot aktif). */
  deactivate(id: string, ctx: ActorContext): Promise<DistributionSnapshot>;
  /** Koreksi manual dengan alasan → membuat snapshot baru yang langsung aktif. */
  correct(
    id: string,
    rows: DistributionRow[],
    reason: string,
    ctx: ActorContext,
  ): Promise<DistributionSnapshot>;
  remove(id: string, ctx: ActorContext): Promise<void>;
  /** Daftar (tahun, periode) yang tersedia untuk filter Dashboard. */
  listScopes(): Promise<{ year: number; period: string }[]>;
}

export interface AuditReadService {
  list(filter?: AuditFilter): Promise<{ entries: AuditEntry[]; total: number }>;
  recentActivity(limit?: number): Promise<ActivityEvent[]>;
}

export interface SettingsService {
  get(): Promise<AppSettings>;
  update(
    patch: Partial<Omit<AppSettings, 'updatedAt' | 'version'>>,
    expectedVersion: number,
    ctx: ActorContext,
  ): Promise<AppSettings>;
  changeUserPassword(newPassword: string, ctx: ActorContext): Promise<void>;
  exportBackup(): Promise<BackupPayload>;
  importBackup(payload: BackupPayload, ctx: ActorContext): Promise<void>;
}

export interface RealtimeService {
  subscribe(listener: (event: ChangeEvent) => void): Unsubscribe;
}

export interface SpreadsheetSourceInput {
  id?: string;
  sourceType: SpreadsheetSourceType;
  year: number;
  name: string;
  spreadsheetUrl: string;
  isActive?: boolean;
  syncMode?: SpreadsheetSource['syncMode'];
}

/**
 * Integrasi Google Sheets — read-only. Data tidak pernah ditulis balik ke
 * spreadsheet; Supabase berfungsi sebagai cache/snapshot/histori.
 */
export interface IntegrationService {
  listSources(opts?: {
    includeInactive?: boolean;
    includeDeleted?: boolean;
  }): Promise<SpreadsheetSource[]>;
  saveSource(input: SpreadsheetSourceInput, ctx: ActorContext): Promise<SpreadsheetSource>;
  setSourceActive(id: string, active: boolean, ctx: ActorContext): Promise<SpreadsheetSource>;
  /** Soft delete — sumber masuk Data Terhapus. */
  archiveSource(id: string, ctx: ActorContext): Promise<void>;
  restoreSource(id: string, ctx: ActorContext): Promise<SpreadsheetSource>;
  setPrimary(id: string, ctx: ActorContext): Promise<SpreadsheetSource>;
  listBindings(sourceId: string): Promise<SheetBinding[]>;
  listMappings(bindingId: string): Promise<ColumnMapping[]>;
  /** Konfirmasi mapping hasil deteksi header — sinkronisasi aktif setelah ini. */
  confirmMapping(sourceId: string, bindingId: string, ctx: ActorContext): Promise<SheetBinding>;
  listSyncRuns(opts?: { sourceId?: string; limit?: number }): Promise<SyncRun[]>;
  /** Status koneksi Google Admin — tanpa nilai rahasia. */
  googleStatus(): Promise<GoogleConnectionStatus>;
  /** Tes akses spreadsheet + keberadaan sheet wajib. */
  testConnection(sourceId: string): Promise<{ ok: boolean; message: string; sheets?: string[] }>;
  /** Preview baris awal sheet (deteksi header) — null bila belum terhubung. */
  preview(
    sourceId: string,
    bindingId: string,
  ): Promise<{ headers: string[]; rows: string[][] } | null>;
  /** Sinkronkan sekarang (fallback manual). */
  syncNow(sourceId: string, ctx: ActorContext): Promise<SyncRun>;
}

/** Rencana Kegiatan — read-only; perbaikan data dilakukan di spreadsheet. */
export interface ActivityPlanService {
  list(opts?: { year?: number }): Promise<ActivityPlanItem[]>;
  listYears(): Promise<number[]>;
  /** Info sumber & sinkronisasi terakhir untuk tahun tertentu. */
  syncInfo(year?: number): Promise<{ source: SpreadsheetSource | null; lastRun: SyncRun | null }>;
}

export interface DataService {
  readonly mode: 'local' | 'supabase';
  auth: AuthService;
  employees: EmployeeService;
  board: BoardService;
  tasks: TaskService;
  attachments: AttachmentService;
  taxonomy: TaxonomyService;
  templates: TemplateService;
  distribution: DistributionService;
  integrations: IntegrationService;
  activities: ActivityPlanService;
  audit: AuditReadService;
  settings: SettingsService;
  realtime: RealtimeService;
}
