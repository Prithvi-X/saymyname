import React from 'react';
import Link from 'next/link';
import { ELIGIBLE_PROGRAMMES, RECOGNISED_PATHWAYS } from '@saymyname/validation';

export default function EligibilityPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/" style={{ fontSize: '14px', color: 'var(--color-brand-primary)', marginBottom: '16px', display: 'inline-block' }}>
        ← Back to Home
      </Link>
      <h1 style={{ fontSize: '36px', marginBottom: '16px', fontWeight: 600 }}>Phase 1 Eligibility Policy</h1>
      <p style={{ fontSize: '16px', lineHeight: '26px', color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
        SayMyName Phase 1 is restricted strictly to adults (18+) currently enrolled in one of the four approved IIT Madras non-campus BS programme pathways.
      </p>

      <div style={{ backgroundColor: 'var(--color-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '12px', color: 'var(--color-brand-primary)' }}>18+ Adult Boundary</h2>
        <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)' }}>
          Under Indian Digital Personal Data Protection (DPDP) regulations and platform policy, no individuals under 18 years of age may register or participate in discovery, even if an IITM programme permits younger qualifiers. Age is verified privately and date of birth is never displayed publicly.
        </p>
      </div>

      <div style={{ backgroundColor: 'var(--color-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Approved Academic Programmes</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {Object.entries(ELIGIBLE_PROGRAMMES).map(([code, name]) => (
            <li key={code} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 500 }}>{name}</span>
              <span style={{ fontSize: '12px', padding: '2px 8px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)' }}>
                {code}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ backgroundColor: 'var(--color-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>Recognised Pathway Stages</h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          Learners must be in active status in one of the following recognised stages:
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {RECOGNISED_PATHWAYS.map((p) => (
            <span key={p} style={{ padding: '6px 14px', backgroundColor: 'var(--color-brand-primary-subtle)', color: 'var(--color-brand-primary)', borderRadius: 'var(--radius-pill)', fontSize: '13px', fontWeight: 600 }}>
              {p} Stage
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
