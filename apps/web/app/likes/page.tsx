'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function LikesPage() {
  const [likes] = useState([
    {
      id: 'like-preview-1',
      candidateName: 'Sneha',
      age: 20,
      programme: 'BS in Aeronautics & Space Tech',
      likedAt: '2 hours ago',
      note: 'Liked your prompt about filter coffee vs gradient descent.',
    },
  ]);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px 80px 16px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--color-text-primary)' }}>
          Likes Received
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Verified IITM peers who expressed interest in your profile
        </p>
      </div>

      {/* Invariant Banner (Document 01 §3.6) */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-surface-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-default)',
          fontSize: '13px',
          lineHeight: '18px',
          color: 'var(--color-text-secondary)',
          marginBottom: '24px',
        }}
      >
        🔒 <strong>Core Privacy Invariant</strong>: A Like is not permission to message. Private messaging requires an active mutual match. You must like each other before any communication or contact can occur.
      </div>

      {likes.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border-default)',
            padding: '48px 24px',
            textAlign: 'center',
            boxShadow: 'var(--elevation-1)',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌱</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0' }}>
            No Pending Likes
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', maxWidth: '380px', margin: '0 auto 20px auto', lineHeight: '22px' }}>
            When a verified peer likes your profile, they will appear here. Or find matches directly in your discovery feed.
          </p>
          <Link
            href="/discover"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              backgroundColor: 'var(--color-brand-primary)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-pill)',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Explore Discover
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {likes.map((l) => (
            <div
              key={l.id}
              style={{
                padding: '20px',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-default)',
                boxShadow: 'var(--elevation-1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, margin: '0 0 2px 0' }}>
                    {l.candidateName}, {l.age}
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-accent-warm)', fontWeight: 600 }}>
                    {l.programme}
                  </p>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{l.likedAt}</span>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px 0', fontStyle: 'italic' }}>
                "{l.note}"
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Link
                  href="/discover"
                  style={{
                    padding: '8px 18px',
                    backgroundColor: 'var(--color-brand-primary)',
                    color: '#FFFFFF',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  ♥ Match in Discover
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
