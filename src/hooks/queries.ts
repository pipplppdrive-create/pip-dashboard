import { useQuery } from '@tanstack/react-query';
import { getDataService } from '@/services';

/**
 * Konvensi kunci query: elemen pertama = topik realtime (ChangeTopic),
 * sehingga invalidasi dari event realtime cukup mencocokkan prefix.
 */
export const qk = {
  employees: (includeInactive = false) => ['employees', { includeInactive }] as const,
  board: () => ['board'] as const,
  steps: (includeDeleted = false) => ['steps', { includeDeleted }] as const,
  tasks: (opts?: { includeArchived?: boolean; includeDeleted?: boolean }) =>
    ['tasks', opts ?? {}] as const,
  comments: (taskId: string) => ['comments', taskId] as const,
  attachments: (taskId: string) => ['attachments', taskId] as const,
  taskHistory: (taskId: string) => ['audit', 'task', taskId] as const,
  categories: (includeInactive = false) => ['categories', { includeInactive }] as const,
  labels: (includeInactive = false) => ['labels', { includeInactive }] as const,
  templates: (includeInactive = false) => ['templates', { includeInactive }] as const,
  distributionActive: (year?: number, period?: string) =>
    ['distribution', 'active', year ?? null, period ?? null] as const,
  distributionList: () => ['distribution', 'list'] as const,
  distributionScopes: () => ['distribution', 'scopes'] as const,
  activity: (limit = 20) => ['audit', 'activity', limit] as const,
  auditList: (filter: unknown) => ['audit', 'list', filter] as const,
  settings: () => ['settings'] as const,
  sessions: () => ['sessions'] as const,
} as const;

export function useEmployees(includeInactive = false) {
  return useQuery({
    queryKey: qk.employees(includeInactive),
    queryFn: () => getDataService().employees.list({ includeInactive }),
  });
}

export function useAppSettings() {
  return useQuery({
    queryKey: qk.settings(),
    queryFn: () => getDataService().settings.get(),
    staleTime: 60_000,
  });
}

export function useSessions(enabled: boolean) {
  return useQuery({
    queryKey: qk.sessions(),
    queryFn: () => getDataService().auth.listSessions(),
    enabled,
  });
}

export function useBoard() {
  return useQuery({
    queryKey: qk.board(),
    queryFn: () => getDataService().board.get(),
  });
}

export function useSteps(includeDeleted = false) {
  return useQuery({
    queryKey: qk.steps(includeDeleted),
    queryFn: () => getDataService().board.listSteps({ includeDeleted }),
  });
}

export function useTasks(opts?: { includeArchived?: boolean; includeDeleted?: boolean }) {
  return useQuery({
    queryKey: qk.tasks(opts),
    queryFn: () => getDataService().tasks.list(opts),
  });
}

export function useAllComments() {
  return useQuery({
    queryKey: ['comments', 'all'] as const,
    queryFn: () => getDataService().tasks.listAllComments(),
  });
}

export function useCategories(includeInactive = false) {
  return useQuery({
    queryKey: qk.categories(includeInactive),
    queryFn: () => getDataService().taxonomy.listCategories({ includeInactive }),
  });
}

export function useLabels(includeInactive = false) {
  return useQuery({
    queryKey: qk.labels(includeInactive),
    queryFn: () => getDataService().taxonomy.listLabels({ includeInactive }),
  });
}

export function useActiveSnapshot(year?: number, period?: string) {
  return useQuery({
    queryKey: qk.distributionActive(year, period),
    queryFn: () => getDataService().distribution.getActive(year, period),
  });
}

export function useSnapshots() {
  return useQuery({
    queryKey: qk.distributionList(),
    queryFn: () => getDataService().distribution.list(),
  });
}

export function useDistributionScopes() {
  return useQuery({
    queryKey: qk.distributionScopes(),
    queryFn: () => getDataService().distribution.listScopes(),
  });
}

export function useRecentActivity(limit = 15) {
  return useQuery({
    queryKey: qk.activity(limit),
    queryFn: () => getDataService().audit.recentActivity(limit),
  });
}
