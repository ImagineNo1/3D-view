import { redirect } from 'next/navigation';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { requireAdminSession } from '@/lib/auth';

type Props = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function AdminPage({ searchParams }: Props) {
  const session = await requireAdminSession();
  if (!session) redirect('/admin/login');

  const params = (await searchParams) || {};
  const initialTab = params.tab === 'list' ? 'list' : 'form';

  return <AdminDashboard initialTab={initialTab} />;
}
