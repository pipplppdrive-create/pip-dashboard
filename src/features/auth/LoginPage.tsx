import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { AlertCircle, KeyRound, Users } from 'lucide-react';
import { BrandMark } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { notify } from '@/components/feedback/toaster';
import { ROUTES } from '@/lib/routes';
import { errorMessage } from '@/services/errors';
import { useAppSettings } from '@/hooks/queries';
import { useSessionStore } from './session-store';

interface LocationState {
  from?: string;
}

export default function LoginPage() {
  const { status, session, loginUser, loginAdmin } = useSessionStore();
  const { data: settings } = useAppSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? ROUTES.dashboard;

  const [tab, setTab] = useState<'user' | 'admin'>('user');
  const [userPassword, setUserPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'ready' && session) {
    return <Navigate to={from} replace />;
  }

  const appName = settings?.appName ?? 'Dashboard PIP';

  async function handleUserSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userPassword) {
      setError('Masukkan password tim.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await loginUser(userPassword);
      notify.success('Selamat datang, Tim PIP!');
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdminSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminUsername || !adminPassword) {
      setError('Masukkan username dan password Admin.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await loginAdmin(adminUsername, adminPassword);
      notify.success('Selamat datang, Admin!');
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh bg-slate-100">
      {/* Panel brand — desktop */}
      <section
        aria-hidden
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-brand-950 to-brand-800 p-10 text-white lg:flex"
      >
        <div className="flex items-center gap-3">
          <BrandMark logoDataUrl={settings?.logoDataUrl ?? null} />
          <div>
            <p className="text-lg font-bold">{appName}</p>
            <p className="text-xs text-slate-300">Puslapdik · Kemendikdasmen</p>
          </div>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            Satu layar untuk penyaluran PIP dan pekerjaan tim.
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Pantau progres penyaluran per jenjang, kelola pekerjaan di board bersama, dan lihat
            aktivitas tim secara real-time — dari TV ruang kerja sampai ponsel.
          </p>
        </div>
        <p className="text-xs text-slate-400">Program Indonesia Pintar</p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -top-16 right-10 size-56 rounded-full bg-brand-400/10 blur-2xl" />
      </section>

      {/* Form login */}
      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark logoDataUrl={settings?.logoDataUrl ?? null} />
            <div>
              <p className="text-lg leading-tight font-bold text-slate-900">{appName}</p>
              <p className="text-xs text-slate-500">Puslapdik · Kemendikdasmen</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-(--shadow-card) sm:p-8">
            <h2 className="text-xl font-bold text-slate-900">Masuk</h2>
            <p className="mt-1 text-sm text-slate-500">
              Pilih jenis akun untuk mengakses dashboard.
            </p>

            <Tabs
              value={tab}
              onValueChange={(v) => {
                setTab(v as 'user' | 'admin');
                setError(null);
              }}
              className="mt-5"
            >
              <TabsList className="w-full">
                <TabsTrigger value="user" className="flex-1">
                  <Users className="size-4" aria-hidden />
                  Tim PIP
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex-1">
                  <KeyRound className="size-4" aria-hidden />
                  Admin
                </TabsTrigger>
              </TabsList>

              {error && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {error}
                </div>
              )}

              <TabsContent value="user">
                <form onSubmit={handleUserSubmit} className="mt-4 space-y-4">
                  <Field
                    label="Password tim"
                    hint="Satu akun bersama untuk seluruh pimpinan & staf. Cukup masuk sekali per perangkat."
                    required
                  >
                    <Input
                      type="password"
                      autoComplete="current-password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Password tim PIP"
                    />
                  </Field>
                  <Button type="submit" size="lg" className="w-full" loading={submitting}>
                    Masuk sebagai Tim
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="admin">
                <form onSubmit={handleAdminSubmit} className="mt-4 space-y-4">
                  <Field label="Username" required>
                    <Input
                      autoComplete="username"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="Username admin"
                    />
                  </Field>
                  <Field label="Password" required>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Password admin"
                    />
                  </Field>
                  <Button type="submit" size="lg" className="w-full" loading={submitting}>
                    Masuk sebagai Admin
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            Akses hanya untuk tim PIP Puslapdik.
          </p>
        </div>
      </section>
    </main>
  );
}
