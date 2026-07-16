import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Filter, Pencil, Plus, Search, X } from 'lucide-react';
import { ErrorState } from '@/components/feedback/error-state';
import { notify } from '@/components/feedback/toaster';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { arrayMove, cn } from '@/lib/utils';
import { getDataService } from '@/services';
import type { DurationType, Priority, Step, Task } from '@/services/types';
import { useActorCtx } from '@/features/auth/useActorCtx';
import {
  qk,
  useAllComments,
  useBoard,
  useCategories,
  useEmployees,
  useLabels,
  useSteps,
  useTasks,
} from '@/hooks/queries';
import { useQuery } from '@tanstack/react-query';
import { ArchiveList } from './components/ArchiveList';
import { DeleteStepDialog } from './components/DeleteStepDialog';
import { DeleteTaskDialog } from './components/DeleteTaskDialog';
import { KanbanBoard } from './components/KanbanBoard';
import { StepDialog } from './components/StepDialog';
import { TaskDetailDialog } from './components/TaskDetailDialog';
import { TaskDialog } from './components/TaskDialog';
import {
  buildColumns,
  countActiveFilters,
  DURATION_LABEL,
  EMPTY_FILTERS,
  PRIORITY_LABEL,
  type BoardFilters,
} from './lib';
import { useBoardErrorHandler, useMoveTask } from './useBoardActions';

export default function BoardPage() {
  const boardQ = useBoard();
  const stepsQ = useSteps();
  const tasksQ = useTasks({ includeArchived: true });
  const categoriesQ = useCategories();
  const labelsQ = useLabels();
  const employeesQ = useEmployees(true);
  const commentsQ = useAllComments();
  const attachmentsCountQ = useQuery({
    queryKey: ['attachments', 'all-count'] as const,
    queryFn: async () => {
      // hitung lampiran per task untuk indikator kartu
      const tasks = await getDataService().tasks.list({ includeArchived: true });
      const entries = await Promise.all(
        tasks.map(async (t) => [t.id, (await getDataService().attachments.list(t.id)).length] as const),
      );
      return new Map(entries);
    },
    staleTime: 60_000,
  });
  const templatesQ = useQuery({
    queryKey: qk.templates(false),
    queryFn: () => getDataService().templates.list(),
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const stepFilter = searchParams.get('step');
  const openTaskId = searchParams.get('task');

  const [tab, setTab] = useState<'aktif' | 'arsip'>('aktif');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // Dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogTask, setTaskDialogTask] = useState<Task | null>(null);
  const [taskDialogStepId, setTaskDialogStepId] = useState<string | undefined>(undefined);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [stepDialogStep, setStepDialogStep] = useState<Step | null>(null);
  const [deleteStepTarget, setDeleteStepTarget] = useState<Step | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<Task | null>(null);

  const getCtx = useActorCtx();
  const onError = useBoardErrorHandler();
  const queryClient = useQueryClient();
  const moveTask = useMoveTask();

  const steps = useMemo(() => stepsQ.data ?? [], [stepsQ.data]);
  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const employees = employeesQ.data ?? [];
  const categories = categoriesQ.data ?? [];
  const labels = labelsQ.data ?? [];

  const effectiveFilters = useMemo<BoardFilters>(
    () => ({ ...filters, search, stepId: stepFilter }),
    [filters, search, stepFilter],
  );

  const visibleSteps = useMemo(
    () => (stepFilter ? steps.filter((s) => s.id === stepFilter) : steps),
    [steps, stepFilter],
  );

  const columns = useMemo(
    () => buildColumns(tasks, steps, effectiveFilters),
    [tasks, steps, effectiveFilters],
  );

  const countsByTask = useMemo(() => {
    const map = new Map<string, { comments: number; attachments: number }>();
    for (const c of commentsQ.data ?? []) {
      const cur = map.get(c.taskId) ?? { comments: 0, attachments: 0 };
      cur.comments += 1;
      map.set(c.taskId, cur);
    }
    for (const [taskId, count] of attachmentsCountQ.data ?? new Map<string, number>()) {
      const cur = map.get(taskId) ?? { comments: 0, attachments: 0 };
      cur.attachments = count;
      map.set(taskId, cur);
    }
    return map;
  }, [commentsQ.data, attachmentsCountQ.data]);

  const openTask = useMemo(
    () => (openTaskId ? (tasks.find((t) => t.id === openTaskId) ?? null) : null),
    [openTaskId, tasks],
  );

  const filterCount = countActiveFilters(filters);
  const hasSearchOrFilter = filterCount > 0 || search.trim().length > 0;

  function setOpenTaskId(id: string | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('task', id);
        else next.delete('task');
        return next;
      },
      { replace: true },
    );
  }

  function clearStepFilter() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('step');
        return next;
      },
      { replace: true },
    );
  }

  async function saveTitle() {
    const board = boardQ.data;
    if (!board) return;
    const trimmed = titleDraft.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === board.title) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      await getDataService().board.rename(trimmed, board.version, ctx);
      await queryClient.invalidateQueries({ queryKey: qk.board() });
      notify.success('Judul board diperbarui.');
    } catch (err) {
      onError(err, 'Gagal mengubah judul board');
    }
  }

  async function handleMoveStep(step: Step, direction: -1 | 1) {
    const ids = steps.map((s) => s.id);
    const from = ids.indexOf(step.id);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      await getDataService().board.reorderSteps(arrayMove(ids, from, to), ctx);
      await queryClient.invalidateQueries({ queryKey: ['steps'] });
    } catch (err) {
      onError(err, 'Gagal mengubah urutan step');
    }
  }

  function handleMoveTask(taskId: string, to: { stepId: string; index: number }) {
    const ctx = getCtx();
    if (!ctx) return;
    void moveTask(taskId, to, ctx);
  }

  const isLoading = boardQ.isLoading || stepsQ.isLoading || tasksQ.isLoading;
  const isError = boardQ.isError || stepsQ.isError || tasksQ.isError;

  if (isError) {
    return (
      <Card>
        <ErrorState
          error={boardQ.error ?? stepsQ.error ?? tasksQ.error}
          onRetry={() => {
            void boardQ.refetch();
            void stepsQ.refetch();
            void tasksQ.refetch();
          }}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Judul board (editable) */}
        {editingTitle ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void saveTitle();
            }}
          >
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              className="h-9 w-72 font-bold"
              maxLength={80}
              aria-label="Judul board"
            />
            <Button type="submit" size="icon" variant="secondary" aria-label="Simpan judul">
              <Check className="size-4" aria-hidden />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(boardQ.data?.title ?? '');
              setEditingTitle(true);
            }}
            className="group flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left"
            aria-label="Ubah judul board"
          >
            <span className="text-base font-bold text-slate-900">
              {boardQ.data?.title ?? '…'}
            </span>
            <Pencil
              className="size-3.5 text-slate-300 transition-colors group-hover:text-slate-500"
              aria-hidden
            />
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Toggle tampilan Aktif/Arsip (arsip sebagai tab/filter di halaman ini) */}
          <div
            role="group"
            aria-label="Tampilan board"
            className="inline-flex items-center gap-1 rounded-xl bg-slate-200/60 p-1"
          >
            {(
              [
                { value: 'aktif', label: 'Aktif' },
                {
                  value: 'arsip',
                  label: `Arsip (${tasks.filter((t) => t.archivedAt && !t.deletedAt).length})`,
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={tab === opt.value}
                onClick={() => setTab(opt.value)}
                className={cn(
                  'inline-flex cursor-pointer items-center rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors',
                  tab === opt.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pekerjaan…"
              aria-label="Cari pekerjaan"
              className="h-9 w-48 pl-9 lg:w-64"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="size-3.5" aria-hidden />
                Filter
                {filterCount > 0 && <Badge tone="brand">{filterCount}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-3">
              <Field label="Kategori">
                <Select
                  value={filters.categoryId ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, categoryId: e.target.value || null }))
                  }
                >
                  <option value="">Semua kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Label">
                <Select
                  value={filters.labelId ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, labelId: e.target.value || null }))}
                >
                  <option value="">Semua label</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Prioritas">
                <Select
                  value={filters.priority ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      priority: (e.target.value || null) as Priority | null,
                    }))
                  }
                >
                  <option value="">Semua prioritas</option>
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="PIC">
                <Select
                  value={filters.picId ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, picId: e.target.value || null }))}
                >
                  <option value="">Semua PIC</option>
                  {employees
                    .filter((e) => e.active)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Jenis durasi">
                <Select
                  value={filters.durationType ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      durationType: (e.target.value || null) as DurationType | null,
                    }))
                  }
                >
                  <option value="">Semua durasi</option>
                  {(Object.keys(DURATION_LABEL) as DurationType[]).map((d) => (
                    <option key={d} value={d}>
                      {DURATION_LABEL[d]}
                    </option>
                  ))}
                </Select>
              </Field>
              {filterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  Hapus semua filter
                </Button>
              )}
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            className="h-9"
            onClick={() => {
              setTaskDialogTask(null);
              setTaskDialogStepId(undefined);
              setTaskDialogOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Pekerjaan baru
          </Button>
        </div>
      </div>

      {/* Chip filter step dari Dashboard */}
      {stepFilter && (
        <div className="flex items-center gap-2">
          <Badge tone="brand">
            Filter step: {steps.find((s) => s.id === stepFilter)?.name ?? '?'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={clearStepFilter}>
            <X className="size-3.5" aria-hidden />
            Hapus filter
          </Button>
        </div>
      )}

      {/* Konten */}
      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : tab === 'arsip' ? (
        <Card>
          <ArchiveList
            tasks={tasks}
            employees={employees}
            categories={categories}
            onOpenTask={setOpenTaskId}
          />
        </Card>
      ) : (
        <KanbanBoard
          steps={visibleSteps}
          columns={columns}
          employees={employees}
          categories={categories}
          labels={labels}
          countsByTask={countsByTask}
          onOpenTask={setOpenTaskId}
          onAddTask={(stepId) => {
            setTaskDialogTask(null);
            setTaskDialogStepId(stepId);
            setTaskDialogOpen(true);
          }}
          onAddStep={() => {
            setStepDialogStep(null);
            setStepDialogOpen(true);
          }}
          onEditStep={(step) => {
            setStepDialogStep(step);
            setStepDialogOpen(true);
          }}
          onDeleteStep={setDeleteStepTarget}
          onMoveStep={(step, dir) => void handleMoveStep(step, dir)}
          onMoveTask={handleMoveTask}
          dragDisabled={hasSearchOrFilter}
        />
      )}

      {/* Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={taskDialogTask}
        initialStepId={taskDialogStepId}
        steps={steps}
        categories={categories}
        labels={labels}
        employees={employees}
        templates={templatesQ.data ?? []}
      />
      <TaskDetailDialog
        open={!!openTask}
        onOpenChange={(open) => {
          if (!open) setOpenTaskId(null);
        }}
        task={openTask}
        steps={steps}
        categories={categories}
        labels={labels}
        employees={employees}
        onEdit={(task) => {
          setTaskDialogTask(task);
          setTaskDialogStepId(undefined);
          setTaskDialogOpen(true);
        }}
        onDelete={setDeleteTaskTarget}
      />
      <StepDialog open={stepDialogOpen} onOpenChange={setStepDialogOpen} step={stepDialogStep} />
      <DeleteStepDialog
        open={!!deleteStepTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteStepTarget(null);
        }}
        step={deleteStepTarget}
        steps={steps}
        tasks={tasks}
      />
      <DeleteTaskDialog
        open={!!deleteTaskTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTaskTarget(null);
        }}
        task={deleteTaskTarget}
        onDeleted={() => setOpenTaskId(null)}
      />
    </div>
  );
}
