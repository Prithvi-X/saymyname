'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import {
  CompassIcon,
  HeartIcon,
  HandshakeIcon,
  ChatIcon,
  UserIcon,
} from './icons';

export default function BottomNav() {
  const pathname = usePathname();
  const { authState } = useAuth();

  // Strict Rule: Unauthenticated visitors must NEVER see member dating tabs
  if (authState !== 'VERIFIED_MEMBER') {
    return null;
  }

  const tabs = [
    { label: 'Discover', href: '/discover', icon: CompassIcon },
    { label: 'Likes', href: '/likes', icon: HeartIcon },
    { label: 'Matches', href: '/matches', icon: HandshakeIcon },
    { label: 'Chats', href: '/chats', icon: ChatIcon },
    { label: 'Profile', href: '/profile', icon: UserIcon },
  ];

  return (
    <nav
      className="nav-mobile-bar"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '62px',
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 90,
        boxShadow: '0 -2px 10px rgba(30, 26, 24, 0.04)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      aria-label="Mobile Navigation Bar"
    >
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 500,
              minWidth: '56px',
              minHeight: '48px',
              position: 'relative',
              transition: 'color var(--duration-fast)',
            }}
          >
            <Icon
              size={19}
              color={isActive ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)'}
              strokeWidth={isActive ? 2.2 : 1.75}
            />
            <span>{tab.label}</span>
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '3px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-brand-primary)',
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
