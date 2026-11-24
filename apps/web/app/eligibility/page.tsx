import React from 'react';
import Link from 'next/link';
import { ELIGIBLE_PROGRAMMES, RECOGNISED_PATHWAYS } from '@saymyname/validation';
import { ShieldIcon, BookOpenIcon, CheckIcon } from '../../components/icons';

export default function EligibilityPage() {
  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '36px 20px 80px 20px' }}>
      <Link href="/" className="btn btn-ghost" style={{ marginBottom: '16px', display: 'inline-flex', paddingLeft: 0 }}>
        ← Back to Overview
      </Link>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 600, marginBottom: '8px' }}>
          Phase 1 Eligibility Policy
        </h1>
        <p style={{ fontSize: '16px', lineHeight: '26px', color: 'var(--color-text-secondary)', margin: 0 }}>
          SayMyName Phase 1 is restricted strictly to verified adults (18+) currently enrolled in one of the four approved IIT Madras non-campus BS programme pathways.
        </p>
      </div>

      <div className="card-editorial" style={{ padding: '28px', marginBottom: '24px', borderLeft: '4px solid var(--color-brand-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <ShieldIcon size={20} color="var(--color-brand-primary)" />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, color: 'var(--color-brand-primary)', margin: 0 }}>
            18+ Adult Boundary (DPDP Act Compliance)
          </h2>
        </div>
        <p style={{ fontSize: '14px', lineHeight: '24px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Under Indian Digital Personal Data Protection (DPDP) regulations and platform constitutional rules (Document 01 §3.5), no individuals under 18 years of age may register or participate in discovery, even if an IITM programme permits younger qualifiers. Age is verified privately and exact birthdate is never exposed publicly.
        </p>
      </div>

      <div className="card-editorial" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <BookOpenIcon size={20} color="var(--color-accent-warm)" />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, margin: 0 }}>
            Approved Academic Programme Families
          </h2>
        </div>

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {Object.entries(ELIGIBLE_PROGRAMMES).map(([code, name]) => (
            <li
              key={code}
              style={{
                padding: '14px 0',
                borderBottom: '1px solid var(--color-border-default)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckIcon size={14} color="var(--color-status-success)" />
                <span style={{ fontWeight: 600, fontSize: '15px' }}>{name}</span>
              </div>
              <span className="badge-tag" style={{ fontSize: '11px', fontWeight: 700 }}>
                {code}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card-editorial" style={{ padding: '28px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, marginBottom: '10px' }}>
          Recognised Enrolment Stages
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          Learners must be in active status in one of the following recognised stages:
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {RECOGNISED_PATHWAYS.map((p) => (
            <span key={p} className="badge-tag" style={{ backgroundColor: 'var(--color-brand-primary-subtle)', color: 'var(--color-brand-primary)', fontWeight: 600 }}>
              {p} Stage
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
