'use client';

import React from 'react';
import UserPage from '@/components/roles/user/UserPage';
import { UserLayout } from '@/components/layout/UserLayout';

export default function Page() {
  return (
    <UserLayout>
      <UserPage />
    </UserLayout>
  );
}

