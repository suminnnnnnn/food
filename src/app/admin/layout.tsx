import React from 'react';
import AdminShell from '../../components/admin/AdminShell';

export const metadata = { title: '모두의맛집 admin' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
