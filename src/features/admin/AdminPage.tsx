import { ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { Card } from '@/components/ui/card';

export default function AdminPage() {
  return (
    <Card>
      <EmptyState
        icon={ShieldCheck}
        title="Admin"
        description="Data penyaluran, pegawai, kategori, template, data terhapus, audit log, dan pengaturan — dibangun pada Fase 6."
      />
    </Card>
  );
}
