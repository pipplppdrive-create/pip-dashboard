import { SquareKanban } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { Card } from '@/components/ui/card';

export default function BoardPage() {
  return (
    <Card>
      <EmptyState
        icon={SquareKanban}
        title="Pekerjaan"
        description="Board Kanban pekerjaan tim — dibangun pada Fase 5."
      />
    </Card>
  );
}
