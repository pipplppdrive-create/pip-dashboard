/** Path route aplikasi — navigasi terkunci sesuai spesifikasi. */
export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  pekerjaan: '/pekerjaan',
  rencana: '/rencana-kegiatan',
  pegawai: '/daftar-pegawai',
  admin: '/admin',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
