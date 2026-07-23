import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/layout/BrandMark';
import { notify } from '@/components/feedback/toaster';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/lib/routes';
import { errorMessage } from '@/services/errors';
import { getDataService } from '@/services';
import { useAppSettings } from '@/hooks/queries';
import { validatePassword } from './password-policy';
import { useSessionStore } from './session-store';

/**
 * Gerbang WAJIB GANTI PASSWORD (spesifikasi §E).
 *
 * Selama `mustChangePassword` bernilai true, pengguna tidak dapat mengakses
 * aplikasi utama — hanya layar ini dan tombol keluar yang tersedia.
 */
export function ForcePasswordChange() {
  const refresh = useSessionStore((s) => s.refresh);
  const logout = useSessionStore((s) => s.logout);
  const { data: settings } = useAppSettings();
  const navigate = useNavigate();

  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = validatePassword(next, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await getDataService().auth.changeOwnPassword(next);
      await refresh();
      notify.success('Password berhasil diganti. Selamat bekerja!');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate(ROUTES.login, { replace: true });
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 size-96 rounded-full bg-gradient-to-br from-brand-200/70 to-cyan-200/50 blur-3xl" />
        <div className="absolute -right-28 -bottom-36 size-[28rem] rounded-full bg-gradient-to-tr from-violet-200/60 to-pink-200/40 blur-3xl" />
      </div>

      <section className="relative w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark logoDataUrl={settings?.logoDataUrl ?? null} />
          <div>
            <p className="text-lg leading-tight font-bold text-slate-900">
              {settings?.appName ?? 'Dashboard PIP'}
            </p>
            <p className="text-xs font-medium text-slate-500">Puslapdik · Kemendikdasmen</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-(--shadow-pop) backdrop-blur sm:p-8">
          <span
            aria-hidden
            className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-(image:--gradient-brand-soft) text-brand-700"
          >
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Buat password baru Anda
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Password sementara hanya untuk masuk pertama kali. Buat password pribadi sebelum
            melanjutkan.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
            >
              {error}
            </p>
          )}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Password baru" required hint="Minimal 8 karakter.">
              <div className="relative">
                <LockKeyhole
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-slate-400"
                />
                <Input
                  aria-label="Password baru"
                  autoFocus
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-11 pl-10"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={show}
                  className="pressable absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  {show ? (
                    <EyeOff className="size-4.5" aria-hidden />
                  ) : (
                    <Eye className="size-4.5" aria-hidden />
                  )}
                </button>
              </div>
            </Field>
            <Field label="Ulangi password baru" required>
              <div className="relative">
                <LockKeyhole
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-slate-400"
                />
                <Input
                  aria-label="Ulangi password baru"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pl-10"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Simpan dan lanjutkan
            </Button>
          </form>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="pressable mt-4 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut className="size-4" aria-hidden />
            Keluar
          </button>
        </div>
      </section>
    </main>
  );
}
