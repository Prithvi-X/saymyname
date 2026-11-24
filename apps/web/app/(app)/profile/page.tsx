import React from 'react';

export default function ProfilePage() {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '24px' }}>My Profile & Settings</h1>

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-brand-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            👤
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Verified Student</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-status-success)', fontWeight: 500 }}>✓ 18+ & Enrolment Verified</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button style={{ padding: '12px', textAlign: 'left', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 500 }}>
            Edit Profile Photos & Bio
          </button>
          <button style={{ padding: '12px', textAlign: 'left', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 500 }}>
            Dating Discovery Preferences
          </button>
          <button style={{ padding: '12px', textAlign: 'left', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 500 }}>
            Pause / Hide Profile
          </button>
          <button style={{ padding: '12px', textAlign: 'left', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 500 }}>
            Privacy & Account Controls
          </button>
        </div>
      </div>
    </div>
  );
}
