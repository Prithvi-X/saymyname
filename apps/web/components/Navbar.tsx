'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CompassIcon, HeartIcon, HandshakeIcon, ChatIcon, UserIcon, ShieldIcon } from './icons';

export default function Navbar() {
  const pathname = usePathname();

  const appNavLinks = [
    { label: 'Discover', href: '/discover', icon: CompassIcon },
    { label: 'Likes', href: '/likes', icon: HeartIcon },
    { label: 'Matches', href: '/matches', icon: HandshakeIcon },
    { label: 'Chats', href: '/chats', icon: ChatIcon },
    { label: 'Profile', href: '/profile', icon: UserIcon },
  ];

  const isAppSection = appNavLinks.some((l) => pathname.startsWith(l.href));

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        height: '68px',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border-default)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(37, 33, 31, 0.03)',
      }}
    >
      {/* Brand Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '3px 8px',
              backgroundColor: 'var(--color-brand-primary-subtle)',
              color: 'var(--color-brand-primary)',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 700,
            }}
          >
            IITM BS
          </span>
        </Link>

        {/* Desktop Primary App Navigation */}
        <nav className="desktop-only-nav" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {appNavLinks.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive ? 'var(--color-brand-primary-subtle)' : 'transparent',
                  transition: 'all var(--duration-fast) var(--ease-out)',
                }}
              >
                <Icon size={16} color={isActive ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)'} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right Utility Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
            transition: 'color var(--duration-fast) var(--ease-out)',
          }}
        >
          <ShieldIcon size={15} color="var(--color-text-secondary)" />
          <span className="desktop-only-nav">Safety & Consent</span>
        </Link>

        <Link
          href="/eligibility"
          className="desktop-only-nav"
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            padding: '6px 12px',
          }}
        >
          Eligibility
        </Link>

        {!isAppSection && (
          <Link
            href="/onboarding"
            className="btn btn-primary"
            style={{ padding: '8px 18px', fontSize: '13px' }}
          >
            Register (18+)
          </Link>
        )}
      </div>
    </header>
  );
}
