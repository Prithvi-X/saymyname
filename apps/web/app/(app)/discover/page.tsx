import React from 'react';

export default function DiscoverPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600 }}>Discover</h1>
        <button
          style={{
            padding: '6px 14px',
            backgroundColor: 'var(--color-surface-subtle)',
            borderRadius: 'var(--radius-pill)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Preferences ⚙️
        </button>
      </div>

      {/* Discovery Candidate Card */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          overflow: 'hidden',
          boxShadow: 'var(--elevation-2)',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            height: '360px',
            backgroundColor: 'var(--color-brand-primary-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-brand-primary)',
            fontSize: '18px',
            fontWeight: 500,
          }}
        >
          [Photo Placeholder - Aspect Ratio Preserved]
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Aanya, 21</h2>
            <span style={{ fontSize: '12px', padding: '2px 8px', backgroundColor: 'var(--color-brand-primary-subtle)', color: 'var(--color-brand-primary)', borderRadius: 'var(--radius-pill)', fontWeight: 600 }}>
              Verified Student
            </span>
          </div>

          <p style={{ fontSize: '14px', color: 'var(--color-accent-warm)', fontWeight: 600, marginBottom: '12px' }}>
            BS in Data Science & Applications • Diploma Level
          </p>

          <p style={{ fontSize: '15px', lineHeight: '22px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
            Balancing deep learning assignments with indie film analysis. Looking for someone who enjoys quiet virtual coffee dates and cooperative word puzzles across time zones.
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 10px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
              🎬 Cinema
            </span>
            <span style={{ padding: '4px 10px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
              ☕ Filter Coffee
            </span>
            <span style={{ padding: '4px 10px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
              🧩 Word Games
            </span>
          </div>
        </div>
      </div>

      {/* Action Controls - Accessible buttons with minimum 48x48dp target */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px' }}>
        <button
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--color-surface)',
            border: '2px solid var(--color-border-default)',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--elevation-1)',
            transition: 'transform var(--duration-fast) var(--ease-out)',
          }}
          aria-label="Pass candidate"
        >
          ✕
        </button>

        <button
          style={{
            width: '72px',
            height: '72px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--color-brand-primary)',
            color: '#FFFFFF',
            fontSize: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--elevation-2)',
            transition: 'transform var(--duration-fast) var(--ease-out)',
          }}
          aria-label="Like profile"
        >
          ♥
        </button>
      </div>
    </div>
  );
}
