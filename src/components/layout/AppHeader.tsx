import React from 'react';

export function AppHeader(props: {
  title: string;
  logoSrc?: string;
  rightHref?: string;
  rightText?: string;
  rightSlot?: React.ReactNode;
}) {
  const { title, logoSrc = '/paa-logo.png', rightHref, rightText, rightSlot } = props;

  return (
    <header className="main-header">
      <div className="header-content">
        <div className="logo brand-row">
          <img src={logoSrc} alt="IIAP Logo" className="brand-mark" />
          <div className="brand-text">
            <h1>{title}</h1>
          </div>
        </div>
        <div className="utility-nav">
          {rightSlot ?? (rightHref && rightText ? <a href={rightHref}>{rightText}</a> : null)}
        </div>
      </div>
    </header>
  );
}

