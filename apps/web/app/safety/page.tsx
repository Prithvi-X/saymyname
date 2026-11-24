import React from 'react';
import Link from 'next/link';
import { ShieldIcon, LockIcon, HeartIcon } from '../../components/icons';

export default function SafetyPage() {
  const commitments = [
    {
      title: '1. Consent & The Mutual Match Rule',
      icon: HeartIcon,
      accentColor: 'var(--color-brand-primary)',
      description:
        'Liking a profile is an expression of interest, never permission to message. Private communication opens only after an active mutual match. Calls, audio notes, virtual dates, and Relationship Mode require separate, explicit invitations and acceptance.',
    },
    {
      title: '2. Immediate Universal Blocking',
      icon: ShieldIcon,
      accentColor: 'var(--color-status-danger)',
      description:
        'Blocking takes effect immediately on the server across all product surfaces: discovery, chat, calls, games, and relationship spaces. A blocked user cannot view your profile or contact you in any way.',
    },
    {
      title: '3. Zero Location Tracking',
      icon: LockIcon,
      accentColor: 'var(--color-accent-warm)',
      description:
        'We do not collect or display precise real-time GPS coordinates, live distance triangulation, or whereabouts. Only user-selected broad locations (e.g. "Bengaluru / Remote") or time zones are shown.',
    },
    {
      title: '4. No Surveillance or Coercive Tools',
      icon: ShieldIcon,
      accentColor: 'var(--color-status-success)',
      description:
        'Relationship Mode contains no read-receipt pressure, activity tracking, or partner surveillance. Either partner can independently leave Relationship Mode at any time without the other partner’s approval or penalty.',
    },
  ];

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '36px 20px 80px 20px' }}>
      <Link href="/" className="btn btn-ghost" style={{ marginBottom: '16px', display: 'inline-flex', paddingLeft: 0 }}>
        ← Back to Overview
      </Link>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 600, marginBottom: '8px' }}>
          Dating Safety & Privacy Commitments
        </h1>
        <p style={{ fontSize: '16px', lineHeight: '26px', color: 'var(--color-text-secondary)', margin: 0 }}>
          SayMyName was engineered from the ground up with strict safety, consent, and privacy boundaries.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {commitments.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.title} className="card-editorial" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <Icon size={20} color={c.accentColor} />
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                  {c.title}
                </h2>
              </div>
              <p style={{ fontSize: '14px', lineHeight: '24px', color: 'var(--color-text-secondary)', margin: 0 }}>
                {c.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
