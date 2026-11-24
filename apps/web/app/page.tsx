import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>
      {/* Editorial Hero */}
      <section style={{ textAlign: 'center', marginBottom: '64px' }}>
        <p
          style={{
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-accent-warm)',
            fontWeight: 600,
            marginBottom: '16px',
          }}
        >
          Phase 1.0 • Adult Enrolled Students Only (18+)
        </p>
        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 56px)',
            lineHeight: 1.15,
            fontWeight: 400,
            color: 'var(--color-text-primary)',
            marginBottom: '24px',
          }}
        >
          Meaningful connection across distance.
        </h1>
        <p
          style={{
            fontSize: '18px',
            lineHeight: '28px',
            color: 'var(--color-text-secondary)',
            maxWidth: '680px',
            margin: '0 auto 32px auto',
          }}
        >
          SayMyName is an independent, dating-first platform exclusively for verified adult learners in the four approved IIT Madras non-campus BS programme families.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Link
            href="/onboarding"
            style={{
              padding: '12px 28px',
              backgroundColor: 'var(--color-brand-primary)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              fontSize: '16px',
              fontWeight: 600,
              boxShadow: 'var(--elevation-1)',
            }}
          >
            Register & Get Verified
          </Link>
          <Link
            href="/discover"
            style={{
              padding: '12px 28px',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            Preview Discovery
          </Link>
          <Link
            href="/eligibility"
            style={{
              padding: '12px 28px',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '16px',
              fontWeight: 500,
            }}
          >
            Check Eligibility
          </Link>
        </div>
      </section>

      {/* Eligible Programmes Card */}
      <section
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-default)',
          padding: '32px',
          marginBottom: '48px',
        }}
      >
        <h2 style={{ fontSize: '24px', marginBottom: '16px', fontWeight: 600 }}>
          Eligible BS Programme Pathways
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
          Phase 1 includes verified students in active Foundation, Diploma, or Degree stages:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Data Science</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>BS in Data Science & Applications</p>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Electronic Systems</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>BS in Electronic Systems</p>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Aero & Space</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>BS in Aeronautics & Space Technology</p>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Management & DS</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>BS in Management & Data Science</p>
          </div>
        </div>
      </section>

      {/* Core Architectural Guarantees */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        <div style={{ padding: '24px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-brand-primary)' }}>
            Consent Before Connection
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            A Like is never permission to message. Private conversation begins only after mutual matching. Calls, dates, and games require individual voluntary consent.
          </p>
        </div>
        <div style={{ padding: '24px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-accent-warm)' }}>
            Zero Surveillance
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            No GPS tracking, no partner surveillance, and no read-receipt pressure. Relationship Mode is a private workspace that either partner can leave independently.
          </p>
        </div>
        <div style={{ padding: '24px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-status-success)' }}>
            Independent Platform
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            SayMyName is independently operated. We do not imply IIT Madras ownership or official affiliation, protecting student identity with isolated verification storage.
          </p>
        </div>
      </section>
    </div>
  );
}
