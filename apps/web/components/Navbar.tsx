'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { sanitizeDisplayName } from '../lib/api';
import { Logo } from './brand/Logo';
import { Badge, Button, Avatar } from './ui';
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
 * - Logo Lockup: The Interval Symbol + Grotesk Wordmark (Strictly preserved)
 * - Navigation: Rectangular architectural tabs (6px radius), strictly NO pills
 * - Desktop: Renders top navigation tabs; strictly hidden on mobile (< 768px)
 * - Identity: Displays compact Avatar initials + clean display name + compact Verified badge
 * - Security: Never exposes student roll numbers, email prefixes, or account UUIDs
 */
export default function Navbar() {
  const pathname = usePathname();
  const { authState, user, logout } = useAuth();
  const isVerifiedMember = authState === 'VERIFIED_MEMBER';

  const cleanDisplayName = sanitizeDisplayName(user?.displayName);

  const memberNavItems = [
    { label: 'Discover', href: '/discover', icon: CompassIcon },
    { label: 'Likes', href: '/likes', icon: HeartIcon },
    { label: 'Matches', href: '/matches', icon: HandshakeIcon },
    { label: 'Chats', href: '/chats', icon: ChatIcon },
    { label: 'Profile', href: '/profile', icon: UserIcon },
  ];

  return (
    <header className="flex items-center justify-between px-4 sm:px-7 h-[66px] bg-coal border-b border-edge sticky top-0 z-50 shadow-sm font-ui select-none">
      {/* Brand Logo & Desktop Navigation Tabs */}
      <div className="flex items-center gap-6 lg:gap-8">
        <Logo size="md" symbolConcept="A" />

        {/* Navigation Tabs: Member Tabs IF Authenticated, Public Links IF Visitor (Desktop only) */}
        {isVerifiedMember ? (
          <nav
            className="hidden md:flex items-center gap-1"
            aria-label="Member Navigation"
          >
            {memberNavItems.map((tab) => {
              const isActive = pathname.startsWith(tab.href);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-[6px] text-xs lg:text-sm font-medium transition-colors duration-120 ${
                    isActive
                      ? 'bg-slate text-chalk border border-edge font-semibold shadow-xs'
                      : 'text-silver hover:text-chalk hover:bg-iron/60 border border-transparent'
                  }`}
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
            className="hidden md:flex items-center gap-2"
            aria-label="Public Navigation"
          >
            <Link
              href="/eligibility"
              className={`text-xs lg:text-sm font-medium px-3 py-1.5 rounded-[6px] transition-colors ${
                pathname === '/eligibility'
                  ? 'text-chalk bg-iron font-semibold'
                  : 'text-silver hover:text-chalk'
              }`}
            >
              Eligibility Guide
            </Link>
            <Link
              href="/safety"
              className={`text-xs lg:text-sm font-medium px-3 py-1.5 rounded-[6px] transition-colors ${
                pathname === '/safety'
                  ? 'text-chalk bg-iron font-semibold'
                  : 'text-silver hover:text-chalk'
              }`}
            >
              Safety & Consent
            </Link>
          </nav>
        )}
      </div>

      {/* Right Controls: Member Profile/Status OR Visitor CTA */}
      <div className="flex items-center gap-3">
        {isVerifiedMember ? (
          <>
            <Link
              href="/safety"
              className="hidden lg:inline-flex items-center gap-1.5 text-xs text-silver hover:text-chalk px-2.5 py-1.5 rounded-[6px] transition-colors"
              title="Safety and Consent Commitments"
            >
              <ShieldIcon size={15} color="currentColor" />
              <span>Safety</span>
            </Link>

            {/* Member Identity & Compact Verified Indicator */}
            <div className="flex items-center gap-2.5">
              <Link href="/profile" className="flex items-center gap-2 group focus-visible:outline-2 focus-visible:outline-iris rounded-[6px]">
                <Avatar size="sm" name={cleanDisplayName || 'Member'} verified={false} />
                <span className="hidden sm:inline text-xs lg:text-sm font-semibold text-chalk group-hover:text-silver transition-colors max-w-[130px] truncate">
                  {cleanDisplayName || 'Member'}
                </span>
                <Badge variant="verified" size="sm">Verified</Badge>
              </Link>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => logout()}
                title="Log out of session"
              >
                Sign Out
              </Button>
            </div>
          </>
        ) : authState === 'VERIFICATION_PENDING' ? (
          <div className="flex items-center gap-3">
            <Link href="/onboarding">
              <Badge variant="warning" size="md">
                Complete Verification →
              </Badge>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logout()}
            >
              Sign Out
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Link href="/login">
              <Button variant="secondary" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button variant="primary" size="sm">
                Register
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
