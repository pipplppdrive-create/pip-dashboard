/**
 * DATA CONTOH (MOCK) — hanya untuk mode lokal/development.
 * Tidak dipakai oleh adapter produksi. Seluruh nama pegawai fiktif.
 * Data penyaluran hanya agregat per jenjang — tanpa data individual siswa.
 */
import type {
  AppSettings,
  AuditEntry,
  BoardInfo,
  Category,
  ChecklistGroup,
  DistributionRow,
  DistributionSnapshot,
  Employee,
  Jenjang,
  Label,
  Step,
  Task,
  TaskComment,
  TaskTemplate,
} from '@/services/types';

// ---------------------------------------------------------------------------
// Util waktu relatif — data contoh selalu tampak "hidup"
// ---------------------------------------------------------------------------

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const iso = (ms: number) => new Date(ms).toISOString();
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const now = Date.now();
const hoursAgo = (n: number) => iso(now - n * HOUR);
const daysAgo = (n: number) => iso(now - n * DAY);
const dateDaysAgo = (n: number) => isoDate(now - n * DAY);
const dateDaysFromNow = (n: number) => isoDate(now + n * DAY);

// ---------------------------------------------------------------------------
// Pegawai (fiktif)
// ---------------------------------------------------------------------------

interface EmployeeSpec {
  id: string;
  fullName: string;
  displayName: string;
  initials: string;
  color: string;
  position: string;
  team: string;
  active?: boolean;
}

const EMPLOYEES: EmployeeSpec[] = [
  { id: 'emp-bambang', fullName: 'Bambang Prasetyo', displayName: 'Bambang', initials: 'BP', color: 'blue', position: 'Ketua Tim PIP', team: 'Pimpinan Tim' },
  { id: 'emp-rina', fullName: 'Rina Wahyuni', displayName: 'Rina', initials: 'RW', color: 'emerald', position: 'Analis Kebijakan', team: 'Kebijakan & Regulasi' },
  { id: 'emp-andi', fullName: 'Andi Saputra', displayName: 'Andi', initials: 'AS', color: 'amber', position: 'Pengolah Data', team: 'Data & Sistem' },
  { id: 'emp-dewi', fullName: 'Dewi Lestari', displayName: 'Dewi', initials: 'DL', color: 'rose', position: 'Verifikator Penyaluran', team: 'Penyaluran' },
  { id: 'emp-fajar', fullName: 'Fajar Ramadhan', displayName: 'Fajar', initials: 'FR', color: 'violet', position: 'Pengembang Sistem', team: 'Data & Sistem' },
  { id: 'emp-siti', fullName: 'Siti Nurjanah', displayName: 'Siti', initials: 'SN', color: 'teal', position: 'Penata Keuangan', team: 'Keuangan' },
  { id: 'emp-hendra', fullName: 'Hendra Gunawan', displayName: 'Hendra', initials: 'HG', color: 'orange', position: 'Koordinator Rekonsiliasi', team: 'Penyaluran' },
  { id: 'emp-maya', fullName: 'Maya Anggraini', displayName: 'Maya', initials: 'MA', color: 'fuchsia', position: 'Penata Layanan', team: 'Layanan & Pengaduan' },
  { id: 'emp-yusuf', fullName: 'Yusuf Hidayat', displayName: 'Yusuf', initials: 'YH', color: 'sky', position: 'Analis Data', team: 'Data & Sistem' },
  { id: 'emp-putri', fullName: 'Putri Maharani', displayName: 'Putri', initials: 'PM', color: 'slate', position: 'Administrator Aplikasi', team: 'Data & Sistem' },
  { id: 'emp-agus', fullName: 'Agus Salim', displayName: 'Agus', initials: 'AG', color: 'orange', position: 'Staf Penyaluran', team: 'Penyaluran', active: false },
];

function buildEmployees(): Employee[] {
  return EMPLOYEES.map((e, i) => ({
    id: e.id,
    fullName: e.fullName,
    displayName: e.displayName,
    initials: e.initials,
    color: e.color,
    position: e.position,
    team: e.team,
    sortOrder: i,
    active: e.active ?? true,
    createdAt: daysAgo(400),
    updatedAt: daysAgo(30),
  }));
}

// ---------------------------------------------------------------------------
// Kategori & label
// ---------------------------------------------------------------------------

const CATEGORIES: Array<[string, string, string]> = [
  ['cat-penyaluran', 'Penyaluran', '#2361e3'],
  ['cat-sk', 'SK & Regulasi', '#7c3aed'],
  ['cat-rekon', 'Rekonsiliasi', '#0d9488'],
  ['cat-rapat', 'Rapat & Koordinasi', '#d97706'],
  ['cat-data', 'Data & Sistem', '#0284c7'],
  ['cat-layanan', 'Surat & Layanan', '#e11d48'],
];

const LABELS: Array<[string, string, string]> = [
  ['lbl-pimpinan', 'Prioritas Pimpinan', '#b91c1c'],
  ['lbl-termin1', 'Termin 1', '#1c4dc4'],
  ['lbl-termin2', 'Termin 2', '#0d9488'],
  ['lbl-termin3', 'Termin 3', '#7c3aed'],
  ['lbl-lintas', 'Lintas Tim', '#d97706'],
  ['lbl-eksternal', 'Menunggu Eksternal', '#64748b'],
  ['lbl-rutin', 'Rutin', '#059669'],
];

const buildCategories = (): Category[] =>
  CATEGORIES.map(([id, name, color], i) => ({ id, name, color, sortOrder: i, active: true }));

const buildLabels = (): Label[] =>
  LABELS.map(([id, name, color], i) => ({ id, name, color, sortOrder: i, active: true }));

// ---------------------------------------------------------------------------
// Board & step default
// ---------------------------------------------------------------------------

const buildBoard = (): BoardInfo => ({
  id: 'board-utama',
  title: 'Board Pekerjaan Tim PIP',
  updatedAt: daysAgo(2),
  version: 1,
});

const STEPS: Array<[string, string, Step['kind'], string]> = [
  ['step-willdo', 'Will Do', 'NORMAL', '#94a3b8'],
  ['step-todo', 'To Do', 'NORMAL', '#3579ee'],
  ['step-onprogress', 'On Progress', 'NORMAL', '#f59e0b'],
  ['step-blocking', 'Blocking', 'BLOCKED', '#ef4444'],
  ['step-done', 'Done', 'DONE', '#10b981'],
];

const buildSteps = (): Step[] =>
  STEPS.map(([id, name, kind, color], i) => ({
    id,
    boardId: 'board-utama',
    name,
    kind,
    color,
    sortOrder: i,
    deletedAt: null,
    version: 1,
  }));

// ---------------------------------------------------------------------------
// Checklist helper
// ---------------------------------------------------------------------------

let clSeq = 0;
function checklist(groups: Array<[string, Array<[string, boolean]>]>): ChecklistGroup[] {
  return groups.map(([title, items], gi) => ({
    id: `clg-${(clSeq += 1)}`,
    title,
    sortOrder: gi,
    items: items.map(([text, done], ii) => ({
      id: `cli-${clSeq}-${ii}`,
      text,
      done,
      sortOrder: ii,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Pekerjaan
// ---------------------------------------------------------------------------

type TaskSeed = Omit<
  Task,
  | 'boardId'
  | 'description'
  | 'categoryId'
  | 'labelIds'
  | 'startDate'
  | 'dueDate'
  | 'progressMode'
  | 'manualProgress'
  | 'picMainId'
  | 'picIds'
  | 'checklist'
  | 'isFocus'
  | 'archivedAt'
  | 'deletedAt'
  | 'deleteReason'
  | 'createdByEmployeeId'
  | 'updatedByEmployeeId'
> &
  Partial<Task>;

function task(seed: TaskSeed): Task {
  return {
    boardId: 'board-utama',
    description: '',
    categoryId: null,
    labelIds: [],
    startDate: null,
    dueDate: null,
    progressMode: 'MANUAL',
    manualProgress: 0,
    picMainId: null,
    picIds: [],
    checklist: [],
    isFocus: false,
    archivedAt: null,
    deletedAt: null,
    deleteReason: null,
    createdByEmployeeId: null,
    updatedByEmployeeId: null,
    ...seed,
  };
}

function buildTasks(): Task[] {
  return [
    task({
      id: 'task-sk-termin2',
      stepId: 'step-onprogress',
      title: 'Finalisasi SK Pemberian PIP Termin 2',
      description:
        'Menyelesaikan draf SK Pemberian termin 2 termasuk lampiran penerima per jenjang, paraf berjenjang, dan penomoran.',
      durationType: 'JANGKA_PANJANG',
      categoryId: 'cat-sk',
      labelIds: ['lbl-termin2', 'lbl-pimpinan'],
      priority: 'TINGGI',
      startDate: dateDaysAgo(12),
      dueDate: dateDaysFromNow(0),
      progressMode: 'CHECKLIST',
      picMainId: 'emp-rina',
      picIds: ['emp-bambang', 'emp-andi'],
      isFocus: true,
      checklist: checklist([
        [
          'Penyusunan draf',
          [
            ['Kompilasi lampiran penerima per jenjang', true],
            ['Reviu nominal per jenjang', true],
            ['Sinkronisasi dengan data pusat', true],
          ],
        ],
        [
          'Persetujuan',
          [
            ['Paraf koordinator', true],
            ['Paraf biro hukum', false],
            ['Tanda tangan pimpinan', false],
          ],
        ],
      ]),
      sortOrder: 0,
      createdAt: daysAgo(12),
      updatedAt: hoursAgo(2),
      version: 7,
      createdByEmployeeId: 'emp-rina',
      updatedByEmployeeId: 'emp-rina',
    }),
    task({
      id: 'task-rekon-juni',
      stepId: 'step-blocking',
      title: 'Rekonsiliasi penyaluran bank penyalur bulan Juni',
      description:
        'Mencocokkan data pencairan bank penyalur dengan data internal untuk periode Juni; selisih harus dijelaskan.',
      durationType: 'JANGKA_PANJANG',
      categoryId: 'cat-rekon',
      labelIds: ['lbl-eksternal'],
      priority: 'TINGGI',
      startDate: dateDaysAgo(14),
      dueDate: dateDaysAgo(3),
      progressMode: 'MANUAL',
      manualProgress: 65,
      picMainId: 'emp-hendra',
      picIds: ['emp-siti'],
      sortOrder: 0,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(1),
      version: 5,
      createdByEmployeeId: 'emp-hendra',
      updatedByEmployeeId: 'emp-hendra',
    }),
    task({
      id: 'task-aktivasi-sma',
      stepId: 'step-onprogress',
      title: 'Aktivasi rekening siswa SMA wilayah timur',
      description: 'Percepatan aktivasi rekening SimPel siswa SMA di wilayah timur bersama bank penyalur.',
      durationType: 'JANGKA_PANJANG',
      categoryId: 'cat-penyaluran',
      labelIds: ['lbl-termin2', 'lbl-eksternal'],
      priority: 'SEDANG',
      startDate: dateDaysAgo(9),
      dueDate: dateDaysFromNow(6),
      progressMode: 'CHECKLIST',
      picMainId: 'emp-dewi',
      picIds: [],
      checklist: checklist([
        [
          'Aktivasi',
          [
            ['Kirim daftar nominatif ke bank', true],
            ['Konfirmasi jadwal aktivasi kolektif', true],
            ['Monitoring aktivasi mingguan', false],
            ['Laporan akhir aktivasi', false],
          ],
        ],
      ]),
      sortOrder: 1,
      createdAt: daysAgo(9),
      updatedAt: hoursAgo(5),
      version: 4,
      createdByEmployeeId: 'emp-dewi',
      updatedByEmployeeId: 'emp-dewi',
    }),
    task({
      id: 'task-bahan-pimpinan',
      stepId: 'step-todo',
      title: 'Bahan paparan pimpinan: evaluasi penyaluran Juli',
      description: 'Menyiapkan bahan paparan rapat evaluasi bulanan pimpinan.',
      durationType: 'JANGKA_PENDEK',
      categoryId: 'cat-rapat',
      labelIds: ['lbl-pimpinan'],
      priority: 'TINGGI',
      startDate: dateDaysAgo(1),
      dueDate: dateDaysFromNow(1),
      progressMode: 'MANUAL',
      manualProgress: 20,
      picMainId: 'emp-maya',
      picIds: ['emp-yusuf'],
      isFocus: true,
      sortOrder: 0,
      createdAt: daysAgo(1),
      updatedAt: hoursAgo(1),
      version: 3,
      createdByEmployeeId: 'emp-maya',
      updatedByEmployeeId: 'emp-maya',
    }),
    task({
      id: 'task-dashboard-internal',
      stepId: 'step-onprogress',
      title: 'Pembaruan dashboard monitoring internal',
      description: 'Menambah indikator progres per jenjang dan perbaikan kinerja kueri.',
      durationType: 'JANGKA_PANJANG',
      categoryId: 'cat-data',
      labelIds: ['lbl-rutin'],
      priority: 'SEDANG',
      startDate: dateDaysAgo(20),
      progressMode: 'MANUAL',
      manualProgress: 80,
      picMainId: 'emp-fajar',
      picIds: ['emp-yusuf'],
      sortOrder: 2,
      createdAt: daysAgo(20),
      updatedAt: hoursAgo(0.5),
      version: 11,
      createdByEmployeeId: 'emp-fajar',
      updatedByEmployeeId: 'emp-yusuf',
    }),
    task({
      id: 'task-verifikasi-susulan',
      stepId: 'step-todo',
      title: 'Verifikasi usulan penerima tahap susulan',
      description: 'Verifikasi kelengkapan usulan penerima susulan dari dinas pendidikan.',
      durationType: 'JANGKA_PANJANG',
      categoryId: 'cat-penyaluran',
      labelIds: [],
      priority: 'SEDANG',
      startDate: dateDaysAgo(3),
      dueDate: dateDaysFromNow(4),
      progressMode: 'MANUAL',
      manualProgress: 0,
      sortOrder: 1,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
      version: 1,
      createdByEmployeeId: 'emp-dewi',
      updatedByEmployeeId: 'emp-dewi',
    }),
    task({
      id: 'task-data-dpr',
      stepId: 'step-willdo',
      title: 'Permintaan data penyaluran dari Komisi X DPR RI',
      description: 'Menyiapkan data agregat penyaluran per provinsi untuk bahan rapat dengar pendapat.',
      durationType: 'JANGKA_PENDEK',
      categoryId: 'cat-layanan',
      labelIds: ['lbl-pimpinan'],
      priority: 'TINGGI',
      dueDate: dateDaysFromNow(0),
      progressMode: 'MANUAL',
      manualProgress: 0,
      picMainId: 'emp-rina',
      picIds: [],
      sortOrder: 0,
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(6),
      version: 1,
      createdByEmployeeId: 'emp-rina',
      updatedByEmployeeId: 'emp-rina',
    }),
    task({
      id: 'task-juknis',
      stepId: 'step-willdo',
      title: 'Penyusunan juknis pencairan kolektif',
      description: 'Menyusun petunjuk teknis pencairan kolektif untuk sekolah daerah 3T.',
      durationType: 'JANGKA_PANJANG',
      categoryId: 'cat-sk',
      labelIds: [],
      priority: 'SEDANG',
      dueDate: dateDaysFromNow(20),
      progressMode: 'MANUAL',
      manualProgress: 10,
      picMainId: 'emp-andi',
      picIds: [],
      sortOrder: 1,
      createdAt: daysAgo(25),
      updatedAt: daysAgo(12),
      version: 2,
      createdByEmployeeId: 'emp-andi',
      updatedByEmployeeId: 'emp-andi',
    }),
    task({
      id: 'task-rapat-bank',
      stepId: 'step-done',
      title: 'Rapat koordinasi teknis dengan bank penyalur',
      description: 'Koordinasi percepatan aktivasi dan jadwal pencairan termin 2.',
      durationType: 'JANGKA_PENDEK',
      categoryId: 'cat-rapat',
      labelIds: ['lbl-lintas'],
      priority: 'SEDANG',
      startDate: dateDaysAgo(4),
      dueDate: dateDaysAgo(2),
      progressMode: 'CHECKLIST',
      picMainId: 'emp-hendra',
      picIds: ['emp-dewi', 'emp-siti'],
      checklist: checklist([
        [
          'Pelaksanaan',
          [
            ['Undangan & agenda', true],
            ['Bahan paparan', true],
            ['Pelaksanaan rapat', true],
            ['Notulen & tindak lanjut', true],
          ],
        ],
      ]),
      sortOrder: 0,
      createdAt: daysAgo(6),
      updatedAt: daysAgo(2),
      version: 6,
      createdByEmployeeId: 'emp-hendra',
      updatedByEmployeeId: 'emp-hendra',
    }),
    task({
      id: 'task-surat-jabar',
      stepId: 'step-done',
      title: 'Surat balasan Dinas Pendidikan Provinsi Jawa Barat',
      description: 'Balasan permohonan penjelasan mekanisme pemutakhiran data penerima.',
      durationType: 'JANGKA_PENDEK',
      categoryId: 'cat-layanan',
      labelIds: ['lbl-rutin'],
      priority: 'RENDAH',
      dueDate: dateDaysAgo(5),
      progressMode: 'MANUAL',
      manualProgress: 100,
      picMainId: 'emp-maya',
      picIds: [],
      sortOrder: 1,
      createdAt: daysAgo(8),
      updatedAt: daysAgo(5),
      version: 3,
      createdByEmployeeId: 'emp-maya',
      updatedByEmployeeId: 'emp-maya',
    }),
    task({
      id: 'task-pemutakhiran',
      stepId: 'step-onprogress',
      title: 'Pemutakhiran data penerima per jenjang',
      description: 'Sinkronisasi data penerima dengan Dapodik dan EMIS untuk semester berjalan.',
      durationType: 'JANGKA_PANJANG',
      categoryId: 'cat-data',
      labelIds: ['lbl-rutin', 'lbl-lintas'],
      priority: 'SEDANG',
      startDate: dateDaysAgo(15),
      dueDate: dateDaysFromNow(10),
      progressMode: 'CHECKLIST',
      picMainId: 'emp-andi',
      picIds: ['emp-yusuf'],
      checklist: checklist([
        [
          'Sinkronisasi',
          [
            ['Tarik data Dapodik', true],
            ['Tarik data EMIS', true],
            ['Padankan NISN ganda', true],
            ['Validasi anomali', false],
            ['Berita acara pemutakhiran', false],
          ],
        ],
        ['Kualitas data', [['Uji sampel 5%', true], ['Reviu tim kebijakan', false]]],
      ]),
      sortOrder: 3,
      createdAt: daysAgo(15),
      updatedAt: daysAgo(1),
      version: 8,
      createdByEmployeeId: 'emp-andi',
      updatedByEmployeeId: 'emp-andi',
    }),
    task({
      id: 'task-pengaduan',
      stepId: 'step-todo',
      title: 'Monitoring pengaduan layanan PIP minggu ke-29',
      description: 'Rekap pengaduan ULT dan media sosial, klasifikasi, dan distribusi tindak lanjut.',
      durationType: 'JANGKA_PENDEK',
      categoryId: 'cat-layanan',
      labelIds: ['lbl-rutin'],
      priority: 'RENDAH',
      dueDate: dateDaysFromNow(2),
      progressMode: 'MANUAL',
      manualProgress: 0,
      picMainId: 'emp-maya',
      picIds: [],
      sortOrder: 2,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
      version: 1,
      createdByEmployeeId: 'emp-maya',
      updatedByEmployeeId: 'emp-maya',
    }),
    task({
      id: 'task-evaluasi-sem1',
      stepId: 'step-blocking',
      title: 'Evaluasi capaian penyaluran semester 1',
      description: 'Analisis capaian penyaluran semester 1 sebagai bahan kebijakan semester 2.',
      durationType: 'JANGKA_PANJANG',
      categoryId: 'cat-penyaluran',
      labelIds: ['lbl-pimpinan', 'lbl-lintas'],
      priority: 'TINGGI',
      startDate: dateDaysAgo(7),
      dueDate: dateDaysFromNow(8),
      progressMode: 'MANUAL',
      manualProgress: 35,
      picMainId: 'emp-bambang',
      picIds: ['emp-rina', 'emp-hendra'],
      sortOrder: 1,
      createdAt: daysAgo(7),
      updatedAt: hoursAgo(26),
      version: 4,
      createdByEmployeeId: 'emp-bambang',
      updatedByEmployeeId: 'emp-rina',
    }),
    task({
      id: 'task-arsip-termin1',
      stepId: 'step-done',
      title: 'Penyaluran PIP Termin 1 tahun 2026',
      description: 'Seluruh rangkaian penyaluran termin 1: SK, aktivasi, pencairan, dan pelaporan.',
      durationType: 'JANGKA_PANJANG',
      categoryId: 'cat-penyaluran',
      labelIds: ['lbl-termin1'],
      priority: 'TINGGI',
      startDate: dateDaysAgo(150),
      dueDate: dateDaysAgo(40),
      progressMode: 'MANUAL',
      manualProgress: 100,
      picMainId: 'emp-dewi',
      picIds: ['emp-hendra', 'emp-siti'],
      archivedAt: daysAgo(30),
      sortOrder: 2,
      createdAt: daysAgo(150),
      updatedAt: daysAgo(30),
      version: 21,
      createdByEmployeeId: 'emp-dewi',
      updatedByEmployeeId: 'emp-dewi',
    }),
    task({
      id: 'task-arsip-sosialisasi',
      stepId: 'step-done',
      title: 'Sosialisasi juknis PIP 2026 ke dinas pendidikan',
      description: 'Rangkaian webinar sosialisasi juknis untuk 38 provinsi.',
      durationType: 'JANGKA_PANJANG',
      categoryId: 'cat-rapat',
      labelIds: [],
      priority: 'SEDANG',
      startDate: dateDaysAgo(120),
      dueDate: dateDaysAgo(60),
      progressMode: 'MANUAL',
      manualProgress: 100,
      picMainId: 'emp-maya',
      picIds: ['emp-rina'],
      archivedAt: daysAgo(45),
      sortOrder: 3,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(45),
      version: 9,
      createdByEmployeeId: 'emp-maya',
      updatedByEmployeeId: 'emp-maya',
    }),
    task({
      id: 'task-terhapus-demo',
      stepId: 'step-willdo',
      title: 'Uji coba formulir pengumpulan data lama',
      description: 'Duplikat dari pekerjaan pemutakhiran data.',
      durationType: 'JANGKA_PENDEK',
      categoryId: 'cat-data',
      labelIds: [],
      priority: 'RENDAH',
      progressMode: 'MANUAL',
      manualProgress: 0,
      picMainId: 'emp-yusuf',
      picIds: [],
      deletedAt: daysAgo(10),
      deleteReason: 'Duplikat dengan pekerjaan pemutakhiran data',
      sortOrder: 9,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(10),
      version: 2,
      createdByEmployeeId: 'emp-yusuf',
      updatedByEmployeeId: 'emp-yusuf',
    }),
  ];
}

// ---------------------------------------------------------------------------
// Komentar / kendala / tindak lanjut
// ---------------------------------------------------------------------------

function buildComments(): TaskComment[] {
  return [
    {
      id: 'cmt-1',
      taskId: 'task-sk-termin2',
      type: 'KOMENTAR',
      text: 'Lampiran penerima sudah final, menunggu jadwal paraf biro hukum.',
      employeeId: 'emp-rina',
      createdAt: hoursAgo(26),
    },
    {
      id: 'cmt-2',
      taskId: 'task-sk-termin2',
      type: 'KENDALA',
      text: 'Slot paraf biro hukum penuh sampai Kamis; berisiko menggeser penomoran SK.',
      employeeId: 'emp-rina',
      createdAt: hoursAgo(8),
    },
    {
      id: 'cmt-3',
      taskId: 'task-sk-termin2',
      type: 'TINDAK_LANJUT',
      text: 'Ketua tim mengirim nota dinas percepatan ke biro hukum hari ini.',
      employeeId: 'emp-bambang',
      createdAt: hoursAgo(2),
    },
    {
      id: 'cmt-4',
      taskId: 'task-rekon-juni',
      type: 'KENDALA',
      text: 'Bank belum mengirim rekening koran final; selisih 0,4% belum bisa dijelaskan.',
      employeeId: 'emp-hendra',
      createdAt: daysAgo(1),
    },
    {
      id: 'cmt-5',
      taskId: 'task-evaluasi-sem1',
      type: 'TINDAK_LANJUT',
      text: 'Sudah diminta data final ke bank melalui surat resmi minggu lalu.',
      employeeId: 'emp-rina',
      createdAt: daysAgo(4),
    },
    {
      id: 'cmt-6',
      taskId: 'task-evaluasi-sem1',
      type: 'KENDALA',
      text: 'Data final bank penyalur belum masuk; analisis tren belum bisa ditutup.',
      employeeId: 'emp-hendra',
      createdAt: hoursAgo(26),
    },
    {
      id: 'cmt-7',
      taskId: 'task-aktivasi-sma',
      type: 'KOMENTAR',
      text: 'Aktivasi minggu ini mencapai 68% dari target wilayah timur.',
      employeeId: 'emp-dewi',
      createdAt: hoursAgo(5),
    },
  ];
}

// ---------------------------------------------------------------------------
// Data penyaluran agregat (per jenjang) — tanpa data individual siswa
// ---------------------------------------------------------------------------

interface JenjangBase {
  alokasiSiswa: number;
  unit: number; // nominal bantuan per siswa per tahun
}

const BASE: Record<Jenjang, JenjangBase> = {
  SD: { alokasiSiswa: 10_400_000, unit: 450_000 },
  SMP: { alokasiSiswa: 4_400_000, unit: 750_000 },
  SMA: { alokasiSiswa: 1_350_000, unit: 1_800_000 },
  SMK: { alokasiSiswa: 1_850_000, unit: 1_800_000 },
};

/** Buat baris agregat dari rasio SK & salur per jenjang. */
function rows(sk: Record<Jenjang, number>, salur: Record<Jenjang, number>): DistributionRow[] {
  return (Object.keys(BASE) as Jenjang[]).map((j) => {
    const base = BASE[j];
    const skSiswa = Math.round(base.alokasiSiswa * sk[j]);
    const salurSiswa = Math.round(base.alokasiSiswa * salur[j]);
    return {
      jenjang: j,
      alokasiSiswa: base.alokasiSiswa,
      alokasiAnggaran: base.alokasiSiswa * base.unit,
      skSiswa,
      skAnggaran: skSiswa * base.unit,
      salurSiswa,
      salurAnggaran: salurSiswa * base.unit,
    };
  });
}

interface SnapshotSpec {
  id: string;
  year: number;
  period: string;
  status: DistributionSnapshot['status'];
  createdDaysAgo: number;
  activatedDaysAgo: number | null;
  sk: Record<Jenjang, number>;
  salur: Record<Jenjang, number>;
  note?: string;
  sourceFileName?: string;
}

const SNAPSHOTS: SnapshotSpec[] = [
  // Histori 2026 Termin 1 — beberapa versi untuk tren
  {
    id: 'snap-2026t1-feb',
    year: 2026,
    period: 'Termin 1',
    status: 'ARCHIVED',
    createdDaysAgo: 150,
    activatedDaysAgo: 149,
    sk: { SD: 0.42, SMP: 0.4, SMA: 0.38, SMK: 0.37 },
    salur: { SD: 0.12, SMP: 0.11, SMA: 0.09, SMK: 0.08 },
    sourceFileName: 'penyaluran-2026-t1-feb.xlsx',
  },
  {
    id: 'snap-2026t1-mar',
    year: 2026,
    period: 'Termin 1',
    status: 'ARCHIVED',
    createdDaysAgo: 120,
    activatedDaysAgo: 119,
    sk: { SD: 0.61, SMP: 0.58, SMA: 0.55, SMK: 0.53 },
    salur: { SD: 0.31, SMP: 0.28, SMA: 0.24, SMK: 0.22 },
    sourceFileName: 'penyaluran-2026-t1-mar.xlsx',
  },
  {
    id: 'snap-2026t1-apr',
    year: 2026,
    period: 'Termin 1',
    status: 'ARCHIVED',
    createdDaysAgo: 90,
    activatedDaysAgo: 89,
    sk: { SD: 0.78, SMP: 0.75, SMA: 0.7, SMK: 0.69 },
    salur: { SD: 0.52, SMP: 0.48, SMA: 0.43, SMK: 0.41 },
    sourceFileName: 'penyaluran-2026-t1-apr.xlsx',
  },
  {
    id: 'snap-2026t1-mei',
    year: 2026,
    period: 'Termin 1',
    status: 'ARCHIVED',
    createdDaysAgo: 60,
    activatedDaysAgo: 59,
    sk: { SD: 0.9, SMP: 0.88, SMA: 0.84, SMK: 0.82 },
    salur: { SD: 0.71, SMP: 0.67, SMA: 0.61, SMK: 0.58 },
    sourceFileName: 'penyaluran-2026-t1-mei.xlsx',
  },
  {
    id: 'snap-2026t1-jun',
    year: 2026,
    period: 'Termin 1',
    status: 'ARCHIVED',
    createdDaysAgo: 30,
    activatedDaysAgo: 29,
    sk: { SD: 0.95, SMP: 0.93, SMA: 0.9, SMK: 0.88 },
    salur: { SD: 0.82, SMP: 0.79, SMA: 0.73, SMK: 0.7 },
    sourceFileName: 'penyaluran-2026-t1-jun.xlsx',
  },
  {
    id: 'snap-2026t1-jul',
    year: 2026,
    period: 'Termin 1',
    status: 'ACTIVE',
    createdDaysAgo: 6,
    activatedDaysAgo: 5,
    sk: { SD: 0.97, SMP: 0.95, SMA: 0.93, SMK: 0.91 },
    salur: { SD: 0.88, SMP: 0.85, SMA: 0.8, SMK: 0.77 },
    sourceFileName: 'penyaluran-2026-t1-jul.xlsx',
    note: 'Pembaruan mingguan dari bank penyalur',
  },
  // Draft Termin 2 2026 (untuk demo alur aktivasi Admin)
  {
    id: 'snap-2026t2-draft',
    year: 2026,
    period: 'Termin 2',
    status: 'DRAFT',
    createdDaysAgo: 2,
    activatedDaysAgo: null,
    sk: { SD: 0.35, SMP: 0.33, SMA: 0.3, SMK: 0.28 },
    salur: { SD: 0.05, SMP: 0.04, SMA: 0.03, SMK: 0.03 },
    sourceFileName: 'penyaluran-2026-t2-awal.xlsx',
    note: 'Draft awal termin 2 — menunggu validasi',
  },
  // Tahun 2025 (histori tahun lalu)
  {
    id: 'snap-2025t3',
    year: 2025,
    period: 'Termin 3',
    status: 'ACTIVE',
    createdDaysAgo: 240,
    activatedDaysAgo: 239,
    sk: { SD: 0.99, SMP: 0.99, SMA: 0.98, SMK: 0.98 },
    salur: { SD: 0.985, SMP: 0.98, SMA: 0.975, SMK: 0.97 },
    sourceFileName: 'penyaluran-2025-final.xlsx',
    note: 'Data final tahun anggaran 2025',
  },
  {
    id: 'snap-2025t2',
    year: 2025,
    period: 'Termin 2',
    status: 'ARCHIVED',
    createdDaysAgo: 330,
    activatedDaysAgo: 329,
    sk: { SD: 0.93, SMP: 0.91, SMA: 0.9, SMK: 0.89 },
    salur: { SD: 0.78, SMP: 0.75, SMA: 0.72, SMK: 0.7 },
  },
  {
    id: 'snap-2025t1',
    year: 2025,
    period: 'Termin 1',
    status: 'ARCHIVED',
    createdDaysAgo: 420,
    activatedDaysAgo: 419,
    sk: { SD: 0.55, SMP: 0.52, SMA: 0.5, SMK: 0.48 },
    salur: { SD: 0.35, SMP: 0.32, SMA: 0.3, SMK: 0.28 },
  },
];

function buildSnapshots(): DistributionSnapshot[] {
  return SNAPSHOTS.map((s) => ({
    id: s.id,
    year: s.year,
    period: s.period,
    status: s.status,
    rows: rows(s.sk, s.salur),
    sourceFileName: s.sourceFileName ?? null,
    note: s.note ?? null,
    createdAt: daysAgo(s.createdDaysAgo),
    createdByEmployeeId: 'emp-putri',
    activatedAt: s.activatedDaysAgo === null ? null : daysAgo(s.activatedDaysAgo),
    updatedAt: daysAgo(s.activatedDaysAgo ?? s.createdDaysAgo),
    version: 1,
  }));
}

// ---------------------------------------------------------------------------
// Template pekerjaan
// ---------------------------------------------------------------------------

function buildTemplates(): TaskTemplate[] {
  return [
    {
      id: 'tpl-rapat',
      name: 'Rapat koordinasi',
      title: 'Rapat koordinasi: [topik]',
      description: 'Koordinasi terjadwal dengan pemangku kepentingan terkait.',
      categoryId: 'cat-rapat',
      labelIds: ['lbl-lintas'],
      durationType: 'JANGKA_PENDEK',
      priority: 'SEDANG',
      initialStepId: 'step-todo',
      targetOffsetDays: 3,
      checklist: checklist([
        [
          'Persiapan',
          [
            ['Susun agenda & undangan', false],
            ['Siapkan bahan paparan', false],
            ['Konfirmasi peserta', false],
          ],
        ],
        ['Pasca rapat', [['Notulen', false], ['Distribusi tindak lanjut', false]]],
      ]),
      sortOrder: 0,
      active: true,
      createdAt: daysAgo(200),
      updatedAt: daysAgo(60),
    },
    {
      id: 'tpl-permintaan-data',
      name: 'Permintaan data pimpinan',
      title: 'Permintaan data: [perihal]',
      description: 'Pemenuhan permintaan data agregat dari pimpinan/eksternal.',
      categoryId: 'cat-layanan',
      labelIds: ['lbl-pimpinan'],
      durationType: 'JANGKA_PENDEK',
      priority: 'TINGGI',
      initialStepId: 'step-todo',
      targetOffsetDays: 2,
      checklist: checklist([
        [
          'Pemenuhan',
          [
            ['Pahami kebutuhan & format', false],
            ['Tarik & olah data', false],
            ['Verifikasi silang', false],
            ['Kirim & arsipkan', false],
          ],
        ],
      ]),
      sortOrder: 1,
      active: true,
      createdAt: daysAgo(200),
      updatedAt: daysAgo(90),
    },
    {
      id: 'tpl-penyaluran',
      name: 'Penyaluran termin',
      title: 'Penyaluran PIP Termin [n] [tahun]',
      description: 'Rangkaian penyaluran satu termin: SK, aktivasi, pencairan, pelaporan.',
      categoryId: 'cat-penyaluran',
      labelIds: [],
      durationType: 'JANGKA_PANJANG',
      priority: 'TINGGI',
      initialStepId: 'step-willdo',
      targetOffsetDays: 45,
      checklist: checklist([
        [
          'Tahapan utama',
          [
            ['Finalisasi SK Pemberian', false],
            ['Kirim SP2D / daftar nominatif', false],
            ['Monitoring aktivasi rekening', false],
            ['Monitoring pencairan', false],
            ['Rekonsiliasi & pelaporan', false],
          ],
        ],
      ]),
      sortOrder: 2,
      active: true,
      createdAt: daysAgo(200),
      updatedAt: daysAgo(30),
    },
  ];
}

// ---------------------------------------------------------------------------
// Audit awal (menghidupkan feed aktivitas)
// ---------------------------------------------------------------------------

function buildAudit(): AuditEntry[] {
  const mk = (
    at: string,
    employeeId: string,
    action: AuditEntry['action'],
    entityType: AuditEntry['entityType'],
    entityId: string,
    entityLabel: string,
    before: unknown,
    after: unknown,
  ): AuditEntry => ({
    id: `aud-seed-${entityId}-${action}-${at}`,
    at,
    actorRole: 'USER',
    actorAccount: 'tim-pip',
    employeeId,
    action,
    entityType,
    entityId,
    entityLabel,
    before,
    after,
    success: true,
    errorMessage: null,
    sessionId: null,
    deviceLabel: 'Perangkat tim',
  });

  return [
    mk(hoursAgo(0.5), 'emp-yusuf', 'UPDATE', 'TASK', 'task-dashboard-internal', 'Pembaruan dashboard monitoring internal', { progress: 70 }, { progress: 80 }),
    mk(hoursAgo(1), 'emp-maya', 'UPDATE', 'TASK', 'task-bahan-pimpinan', 'Bahan paparan pimpinan: evaluasi penyaluran Juli', { progress: 0 }, { progress: 20 }),
    mk(hoursAgo(2), 'emp-bambang', 'UPDATE', 'TASK', 'task-sk-termin2', 'Finalisasi SK Pemberian PIP Termin 2', { checklist: '5/6' }, { checklist: '4/6' }),
    {
      ...mk(hoursAgo(5), 'emp-putri', 'ACTIVATE', 'SNAPSHOT', 'snap-2026t1-jul', 'Penyaluran 2026 · Termin 1', { status: 'DRAFT' }, { status: 'ACTIVE' }),
      actorRole: 'ADMIN',
      actorAccount: 'admin',
    },
    mk(hoursAgo(6), 'emp-rina', 'CREATE', 'TASK', 'task-data-dpr', 'Permintaan data penyaluran dari Komisi X DPR RI', null, { stepId: 'step-willdo' }),
    mk(hoursAgo(26), 'emp-rina', 'MOVE', 'TASK', 'task-evaluasi-sem1', 'Evaluasi capaian penyaluran semester 1', { step: 'On Progress' }, { step: 'Blocking' }),
    mk(daysAgo(1), 'emp-hendra', 'UPDATE', 'TASK', 'task-rekon-juni', 'Rekonsiliasi penyaluran bank penyalur bulan Juni', { progress: 50 }, { progress: 65 }),
    mk(daysAgo(2), 'emp-hendra', 'MOVE', 'TASK', 'task-rapat-bank', 'Rapat koordinasi teknis dengan bank penyalur', { step: 'On Progress' }, { step: 'Done' }),
    mk(daysAgo(2), 'emp-maya', 'UPDATE', 'TASK', 'task-pengaduan', 'Monitoring pengaduan layanan PIP minggu ke-29', null, { pic: 'Maya' }),
    mk(daysAgo(3), 'emp-dewi', 'CREATE', 'TASK', 'task-verifikasi-susulan', 'Verifikasi usulan penerima tahap susulan', null, { stepId: 'step-todo' }),
  ];
}

// ---------------------------------------------------------------------------
// Pengaturan
// ---------------------------------------------------------------------------

const buildSettings = (): AppSettings => ({
  appName: 'Dashboard PIP',
  logoDataUrl: null,
  activeYear: 2026,
  userSessionDays: 180,
  staleDays: 7,
  attachmentMaxMB: 10,
  attachmentAllowedExt: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'csv', 'txt'],
  updatedAt: daysAgo(30),
  version: 1,
});

// ---------------------------------------------------------------------------
// API seed
// ---------------------------------------------------------------------------

export interface SeedData {
  employees: Employee[];
  board: BoardInfo;
  steps: Step[];
  tasks: Task[];
  comments: TaskComment[];
  categories: Category[];
  labels: Label[];
  templates: TaskTemplate[];
  snapshots: DistributionSnapshot[];
  settings: AppSettings;
  audit: AuditEntry[];
}

export function buildSeedData(): SeedData {
  return {
    employees: buildEmployees(),
    board: buildBoard(),
    steps: buildSteps(),
    tasks: buildTasks(),
    comments: buildComments(),
    categories: buildCategories(),
    labels: buildLabels(),
    templates: buildTemplates(),
    snapshots: buildSnapshots(),
    settings: buildSettings(),
    audit: buildAudit(),
  };
}
