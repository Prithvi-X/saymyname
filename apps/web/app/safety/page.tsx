import React from 'react';
import Link from 'next/link';

export default function SafetyPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/" style={{ fontSize: '14px', color: 'var(--color-brand-primary)', marginBottom: '16px', display: 'inline-block' }}>
        ← Back to Home
      </Link>
      <h1 style={{ fontSize: '36px', marginBottom: '16px', fontWeight: 600 }}>Dating Safety & Privacy Commitments</h1>
      <p style={{ fontSize: '16px', lineHeight: '26px', color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
        SayMyName was engineered from the ground up with strict safety, consent, and privacy boundaries.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ backgroundColor: 'var(--color-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--color-brand-primary)' }}>1. Consent & The Mutual Match Rule</h2>
          <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)' }}>
            Liking a profile is an expression of interest, not permission to message. Private communication opens only after an active mutual match. Calls, audio notes, virtual dates, and Relationship Mode require separate, explicit invitations and acceptance.
          </p>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--color-accent-warm)' }}>2. Immediate Universal Blocking</h2>
          <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)' }}>
            Blocking takes effect immediately on the server across all product surfaces: discovery, chat, calls, games, and relationship spaces. A blocked user cannot view your profile or contact you in any way.
          </p>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--color-status-success)' }}>3. Zero Location Tracking</h2>
          <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)' }}>
            We do not collect or display precise real-time GPS coordinates, live distance triangulation, or whereabouts. Only user-selected broad locations or time zones are shown.
          </p>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--color-text-primary)' }}>4. No Surveillance or Coercive Tools</h2>
          <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)' }}>
            Relationship Mode contains no read-receipt pressure, activity tracking, or partner surveillance. Either partner can independently leave Relationship Mode at any time without the other’s approval.
          </p>
        </div>
      </div>
    </div>
  );
}
