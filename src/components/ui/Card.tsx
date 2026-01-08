import React from 'react';

export function Card(props: { className?: string; children: React.ReactNode }) {
  return <div className={['summary-card', props.className].filter(Boolean).join(' ')}>{props.children}</div>;
}

