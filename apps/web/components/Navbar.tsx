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
  ShieldIcon,
  CheckIcon,
} from './icons';

export default function Navbar() {
  const pathname = usePathname();
  const { authState, user, logout } = useAuth();
  const isVerifiedMember = authState === 'VERIFIED_MEMBER';

  const memberNavItems = [
    { label: 'Discover', href: '/discover', icon: CompassIcon },
    { label: 'Likes', href: '/likes', icon: HeartIcon },
    { label: 'Matches', href: '/matches', icon: HandshakeIcon },
    { label: 'Chats', href: '/chats', icon: ChatIcon },
    { label: 'Profile', href: '/profile', icon: UserIcon },
  ];

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

        {/* Navigation Tabs: Member Tabs IF Authenticated, Public Links IF Visitor */}
        {isVerifiedMember ? (
          <nav
            className="nav-desktop-tabs"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            aria-label="Member Navigation"
          >
            {memberNavItems.map((tab) => {
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
        ) : (
          <nav
            className="nav-desktop-tabs"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            aria-label="Public Navigation"
          >
            <Link
              href="/eligibility"
              style={{
                fontSize: '13.5px',
                fontWeight: pathname === '/eligibility' ? 600 : 500,
                color: pathname === '/eligibility' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              Eligibility Guide
            </Link>
            <Link
              href="/safety"
              style={{
                fontSize: '13.5px',
                fontWeight: pathname === '/safety' ? 600 : 500,
                color: pathname === '/safety' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              Safety & Consent
            </Link>
          </nav>
        )}
      </div>

      {/* Right Controls: Authenticated Member Controls or Public Visitor CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {isVerifiedMember ? (
          <>
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
              }}
              title="Safety and Consent Commitments"
            >
              <ShieldIcon size={15} color="var(--color-text-secondary)" />
              <span className="nav-desktop-tabs">Safety</span>
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span className="badge-verified" style={{ fontSize: '9px', padding: '1px 6px' }}>
                  <CheckIcon size={9} color="var(--color-brand-primary)" />
                  <span>Verified</span>
                </span>
                <span className="nav-desktop-tabs">{user?.displayName || 'Member'}</span>
              </span>

              <button
                onClick={() => logout()}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '12px' }}
                title="Log out of session"
              >
                Sign Out
              </button>
            </div>
          </>
        ) : authState === 'VERIFICATION_PENDING' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              href="/onboarding"
              className="badge-tag"
              style={{ color: 'var(--color-accent-warm)', fontWeight: 600, fontSize: '12px', padding: '6px 12px' }}
            >
              Complete Verification →
            </Link>
            <button
              onClick={() => logout()}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link
              href="/login"
              className="btn btn-secondary"
              style={{ padding: '7px 18px', fontSize: '13px' }}
            >
              Sign In
            </Link>
            <Link
              href="/onboarding"
              className="btn btn-primary"
              style={{ padding: '7px 18px', fontSize: '13px' }}
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
