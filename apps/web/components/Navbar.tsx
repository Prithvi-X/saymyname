'use client';

import React, { useState, useEffect } from 'react';
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
 * - Logo Lockup: Approved Interval Symbol + Grotesk Wordmark (strictly preserved)
 * - Visitor Header: Logo + Eligibility Guide + Safety & Consent + Sign In + Register
 * - Member Header (ACTIVE_MEMBER only): Member tabs + Avatar/Display Name + Verified badge + Sign Out
 * - Mobile Visitor Drawer (< 768px): Accessible toggle menu for public navigation & auth actions
 */
export default function Navbar() {
  const pathname = usePathname();
  const { authState, lifecycleState, user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActiveMember =
    lifecycleState === 'ACTIVE_MEMBER' || authState === 'VERIFIED_MEMBER';
  const isAuthenticatedIncomplete =
    !isActiveMember &&
    lifecycleState !== 'UNAUTHENTICATED' &&
    authState !== 'UNAUTHENTICATED';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const cleanDisplayName = sanitizeDisplayName(user?.displayName);

  const memberNavItems = [
    { label: 'Discover', href: '/discover', icon: CompassIcon },
    { label: 'Likes', href: '/likes', icon: HeartIcon },
    { label: 'Matches', href: '/matches', icon: HandshakeIcon },
    { label: 'Chats', href: '/chats', icon: ChatIcon },
    { label: 'Profile', href: '/profile', icon: UserIcon },
  ];

  const publicNavItems = [
    { label: 'Eligibility Guide', href: '/eligibility' },
    { label: 'Safety & Consent', href: '/safety' },
  ];

  return (
    <header className="bg-coal border-b border-edge sticky top-0 z-50 shadow-sm font-ui select-none">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-7 h-[66px]">
        {/* Brand Logo & Desktop Navigation Tabs */}
        <div className="flex items-center gap-6 lg:gap-8 min-w-0 shrink-0">
          <Logo size="md" symbolConcept="A" />

          {isActiveMember ? (
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
                      color={
                        isActive
                          ? 'var(--smn-accent-iris, #8580C4)'
                          : 'var(--smn-text-tertiary, #8B949E)'
                      }
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
              {publicNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-xs lg:text-sm font-medium px-3 py-1.5 rounded-[6px] transition-colors whitespace-nowrap ${
                    pathname === item.href
                      ? 'text-chalk bg-iron border border-edge font-semibold'
                      : 'text-silver hover:text-chalk border border-transparent'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isActiveMember ? (
            <>
              <Link
                href="/safety"
                className="hidden lg:inline-flex items-center gap-1.5 text-xs text-silver hover:text-chalk px-2.5 py-1.5 rounded-[6px] transition-colors"
                title="Safety and Consent Commitments"
              >
                <ShieldIcon size={15} color="currentColor" />
                <span>Safety</span>
              </Link>

              <div className="flex items-center gap-2 sm:gap-2.5">
                <Link
                  href="/profile"
                  className="flex items-center gap-1.5 sm:gap-2 group focus-visible:outline-2 focus-visible:outline-iris rounded-[6px]"
                >
                  <span className="hidden sm:inline-flex">
                    <Avatar size="sm" name={cleanDisplayName || 'Member'} verified={false} />
                  </span>
                  <span className="hidden sm:inline text-xs lg:text-sm font-semibold text-chalk group-hover:text-silver transition-colors max-w-[130px] truncate">
                    {cleanDisplayName || 'Member'}
                  </span>
                  <Badge variant="verified" size="sm">
                    Verified
                  </Badge>
                </Link>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => logout()}
                  title="Sign out of session"
                >
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <>
              {isAuthenticatedIncomplete ? (
                <div className="hidden sm:flex items-center gap-2.5">
                  <Link href="/onboarding">
                    <Badge variant="warning" size="md">
                      Continue Setup →
                    </Badge>
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => logout()}>
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2.5">
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

              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-[6px] border border-edge bg-iron text-chalk hover:bg-slate transition-colors"
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-public-drawer"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  {mobileMenuOpen ? (
                    <path d="M6 6l12 12M18 6L6 18" />
                  ) : (
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  )}
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer for Visitors & Incomplete Accounts (Strictly hidden on desktop md+) */}
      {!isActiveMember && mobileMenuOpen && (
        <nav
          id="mobile-public-drawer"
          aria-label="Mobile Public Navigation"
          className="md:hidden border-t border-edge bg-coal px-4 py-4 flex flex-col gap-2"
        >
          <Link
            href="/eligibility"
            className={`px-3 py-2.5 rounded-[6px] text-sm font-medium ${
              pathname === '/eligibility'
                ? 'bg-iron text-chalk border border-edge'
                : 'text-silver hover:bg-iron/60 hover:text-chalk'
            }`}
          >
            Eligibility Guide
          </Link>
          <Link
            href="/safety"
            className={`px-3 py-2.5 rounded-[6px] text-sm font-medium ${
              pathname === '/safety'
                ? 'bg-iron text-chalk border border-edge'
                : 'text-silver hover:bg-iron/60 hover:text-chalk'
            }`}
          >
            Safety &amp; Consent
          </Link>
          {isAuthenticatedIncomplete ? (
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-edge/70 mt-1 sm:hidden">
              <Link href="/onboarding" className="w-full">
                <Button variant="primary" size="sm" className="w-full">
                  Continue Setup
                </Button>
              </Link>
              <Button variant="secondary" size="sm" className="w-full" onClick={() => logout()}>
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-edge/70 mt-1 sm:hidden">
              <Link href="/login" className="w-full">
                <Button variant="secondary" size="sm" className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link href="/onboarding" className="w-full">
                <Button variant="primary" size="sm" className="w-full">
                  Register
                </Button>
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
