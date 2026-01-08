'use client';

import React from 'react';
import SubAdminPage from '@/components/roles/subAdmin/SubAdminPage';
import { SubAdminLayout } from '@/components/layout/SubAdminLayout';

export default function Page() {
  return (
    <SubAdminLayout>
      <SubAdminPage />
    </SubAdminLayout>
  );
}

