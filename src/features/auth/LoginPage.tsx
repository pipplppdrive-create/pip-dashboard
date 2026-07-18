import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { AlertCircle, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { BrandMark } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/feedback/toaster';
import { ROUTES } from '@/lib/routes';
import { errorMessage } from '@/services/errors';
import { useAppSettings } from '@/hooks/queries';
import { Mascot, type MascotMood } from './Mascot';
import { useSessionStore } from './session-store';

interface LocationState {
  from?: string;
}

/**
 * Halaman login TERPADU (Docs/09 §C, §D):
 * satu form Username + Password untuk seluruh akun — role (USER/ADMIN)
 * ditentukan server SETELAH kredensial terverifikasi. Tidak ada pemilihan
 * role dan tidak ada tombol "Masuk dengan Google".
 */
export default function LoginPage() {
  const { status, session, login } = useSessionStore();
  const { data: settings } = useAppSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? ROUTES.dashboard;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);
  const flashTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  if (status === 'ready' && session) {
    return <Navigate to={from} replace />;
  }

  const appName = settings?.appName ?? 'Dashboard PIP';

  // Prioritas mood: hasil login > interaksi password > idle.
  const mood: MascotMood = flash === 'success'
    ? 'success'
    : flash === 'error'
      ? 'error'
      : passwordFocus && password && showPassword
        ? 'peeking'
        : passwordFocus && password
          ? 'covering'
          : passwordFocus
            ? 'watching'
            : 'idle';

  function setFlashMood(kind: 'success' | 'error') {
    setFlash(kind);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), kind === 'error' ? 1400 : 4000);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Masukkan username dan password Anda.');
      setFlashMood('error');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const role = await login(username, password);
      setFlashMood('success');
      notify.success(role === 'ADMIN' ? 'Selamat datang, Admin!' : 'Selamat datang, Tim PIP!');
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setFlashMood('error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4 sm:p-6">
      {/* Ornamen latar — gradient lembut, ringan dimuat (murni CSS) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 size-96 rounded-full bg-gradient-to-br from-brand-200/70 to-cyan-200/50 blur-3xl" />
        <div className="absolute -right-28 -bottom-36 size-[28rem] rounded-full bg-gradient-to-tr from-violet-200/60 to-pink-200/40 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 size-40 rounded-full bg-emerald-200/40 blur-2xl" />
        {/* Bentuk geometris kecil senada maskot */}
        <div className="absolute top-16 right-[12%] hidden size-10 rotate-12 rounded-2xl bg-gradient-to-br from-cyan-300/60 to-brand-300/60 lg:block" />
        <div className="absolute bottom-20 left-[10%] hidden size-6 rounded-full bg-amber-300/70 lg:block" />
        <div className="absolute top-[55%] left-[16%] hidden h-4 w-9 rounded-full bg-violet-300/60 lg:block" />
      </div>

      <div className="relative grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Panel sambutan — desktop */}
        <section aria-hidden className="hidden flex-col gap-6 p-4 lg:flex">
          <div className="flex items-center gap-3">
            <BrandMark logoDataUrl={settings?.logoDataUrl ?? null} />
            <div>
              <p className="text-lg leading-tight font-bold text-slate-900">{appName}</p>
              <p className="text-xs font-medium text-slate-500">Puslapdik · Kemendikdasmen</p>
            </div>
          </div>
          <h1 className="max-w-md bg-(image:--gradient-brand) bg-clip-text text-4xl leading-tight font-extrabold tracking-tight text-transparent">
            Satu layar untuk penyaluran PIP dan pekerjaan tim.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-500">
            Pantau progres penyaluran per jenjang, kelola pekerjaan bersama, dan lihat rencana
            kegiatan — dari TV ruang kerja sampai ponsel.
          </p>
          <Mascot mood={mood} className="max-w-sm" />
        </section>

        {/* Kartu login */}
        <section className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark logoDataUrl={settings?.logoDataUrl ?? null} />
            <div>
              <p className="text-lg leading-tight font-bold text-slate-900">{appName}</p>
              <p className="text-xs font-medium text-slate-500">Puslapdik · Kemendikdasmen</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-(--shadow-pop) backdrop-blur sm:p-8">
            <Mascot mood={mood} className="mx-auto -mt-2 mb-2 max-w-56 lg:hidden" />
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Masuk</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gunakan akun yang diberikan pengelola. Peran akun dikenali otomatis setelah masuk.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <Field label="Username" required>
                <div className="relative">
                  <UserRound
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    autoComplete="username"
                    className="pl-10"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                  />
                </div>
              </Field>
              <Field label="Password" required>
                <div className="relative">
                  <LockKeyhole
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-11 pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocus(true)}
                    onBlur={() => setPasswordFocus(false)}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    aria-pressed={showPassword}
                    className="pressable absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4.5" aria-hidden />
                    ) : (
                      <Eye className="size-4.5" aria-hidden />
                    )}
                  </button>
                </div>
              </Field>
              <Button type="submit" size="lg" className="w-full" loading={submitting}>
                Masuk
              </Button>
            </form>
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            Akses hanya untuk tim PIP Puslapdik · Program Indonesia Pintar
          </p>
        </section>
      </div>
    </main>
  );
}
