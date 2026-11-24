import React from 'react';
import Link from 'next/link';
import {
  CompassIcon,
  ShieldIcon,
  LockIcon,
  HeartIcon,
  CheckIcon,
} from '../components/icons';

export default function HomePage() {
  const programmes = [
    {
      title: 'Data Science & Applications',
      code: 'BS-DSA',
      level: 'Foundation • Diploma • Degree',
      description: 'Applied machine learning, statistical modeling, distributed computing, and data algorithms.',
      tag: 'Data Science',
    },
    {
      title: 'Electronic Systems',
      code: 'BS-ES',
      level: 'Foundation • Diploma • Degree',
      description: 'Embedded RTOS, VLSI design, digital signal processing, microcontrollers, and hardware engineering.',
      tag: 'Electronics',
    },
    {
      title: 'Aeronautics & Space Tech',
      code: 'BS-AST',
      level: 'Foundation • Diploma • Degree',
      description: 'Orbital dynamics, propulsion systems, satellite architecture, aerodynamics, and telemetry.',
      tag: 'Aerospace',
    },
    {
      title: 'Management & Data Science',
      code: 'BS-MDS',
      level: 'Foundation • Diploma • Degree',
      description: 'Econometric forecasting, quantitative business analytics, decision theory, and tech leadership.',
      tag: 'Management',
    },
  ];

  const guarantees = [
    {
      title: 'Consent Before Connection',
      icon: HeartIcon,
      accentColor: 'var(--color-brand-primary)',
      description:
        'A Like is never permission to message. Private messaging unlocks only when both verified adults express mutual interest. Unsolicited stranger DMs and contact scraping are physically impossible.',
    },
    {
      title: 'Zero Surveillance Guarantee',
      icon: LockIcon,
      accentColor: 'var(--color-accent-warm)',
      description:
        'No GPS location tracking, no ambient audio monitoring, and no read-receipt pressure. Relationship Mode is a private sanctuary that either partner can leave independently at any time.',
    },
    {
      title: 'Strict Adult Verification (18+)',
      icon: ShieldIcon,
      accentColor: 'var(--color-status-success)',
      description:
        'Phase 1 is strictly restricted to adult students currently enrolled in the four approved IIT Madras non-campus BS families. Age and student enrolment are verified privately without public display.',
    },
  ];

  return (
    <div className="desktop-app-layout" style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 20px 80px 20px' }}>
      {/* Editorial Hero */}
      <section style={{ textAlign: 'center', marginBottom: '72px', paddingTop: '20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-brand-primary-subtle)', marginBottom: '24px' }}>
          <CheckIcon size={14} color="var(--color-brand-primary)" />
          <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-brand-primary)' }}>
            Exclusively For Verified BS Scholars
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(40px, 6vw, 64px)',
            lineHeight: 1.15,
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            marginBottom: '24px',
            letterSpacing: '-0.025em',
          }}
        >
          Meaningful connection, <br />
          <span style={{ fontStyle: 'italic', color: 'var(--color-brand-primary)' }}>across distance.</span>
        </h1>

        <p
          style={{
            fontSize: '18px',
            lineHeight: '30px',
            color: 'var(--color-text-secondary)',
            maxWidth: '660px',
            margin: '0 auto 36px auto',
          }}
        >
          An independent, dating-first product created for verified adults enrolled in IIT Madras non-campus BS programmes. Intentional discovery without endless swiping, gameified noise, or surveillance.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <Link
            href="/discover"
            className="btn btn-primary"
            style={{ padding: '14px 32px', fontSize: '15px' }}
          >
            <CompassIcon size={18} color="#FFFFFF" />
            <span>Enter Dating Discovery</span>
          </Link>

          <Link
            href="/onboarding"
            className="btn btn-secondary"
            style={{ padding: '14px 28px', fontSize: '15px' }}
          >
            Register Account
          </Link>

          <Link
            href="/eligibility"
            className="btn btn-ghost"
            style={{ padding: '14px 24px', fontSize: '15px' }}
          >
            Eligibility Guide
          </Link>
        </div>
      </section>

      {/* Community Manifesto Banner */}
      <section
        className="card-editorial"
        style={{
          padding: '40px 36px',
          marginBottom: '64px',
          backgroundColor: 'var(--color-surface)',
          borderLeft: '4px solid var(--color-brand-primary)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            lineHeight: '34px',
            color: 'var(--color-text-primary)',
            fontStyle: 'italic',
            margin: '0 0 16px 0',
          }}
        >
          "Non-campus learners balance rigorous term projects, remote coding sprints, and demanding lives across India and abroad. SayMyName provides the intentional space to meet someone who shares that intellectual rhythm."
        </p>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-warm)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          — SayMyName Product Constitution (Document 01)
        </p>
      </section>

      {/* Approved BS Programmes Grid */}
      <section style={{ marginBottom: '64px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 600, marginBottom: '8px' }}>
            Four Approved Programme Pathways
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', maxWidth: '540px', margin: '0 auto' }}>
            Phase 1 is strictly restricted to active learners enrolled in the four approved IITM non-campus BS families:
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {programmes.map((p) => (
            <div
              key={p.code}
              className="card-editorial"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="badge-tag" style={{ fontSize: '11px', fontWeight: 700 }}>
                    {p.code}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-accent-warm)', fontWeight: 600 }}>
                    Approved
                  </span>
                </div>

                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                  {p.title}
                </h3>

                <p style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                  {p.description}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '12px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {p.level}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architectural Guarantees */}
      <section style={{ marginBottom: '64px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 600, marginBottom: '8px' }}>
            Core Safety & Architectural Invariants
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', maxWidth: '520px', margin: '0 auto' }}>
            Enforced server-side under Documents 01, 04, and 05. Not negotiable.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {guarantees.map((g) => {
            const Icon = g.icon;
            return (
              <div
                key={g.title}
                className="card-editorial"
                style={{ padding: '28px' }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-surface-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '18px',
                  }}
                >
                  <Icon size={22} color={g.accentColor} />
                </div>

                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, marginBottom: '10px' }}>
                  {g.title}
                </h3>

                <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  {g.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Independent Platform Disclaimer Footer */}
      <footer
        style={{
          textAlign: 'center',
          paddingTop: '36px',
          borderTop: '1px solid var(--color-border-default)',
          color: 'var(--color-text-secondary)',
          fontSize: '13px',
          lineHeight: '22px',
        }}
      >
        <p style={{ maxWidth: '680px', margin: '0 auto 12px auto' }}>
          <strong>Independent Product Disclaimer:</strong> SayMyName is an independent, private platform built exclusively for verified adult learners in approved IIT Madras non-campus BS programme pathways. SayMyName is not operated, owned, endorsed, or officially affiliated with the Indian Institute of Technology Madras.
        </p>
        <p style={{ margin: 0, fontSize: '12px' }}>
          © 2026 SayMyName.in • Built with Warm Editorial Minimalism • DPDP & IT Act 2000 Compliant
        </p>
      </footer>
    </div>
  );
}
