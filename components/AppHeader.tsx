import React from 'react';

export function AppHeader(props: {
  title: string;
  rightText: string;
  rightHref: string;
  logoSrc?: string;
}) {
  const { title, rightText, rightHref, logoSrc = '/paa-logo.png' } = props;
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
          <a href={rightHref}>{rightText}</a>
        </div>
      </div>
    </header>
  );
}

