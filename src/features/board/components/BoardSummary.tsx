import { useMemo } from 'react';
import { Focus, TriangleAlert } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { todayISO } from '@/lib/format';
import type { Employee, Step, Task } from '@/services/types';
import { ActivityFeed } from '@/features/dashboard/components/ActivityFeed';
import {
  TaskAttentionList,
  type AttentionItem,
} from '@/features/dashboard/components/TaskAttentionList';
import { WorkSummary } from '@/features/dashboard/components/WorkSummary';
import {
  attentionReasons,
  attentionScore,
  focusScore,
  isFocusToday,
  needsFollowUpIds,
  stepKindMap,
  type FocusItem,
} from '@/features/dashboard/lib';
import { useAllComments, useAppSettings, useRecentActivity } from '@/hooks/queries';

interface BoardSummaryProps {
  steps: Step[];
  tasks: Task[];
  employees: Employee[];
}

/**
 * Tampilan "Ringkasan" menu Pekerjaan — rincian yang dulu ada di Dashboard:
 * jumlah per step, perlu perhatian, fokus hari ini, dan aktivitas terbaru.
 */
export function BoardSummary({ steps, tasks, employees }: BoardSummaryProps) {
  const { data: settings } = useAppSettings();
  const commentsQ = useAllComments();
  const activityQ = useRecentActivity(12);
  const today = todayISO();

  const { attentionItems, focusItems } = useMemo(() => {
    const kinds = stepKindMap(steps);
    const staleDays = settings?.staleDays ?? 7;
    const followUp = needsFollowUpIds(commentsQ.data ?? []);
    const attention: AttentionItem[] = [];
    const focus: FocusItem[] = [];
    for (const task of tasks) {
      if (task.archivedAt || task.deletedAt) continue;
      const reasons = attentionReasons(task, kinds, staleDays, today);
      if (reasons.length > 0) {
        attention.push({ task, reasons });
      }
      const needs = followUp.has(task.id);
      if (kinds.get(task.stepId) !== 'DONE' && isFocusToday(task, reasons, needs)) {
        focus.push({ task, reasons, needsFollowUp: needs });
      }
    }
    attention.sort(
      (a, b) =>
        attentionScore(a.reasons) - attentionScore(b.reasons) ||
        (a.task.dueDate ?? '9999').localeCompare(b.task.dueDate ?? '9999'),
    );
    focus.sort((a, b) => focusScore(a) - focusScore(b));
    return {
      attentionItems: attention,
      focusItems: focus.map(
        (f): AttentionItem => ({
          task: f.task,
          reasons: f.reasons,
          extraBadge: f.task.isFocus
            ? { label: 'Ditandai fokus', tone: 'brand' }
            : f.needsFollowUp
              ? { label: 'Perlu tindak lanjut', tone: 'info' }
              : null,
        }),
      ),
    };
  }, [steps, tasks, settings?.staleDays, commentsQ.data, today]);

  return (
    <div className="animate-fade-in-up grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
      <Card>
        <CardHeader
          title="Ringkasan Pekerjaan"
          description="Jumlah pekerjaan per step — klik untuk membuka board"
        />
        <div className="px-3 pb-3">
          <WorkSummary steps={steps} tasks={tasks.filter((t) => !t.archivedAt && !t.deletedAt)} />
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Perlu Perhatian"
          description="Tenggat, PIC kosong, terhambat, atau lama tidak diperbarui"
        />
        <div className="px-3 pb-3">
          <TaskAttentionList
            items={attentionItems}
            employees={employees}
            emptyIcon={TriangleAlert}
            emptyTitle="Tidak ada yang perlu perhatian"
            emptyDescription="Seluruh pekerjaan dalam kondisi terkendali."
          />
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Fokus Hari Ini"
          description="Ditandai fokus, jatuh tempo, prioritas tinggi, atau perlu tindak lanjut"
        />
        <div className="px-3 pb-3">
          <TaskAttentionList
            items={focusItems}
            employees={employees}
            emptyIcon={Focus}
            emptyTitle="Tidak ada fokus khusus"
            emptyDescription="Tandai pekerjaan sebagai fokus dari board."
          />
        </div>
      </Card>
      <Card>
        <CardHeader title="Aktivitas Terbaru" description="Perubahan terakhir oleh tim" />
        <div className="px-3 pb-3">
          {activityQ.isLoading ? (
            <div className="space-y-2 p-1">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : (
            <ActivityFeed events={activityQ.data ?? []} employees={employees} />
          )}
        </div>
      </Card>
    </div>
  );
}
