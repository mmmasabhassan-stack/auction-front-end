import React from 'react';

export function BidTimer(props: { label: string; timeText: string; children?: React.ReactNode }) {
  return (
    <div className="timer-display-admin">
      <h4>{props.label}</h4>
      <div className="timer-display">{props.timeText}</div>
      {props.children}
    </div>
  );
}

