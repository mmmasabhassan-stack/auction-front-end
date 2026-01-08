import React from 'react';

// Role layout wrapper. Intentionally minimal to preserve current UI behavior.
export function AdminLayout(props: { children: React.ReactNode }) {
  return <>{props.children}</>;
}

