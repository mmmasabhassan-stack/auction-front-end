'use client';

import React from 'react';
import AdminPage from '@/components/roles/admin/AdminPage';
import { AdminLayout } from '@/components/layout/AdminLayout';

export default function Page() {
  return (
    <AdminLayout>
      <AdminPage />
    </AdminLayout>
  );
}

