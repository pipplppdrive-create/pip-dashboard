import { NavLink, Navigate, Route, Routes } from 'react-router';
import {
  Database,
  FileClock,
  LayoutTemplate,
  Settings,
  Tags,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuditSection } from './sections/AuditSection';
import { DistributionSection } from './sections/DistributionSection';
import { EmployeesSection } from './sections/EmployeesSection';
import { SettingsSection } from './sections/SettingsSection';
import { TaxonomySection } from './sections/TaxonomySection';
import { TemplatesSection } from './sections/TemplatesSection';
import { TrashSection } from './sections/TrashSection';

interface SectionDef {
  path: string;
  label: string;
  icon: LucideIcon;
  element: React.ReactNode;
}

/** Satu menu Admin dengan tujuh bagian (sesuai spesifikasi — tidak menambah menu utama). */
const SECTIONS: SectionDef[] = [
  { path: 'penyaluran', label: 'Data Penyaluran', icon: Database, element: <DistributionSection /> },
  { path: 'pegawai', label: 'Pegawai & PIC', icon: Users, element: <EmployeesSection /> },
  { path: 'kategori-label', label: 'Kategori & Label', icon: Tags, element: <TaxonomySection /> },
  { path: 'template', label: 'Template Pekerjaan', icon: LayoutTemplate, element: <TemplatesSection /> },
  { path: 'data-terhapus', label: 'Data Terhapus', icon: Trash2, element: <TrashSection /> },
  { path: 'audit', label: 'Audit Log', icon: FileClock, element: <AuditSection /> },
  { path: 'pengaturan', label: 'Pengaturan', icon: Settings, element: <SettingsSection /> },
];

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      {/* Navigasi seksi Admin */}
      <nav
        aria-label="Bagian Admin"
        className="scrollbar-thin flex shrink-0 gap-1 overflow-x-auto pb-1 xl:w-56 xl:flex-col xl:overflow-visible"
      >
        {SECTIONS.map((s) => (
          <NavLink
            key={s.path}
            to={s.path}
            className={({ isActive }) =>
              cn(
                'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-800',
              )
            }
          >
            <s.icon className="size-4.5 shrink-0" aria-hidden />
            {s.label}
          </NavLink>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <Routes>
          <Route index element={<Navigate to="penyaluran" replace />} />
          {SECTIONS.map((s) => (
            <Route key={s.path} path={s.path} element={s.element} />
          ))}
          <Route path="*" element={<Navigate to="penyaluran" replace />} />
        </Routes>
      </div>
    </div>
  );
}
