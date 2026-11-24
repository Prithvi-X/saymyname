'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { Logo } from './brand/Logo';
import { Badge } from './ui/Badge';
import {
  CompassIcon,
  HeartIcon,
  HandshakeIcon,
  ChatIcon,
  UserIcon,
  ShieldIcon,
} from './icons';

/**
 * SayMyName Navigation Bar (Document 10)
 * - Mineral Night Surfaces: Coal #12161B with Edge #343D48 bottom separator
 * - Logo Lockup: The Interval Symbol + Grotesk Wordmark
 * - Navigation: Rectangular architectural tabs (6px radius), strictly NO pills
 * - Strict auth segregation: Visitors see only public informational routes
 */
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
        padding: '0 28px',
        height: '66px',
        backgroundColor: 'var(--smn-surface-base, #12161B)',
        borderBottom: '1px solid var(--smn-border-subtle, #343D48)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: 'var(--elevation-1)',
      }}
    >
      {/* Brand Logo & Main Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <Logo size="md" symbolConcept="A" />

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
                    gap: '7px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--smn-text-primary, #F0F1EE)' : 'var(--smn-text-secondary, #B6BDC4)',
                    backgroundColor: isActive ? 'var(--smn-surface-active, #252D37)' : 'transparent',
                    border: isActive ? '1px solid var(--smn-border-subtle, #343D48)' : '1px solid transparent',
                    transition: 'all 120ms ease-out',
                  }}
                >
                  <Icon
                    size={16}
                    color={isActive ? 'var(--smn-accent-iris, #8580C4)' : 'var(--smn-text-tertiary, #8B949E)'}
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
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            aria-label="Public Navigation"
          >
            <Link
              href="/eligibility"
              style={{
                fontSize: '13.5px',
                fontWeight: pathname === '/eligibility' ? 600 : 500,
                color: pathname === '/eligibility' ? 'var(--smn-text-primary, #F0F1EE)' : 'var(--smn-text-secondary, #B6BDC4)',
                backgroundColor: pathname === '/eligibility' ? 'var(--smn-surface-raised, #1A2027)' : 'transparent',
                padding: '7px 12px',
                borderRadius: '6px',
              }}
            >
              Eligibility Guide
            </Link>
            <Link
              href="/safety"
              style={{
                fontSize: '13.5px',
                fontWeight: pathname === '/safety' ? 600 : 500,
                color: pathname === '/safety' ? 'var(--smn-text-primary, #F0F1EE)' : 'var(--smn-text-secondary, #B6BDC4)',
                backgroundColor: pathname === '/safety' ? 'var(--smn-surface-raised, #1A2027)' : 'transparent',
                padding: '7px 12px',
                borderRadius: '6px',
              }}
            >
              Safety & Consent
            </Link>
          </nav>
        )}
      </div>

      {/* Right Controls: Member Profile/Status OR Visitor CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                color: 'var(--smn-text-secondary, #B6BDC4)',
                padding: '6px 12px',
                borderRadius: '6px',
              }}
              title="Safety and Consent Commitments"
            >
              <ShieldIcon size={15} color="var(--smn-text-secondary, #B6BDC4)" />
              <span className="nav-desktop-tabs">Safety</span>
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Badge variant="verified">Verified</Badge>
                <span className="nav-desktop-tabs" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--smn-text-primary)' }}>
                  {user?.displayName || 'Member'}
                </span>
              </div>

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
              style={{ color: 'var(--smn-accent-ember, #E18A62)', fontWeight: 600, fontSize: '12px', padding: '6px 12px' }}
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
