import React from 'react';
import Link from 'next/link';

export default function MatchesPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '24px' }}>Mutual Matches</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-brand-primary-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-brand-primary)',
                fontWeight: 600,
              }}
            >
              A
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Aanya, 21</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>BS in Data Science • Matched today</p>
            </div>
          </div>

          <Link
            href="/chats"
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-brand-primary)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Message
          </Link>
        </div>
      </div>
    </div>
  );
}
