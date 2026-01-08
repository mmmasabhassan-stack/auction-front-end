import React from 'react';

export function StatusBadge(props: { statusClass: string; children: React.ReactNode; className?: string }) {
  return <span className={['status-badge', props.statusClass, props.className].filter(Boolean).join(' ')}>{props.children}</span>;
}

