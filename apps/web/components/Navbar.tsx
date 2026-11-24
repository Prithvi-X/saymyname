'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CompassIcon,
  HeartIcon,
  HandshakeIcon,
  ChatIcon,
  UserIcon,
  ShieldIcon,
} from './icons';

export default function Navbar() {
  const pathname = usePathname();

  const primaryNavItems = [
    { label: 'Discover', href: '/discover', icon: CompassIcon },
    { label: 'Likes', href: '/likes', icon: HeartIcon },
    { label: 'Matches', href: '/matches', icon: HandshakeIcon },
    { label: 'Chats', href: '/chats', icon: ChatIcon },
    { label: 'Profile', href: '/profile', icon: UserIcon },
  ];

  const isAppRoute = primaryNavItems.some((item) => pathname.startsWith(item.href));

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        height: '68px',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border-default)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: 'var(--elevation-1)',
      }}
    >
      {/* Brand Wordmark with Restrained Editorial Authority */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'baseline', gap: '8px' }}
          aria-label="SayMyName Home"
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '26px',
              fontWeight: 600,
              color: 'var(--color-brand-primary)',
              letterSpacing: '-0.03em',
            }}
          >
            SayMyName
          </span>
          <span
            className="index-stamp"
            style={{
              fontSize: '9px',
              color: 'var(--color-text-muted)',
              display: 'inline-block',
              transform: 'translateY(-2px)',
            }}
          >
            Phase 1 • Verified
          </span>
        </Link>

        {/* Primary Desktop Navigation */}
        <nav
          className="nav-desktop-tabs"
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          aria-label="Main Navigation"
        >
          {primaryNavItems.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '13.5px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive ? 'var(--color-brand-primary-subtle)' : 'transparent',
                  transition: 'all var(--duration-fast) var(--ease-editorial)',
                }}
              >
                <Icon
                  size={16}
                  color={isActive ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)'}
                  strokeWidth={isActive ? 2 : 1.75}
                />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right Controls: Safety & Account CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link
          href="/safety"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-pill)',
            transition: 'color var(--duration-fast)',
          }}
          title="Safety and Consent Commitments"
        >
          <ShieldIcon size={15} color="var(--color-text-secondary)" />
          <span className="nav-desktop-tabs">Safety & Consent</span>
        </Link>

        {!isAppRoute && (
          <Link
            href="/onboarding"
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '13px' }}
          >
            Register
          </Link>
        )}
      </div>
    </header>
  );
}
