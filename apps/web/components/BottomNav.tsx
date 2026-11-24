'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const tabs = [
    { label: 'Discover', href: '/discover', icon: '✨' },
    { label: 'Likes', href: '/likes', icon: '💌' },
    { label: 'Matches', href: '/matches', icon: '🤝' },
    { label: 'Chats', href: '/chats', icon: '💬' },
    { label: 'Profile', href: '/profile', icon: '👤' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 90,
      }}
      aria-label="Primary mobile navigation"
    >
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 500,
              minWidth: '48px',
              minHeight: '48px',
            }}
          >
            <span style={{ fontSize: '18px' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
