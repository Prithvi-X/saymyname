'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { HeartIcon, CheckIcon, LockIcon } from '../../components/icons';

export default function LikesPage() {
  const [likes] = useState([
    {
      id: 'like-preview-1',
      candidateName: 'Sneha',
      age: 20,
      programme: 'BS in Aeronautics & Space Tech',
      likedAt: '2 hours ago',
      photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
      note: 'Liked your prompt about filter coffee vs gradient descent.',
    },
  ]);

  return (
    <div className="mobile-app-layout" style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px 48px 16px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 600, margin: '0 0 4px 0' }}>
          Likes Received
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Verified IITM peers who expressed interest in your profile
        </p>
      </div>

      {/* Invariant Banner (Document 01 §3.6) */}
      <div className="callout-trust" style={{ marginBottom: '24px' }}>
        <LockIcon size={18} color="var(--color-brand-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong>Core Privacy Invariant</strong>: A Like is not permission to message. Private messaging requires an active mutual match. You must like each other before any communication or contact can occur.
        </span>
      </div>

      {likes.length === 0 ? (
        <div className="card-editorial" style={{ padding: '56px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-subtle)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <HeartIcon size={28} color="var(--color-brand-primary)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, margin: '0 0 8px 0' }}>
            No Pending Likes
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', maxWidth: '380px', margin: '0 auto 24px auto', lineHeight: '22px' }}>
            When a verified peer likes your profile, they will appear here. Or find matches directly in your discovery feed.
          </p>
          <Link href="/discover" className="btn btn-primary">
            Explore Discover
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {likes.map((l) => (
            <div
              key={l.id}
              className="card-editorial"
              style={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {l.photoUrl ? (
                    <img
                      src={l.photoUrl}
                      alt={l.candidateName}
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1.5px solid var(--color-border-default)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        backgroundColor: '#7A3045',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                      }}
                    >
                      {l.candidateName.charAt(0)}
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, margin: 0 }}>
                        {l.candidateName}, {l.age}
                      </h3>
                      <span className="badge-verified" style={{ fontSize: '10px', padding: '2px 8px' }}>
                        <CheckIcon size={10} color="var(--color-brand-primary)" />
                        <span>Verified</span>
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-accent-warm)', fontWeight: 600 }}>
                      {l.programme}
                    </p>
                  </div>
                </div>

                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{l.likedAt}</span>
              </div>

              <div className="card-subtle" style={{ margin: '0 0 16px 0', borderLeft: '3px solid var(--color-brand-primary)' }}>
                <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: 0, fontStyle: 'italic' }}>
                  "{l.note}"
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Link
                  href="/discover"
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', fontSize: '13px' }}
                >
                  <HeartIcon size={14} color="#FFFFFF" fill="#FFFFFF" />
                  <span>Match in Discover</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
