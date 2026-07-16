import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { Card } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <Card>
      <EmptyState
        icon={LayoutDashboard}
        title="Dashboard"
        description="Monitoring penyaluran PIP & pekerjaan tim — dibangun pada Fase 4."
      />
    </Card>
  );
}
