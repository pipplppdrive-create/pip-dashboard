import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ROUTES } from '@/lib/routes';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const BoardPage = lazy(() => import('@/features/board/BoardPage'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Memuat…
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-bold">Halaman tidak ditemukan</h1>
      <p className="text-slate-600">Alamat yang Anda buka tidak tersedia.</p>
      <a href={ROUTES.dashboard} className="font-semibold text-blue-700 underline">
        Kembali ke Dashboard
      </a>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to={ROUTES.dashboard} replace />} />
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route path={ROUTES.pekerjaan} element={<BoardPage />} />
          <Route path={`${ROUTES.admin}/*`} element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
