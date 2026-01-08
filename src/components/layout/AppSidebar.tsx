import React from 'react';

export type SidebarItem = {
  key: string;
  label: string;
  iconClass: string;
  active?: boolean;
  onClick: () => void;
};

export function AppSidebar(props: { title: string; items: SidebarItem[] }) {
  const { title, items } = props;
  return (
    <aside className="sidebar">
      <h2>{title}</h2>
      <ul>
        {items.map((it) => (
          <li key={it.key} className={it.active ? 'active-menu' : ''}>
            <a onClick={it.onClick}>
              <span className="nav-icon">
                <i className={it.iconClass} />
              </span>
              <span>{it.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

