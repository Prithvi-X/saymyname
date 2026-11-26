'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './brand/Logo';

const MEMBER_WORKSPACE_PREFIXES = ['/discover', '/likes', '/matches', '/chats', '/profile'];

export interface PublicFooterProps {
  supportEmail?: string | null;
  editorialEnabled?: boolean;
}

/**
 * SayMyName Public Footer (Document 10)
 * Rendered on public, authentication, and onboarding routes.
 * Hidden inside active dating workspace views so mobile BottomNav stays unobstructed.
 */
export default function PublicFooter({
  supportEmail = null,
  editorialEnabled = false,
}: PublicFooterProps) {
  const pathname = usePathname();
  const isMemberWorkspace = MEMBER_WORKSPACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const useEditorialFooter = editorialEnabled && pathname === '/';

  if (isMemberWorkspace) {
    return null;
  }

  return (
    <footer className="bg-coal border-t border-edge font-ui mt-16">
      <div className="container-wide py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-5 flex flex-col gap-3">
          <Logo size="sm" symbolConcept="A" />
          <p className="text-xs text-silver leading-relaxed max-w-sm">
            An independent, dating-first space built strictly for verified adults (18+)
            currently enrolled in approved IIT Madras non-campus BS programmes.
          </p>
          <p className="text-xs text-silver/85 leading-relaxed max-w-sm">
            Independent platform. SayMyName.in is not owned, endorsed, operated by, or
            officially affiliated with IIT Madras.
          </p>
        </div>

        <div className="md:col-span-2 flex flex-col gap-2.5 text-xs">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-silver/80">
            Platform
          </p>
          {useEditorialFooter ? (
            <>
              <a href="#inside-saymyname" className="text-silver hover:text-chalk transition-colors">
                Inside SayMyName
              </a>
              <a href="#how-it-works" className="text-silver hover:text-chalk transition-colors">
                How It Works
              </a>
            </>
          ) : (
            <Link href="/" className="text-silver hover:text-chalk transition-colors">
              Overview
            </Link>
          )}
          <Link href="/eligibility" className="text-silver hover:text-chalk transition-colors">
            Eligibility Guide
          </Link>
          <Link href="/safety" className="text-silver hover:text-chalk transition-colors">
            Safety &amp; Consent
          </Link>
        </div>

        <div className="md:col-span-2 flex flex-col gap-2.5 text-xs">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-silver/80">
            Access
          </p>
          <Link href="/login" className="text-silver hover:text-chalk transition-colors">
            Member Sign In
          </Link>
          <Link href="/onboarding" className="text-silver hover:text-chalk transition-colors">
            Create Account
          </Link>
          <Link href="/forgot-password" className="text-silver hover:text-chalk transition-colors">
            Password Recovery
          </Link>
        </div>

        <div className="md:col-span-3 flex flex-col gap-2.5 text-xs">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-silver/80">
            Governance
          </p>
          <Link href="/privacy" className="text-silver hover:text-chalk transition-colors">
            Privacy Notice
          </Link>
          <Link href="/terms" className="text-silver hover:text-chalk transition-colors">
            Terms of Use
          </Link>
          <Link href="/support" className="text-silver hover:text-chalk transition-colors">
            Member Support
          </Link>
          {supportEmail ? (
            <a
              href={`mailto:${supportEmail}`}
              className="text-iris hover:text-iris-hover transition-colors pt-1 break-all"
            >
              {supportEmail}
            </a>
          ) : (
            <span className="text-silver/80 pt-1">
              Support desk details published on Member Support.
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-edge/80">
        <div className="container-wide py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-silver">
          <span>&copy; {new Date().getFullYear()} SayMyName.in — Phase 1 Non-Campus BS Cohort</span>
          <span>Mutual Match Before Messaging · 18+ Verified Only</span>
        </div>
      </div>
    </footer>
  );
}
