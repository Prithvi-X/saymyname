'use client';

import React from 'react';
import Link from 'next/link';

export default function Navbar() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border-default)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--color-brand-primary)',
            letterSpacing: '-0.5px',
          }}
        >
          SayMyName
        </span>
        <span
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '2px 8px',
            backgroundColor: 'var(--color-brand-primary-subtle)',
            color: 'var(--color-brand-primary)',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 600,
          }}
        >
          IITM BS Cohorts
        </span>
      </Link>

      <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link
          href="/eligibility"
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            transition: 'color var(--duration-fast) var(--ease-out)',
          }}
        >
          Eligibility
        </Link>
        <Link
          href="/safety"
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            transition: 'color var(--duration-fast) var(--ease-out)',
          }}
        >
          Safety & Consent
        </Link>
        <Link
          href="/discover"
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--color-brand-primary)',
            color: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'background-color var(--duration-fast) var(--ease-out)',
          }}
        >
          Open App
        </Link>
      </nav>
    </header>
  );
}
