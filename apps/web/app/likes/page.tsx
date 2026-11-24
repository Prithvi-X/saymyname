import React from 'react';

export default function LikesPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '24px' }}>Likes</h1>
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', padding: '32px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>No new likes yet</p>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          When another verified member likes your profile, you will see them here or match directly in Discover.
        </p>
      </div>
    </div>
  );
}
