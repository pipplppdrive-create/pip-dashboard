import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Employee } from '@/services/types';

interface PicPickerProps {
  employees: Employee[];
  /** Nilai saat ini (termasuk PIC yang mungkin sudah nonaktif dari data lama). */
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * Multi-PIC dari master pegawai.
 * Pegawai nonaktif tidak dapat DITAMBAHKAN; pilihan lama tetap dipertahankan
 * (histori menampilkan pegawai nonaktif).
 */
export function PicPicker({ employees, value, onChange, placeholder = 'Pilih PIC…', ...aria }: PicPickerProps) {
  const [search, setSearch] = useState('');
  const selectable = useMemo(
    () => employees.filter((e) => e.active || value.includes(e.id)),
    [employees, value],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return selectable;
    return selectable.filter(
      (e) => e.fullName.toLowerCase().includes(q) || e.team.toLowerCase().includes(q),
    );
  }, [selectable, search]);

  const selected = value
    .map((id) => employees.find((e) => e.id === id))
    .filter((e): e is Employee => !!e);

  function toggle(emp: Employee) {
    if (value.includes(emp.id)) {
      onChange(value.filter((id) => id !== emp.id));
    } else if (emp.active) {
      onChange([...value, emp.id]);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          {...aria}
          className={cn(
            'flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm shadow-sm transition-colors',
            'hover:border-slate-400 focus:border-brand-500',
          )}
        >
          {selected.length === 0 ? (
            <span className="flex-1 text-slate-400">{placeholder}</span>
          ) : (
            <>
              <AvatarGroup employees={selected} size="xs" max={4} />
              <span className="min-w-0 flex-1 truncate text-slate-700">
                {selected.map((e) => e.displayName).join(', ')}
              </span>
            </>
          )}
          <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <div className="relative mb-2">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pegawai…"
            className="h-8 pl-8 text-xs"
            aria-label="Cari pegawai"
          />
        </div>
        <ul className="scrollbar-thin max-h-60 space-y-0.5 overflow-y-auto">
          {filtered.map((emp) => {
            const checked = value.includes(emp.id);
            const disabled = !emp.active && !checked;
            return (
              <li key={emp.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={() => toggle(emp)}
                    aria-label={emp.fullName}
                  />
                  <Avatar employee={emp} size="sm" showInactive />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">
                      {emp.fullName}
                      {!emp.active && (
                        <span className="ml-1 text-[10px] font-bold text-slate-400 uppercase">
                          nonaktif
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {emp.position}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-2 py-4 text-center text-xs text-slate-400">
              Pegawai tidak ditemukan.
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
