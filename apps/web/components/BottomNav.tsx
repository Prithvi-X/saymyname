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
 * - Strictly hidden on desktop viewports (768px and above) via .nav-mobile-bar
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
      className="nav-mobile-bar smn-solid-nav fixed bottom-0 left-0 right-0 h-[64px] border-t border-edge items-center justify-around z-40 font-ui pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Mobile Navigation Bar"
    >
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs min-w-[56px] min-h-[48px] relative transition-colors duration-120 select-none focus-visible:outline-2 focus-visible:outline-iris ${
              isActive
                ? 'text-chalk font-semibold'
                : 'text-silver/75 hover:text-chalk'
            }`}
          >
            {isActive && (
              <span aria-hidden="true" className="absolute top-0 left-2.5 right-2.5 h-[2px] bg-iris" />
            )}
            <Icon
              size={19}
              color={isActive ? 'var(--smn-accent-iris, #8580C4)' : 'currentColor'}
              strokeWidth={isActive ? 2.2 : 1.75}
            />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
