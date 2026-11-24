import React from 'react';

export default function ChatsPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '24px' }}>Conversations</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
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
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Aanya</h2>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>13:45</span>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Are you participating in the upcoming BS term project presentation?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
