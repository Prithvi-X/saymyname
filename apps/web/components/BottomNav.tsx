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

/**
 * SayMyName Mobile Bottom Navigation Bar (Document 10)
 * - Fixed architectural bar with Coal #12161B surface and Edge #343D48 top separator
 * - Strictly hidden for unauthenticated visitors
 * - Rectangular interaction touch targets with Iris accent indicator
 */
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
        backgroundColor: 'var(--smn-surface-base, #12161B)',
        borderTop: '1px solid var(--smn-border-subtle, #343D48)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 90,
        boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.4)',
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
              color: isActive ? 'var(--smn-text-primary, #F0F1EE)' : 'var(--smn-text-tertiary, #8B949E)',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 500,
              minWidth: '56px',
              minHeight: '48px',
              position: 'relative',
              transition: 'color 120ms ease-out',
            }}
          >
            <Icon
              size={19}
              color={isActive ? 'var(--smn-accent-iris, #8580C4)' : 'var(--smn-text-tertiary, #8B949E)'}
              strokeWidth={isActive ? 2.2 : 1.75}
            />
            <span>{tab.label}</span>
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  width: '16px',
                  height: '2px',
                  borderRadius: '1px',
                  backgroundColor: 'var(--smn-accent-iris, #8580C4)',
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
