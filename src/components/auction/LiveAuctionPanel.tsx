import React from 'react';

export function LiveAuctionPanel(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="live-control-box">
      <div className="event-info">
        <h3>{props.title}</h3>
      </div>
      {props.children}
    </div>
  );
}

